#!/usr/bin/env python3
"""Valide les profils Hermes d'AGRIAGENT.

Pour chaque ``profiles/**/config.yaml`` :

* le fichier est un YAML valide dont la racine est un mapping ;
* les clés structurantes existent et ont le bon type (``model``, ``agent``,
  ``platform_toolsets.cli``, ``plugins.enabled``, ``_config_version``) ;
* chaque serveur MCP déclaré a une URL http(s) et un mode d'authentification ;
* aucun secret en clair n'est présent (nom de clé suspect ou valeur
  reconnaissable : clé OpenAI/GitHub/Supabase, JWT, clé AWS, URI avec mot de
  passe).

Sortie 0 si tout est conforme, 1 sinon. Aucune dépendance hors PyYAML.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import yaml

RACINE = Path(__file__).resolve().parent.parent
PROFILS = RACINE / "profiles"

# Noms de clés dont la valeur ne doit jamais être un secret en clair.
CLE_SECRET = re.compile(
    r"(api[_-]?key|secret|token|password|passwd|credential|private[_-]?key|authorization)",
    re.IGNORECASE,
)

# Valeurs manifestement sensibles, quel que soit le nom de la clé.
VALEUR_SECRET = re.compile(
    r"(sk-[A-Za-z0-9_-]{16,}"                       # OpenAI et compatibles
    r"|gh[pousr]_[A-Za-z0-9]{20,}"                  # jeton GitHub
    r"|sb_secret_[A-Za-z0-9_-]{10,}"                # clé secrète Supabase
    r"|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\."  # JWT
    r"|AKIA[0-9A-Z]{16}"                            # clé d'accès AWS
    r"|xox[baprs]-[A-Za-z0-9-]{10,}"                # jeton Slack
    r"|-----BEGIN [A-Z ]*PRIVATE KEY-----"
    r"|postgres(ql)?://[^/\s:]+:[^@\s]+@)"          # URI avec mot de passe
)

# Placeholders tolérés : la valeur désigne une variable, pas un secret.
PLACEHOLDER = re.compile(
    r"(\$\{|\{\{|<[^>]+>|environ|redacted|changeme|placeholder|xxxx)", re.IGNORECASE
)


def iter_chaines(noeud, chemin=()):
    """Parcourt récursivement un document YAML et rend (chemin, valeur)."""
    if isinstance(noeud, dict):
        for cle, valeur in noeud.items():
            yield from iter_chaines(valeur, chemin + (str(cle),))
    elif isinstance(noeud, list):
        for index, valeur in enumerate(noeud):
            yield from iter_chaines(valeur, chemin + (str(index),))
    else:
        yield chemin, noeud


def exiger_chaine(data, cle, message, erreurs):
    valeur = data.get(cle)
    if not isinstance(valeur, str) or not valeur.strip():
        erreurs.append(message)
        return None
    return valeur


def est_url(valeur) -> bool:
    return isinstance(valeur, str) and valeur.startswith(("http://", "https://"))


def verifier_config(chemin: Path, erreurs: list[str]) -> None:
    rel = chemin.relative_to(RACINE).as_posix()
    try:
        data = yaml.safe_load(chemin.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        erreurs.append(f"{rel} : YAML invalide — {exc}")
        return
    if not isinstance(data, dict):
        erreurs.append(f"{rel} : la racine doit être un mapping YAML")
        return

    # --- model ---------------------------------------------------------
    model = data.get("model")
    if not isinstance(model, dict):
        erreurs.append(f"{rel} : section « model » absente ou invalide")
    else:
        exiger_chaine(model, "default", f"{rel} : model.default doit être une chaîne non vide", erreurs)
        exiger_chaine(model, "provider", f"{rel} : model.provider doit être une chaîne non vide", erreurs)
        if "base_url" in model and not est_url(model["base_url"]):
            erreurs.append(f"{rel} : model.base_url doit être une URL http(s)")

    # --- agent ---------------------------------------------------------
    agent = data.get("agent")
    if not isinstance(agent, dict):
        erreurs.append(f"{rel} : section « agent » absente ou invalide")
    else:
        max_turns = agent.get("max_turns")
        if not isinstance(max_turns, int) or isinstance(max_turns, bool) or max_turns <= 0:
            erreurs.append(f"{rel} : agent.max_turns doit être un entier positif")

    # --- platform_toolsets ---------------------------------------------
    toolsets = (data.get("platform_toolsets") or {}).get("cli")
    if not isinstance(toolsets, list) or not toolsets:
        erreurs.append(f"{rel} : platform_toolsets.cli doit être une liste non vide")
    elif not all(isinstance(t, str) and t.strip() for t in toolsets):
        erreurs.append(f"{rel} : platform_toolsets.cli ne doit contenir que des chaînes non vides")

    # --- plugins -------------------------------------------------------
    if "plugins" in data:
        plugins = data.get("plugins")
        if not isinstance(plugins, dict) or not isinstance(plugins.get("enabled"), list):
            erreurs.append(f"{rel} : plugins.enabled doit être une liste")

    # --- _config_version -----------------------------------------------
    version = data.get("_config_version")
    if not isinstance(version, int) or isinstance(version, bool):
        erreurs.append(f"{rel} : _config_version doit être un entier")

    # --- mcp_servers ---------------------------------------------------
    serveurs = data.get("mcp_servers")
    if serveurs is not None and not isinstance(serveurs, dict):
        erreurs.append(f"{rel} : mcp_servers doit être un mapping")
    elif isinstance(serveurs, dict):
        for nom, serveur in serveurs.items():
            prefixe = f"{rel} : mcp_servers.{nom}"
            if not isinstance(serveur, dict):
                erreurs.append(f"{prefixe} doit être un mapping")
                continue
            if not est_url(serveur.get("url")):
                erreurs.append(f"{prefixe}.url doit être une URL http(s)")
            auth = serveur.get("auth")
            if not isinstance(auth, str) or not auth.strip():
                erreurs.append(f"{prefixe}.auth est obligatoire (mode d'authentification vide)")
            elif auth == "oauth":
                timeout = (serveur.get("oauth") or {}).get("timeout")
                if not isinstance(timeout, int) or isinstance(timeout, bool) or timeout <= 0:
                    erreurs.append(f"{prefixe}.oauth.timeout doit être un entier positif")

    # --- secrets en clair ----------------------------------------------
    for chemin_chaine, valeur in iter_chaines(data):
        if not isinstance(valeur, str) or not valeur.strip():
            continue
        if PLACEHOLDER.search(valeur):
            continue
        nom = ".".join(chemin_chaine) or "<racine>"
        if CLE_SECRET.search(nom):
            erreurs.append(f"{rel} : {nom} — valeur en clair pour une clé de type secret")
        elif VALEUR_SECRET.search(valeur):
            erreurs.append(f"{rel} : {nom} — valeur ressemblant à un secret")


def main() -> int:
    dans_actions = os.environ.get("GITHUB_ACTIONS") == "true"
    if not PROFILS.is_dir():
        print(f"ERREUR : dossier « {PROFILS} » introuvable")
        return 1
    fichiers = sorted(PROFILS.rglob("config.yaml"))
    if not fichiers:
        print("ERREUR : aucun profiles/**/config.yaml trouvé")
        return 1

    erreurs: list[str] = []
    for fichier in fichiers:
        verifier_config(fichier, erreurs)

    for erreur in erreurs:
        print(f"::error::{erreur}" if dans_actions else f"ERREUR : {erreur}")

    if erreurs:
        print(f"\nÉCHEC : {len(erreurs)} problème(s) sur {len(fichiers)} profil(s).")
        return 1
    print(f"OK : {len(fichiers)} profil(s) validé(s), aucun secret en clair.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
