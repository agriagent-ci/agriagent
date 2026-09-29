#!/usr/bin/env bash
# Vérifie que chaque action référencée dans les workflows est épinglée à un
# SHA de commit complet (40 caractères hexadécimaux).
#
# Un tag ou une branche peut être déplacé par le propriétaire de l'action :
# c'est un vecteur d'exécution de code arbitraire dans la CI. GitHub permet
# d'imposer l'épinglage au niveau du dépôt, mais ce réglage est refusé ici
# (policy gérée au niveau de l'organisation) : ce contrôle le remplace.
#
# Usage : scripts/verifier_epinglage.sh [dossier des workflows]
# Sans argument, le dossier est résolu par rapport à la racine du dépôt
# (le script fonctionne donc quel que soit le répertoire courant).

set -euo pipefail

racine="$(cd "$(dirname "$0")/.." && pwd)"
dossier="${1:-$racine/.github/workflows}"
echec=0

fichiers="$(ls "$dossier"/*.yml "$dossier"/*.yaml 2>/dev/null || true)"
if [ -z "$fichiers" ]; then
  echo "ERREUR : aucun workflow trouvé dans « $dossier »." >&2
  exit 1
fi

for fichier in $fichiers; do
  while IFS= read -r ligne; do
    [ -n "$ligne" ] || continue
    numero="${ligne%% *}"
    # Retire le commentaire de fin de ligne et les espaces de fin.
    entree="$(printf '%s' "${ligne#* }" | sed -E 's/[[:space:]]*#.*$//; s/[[:space:]]+$//')"
    [ -n "$entree" ] || continue

    # Action locale du dépôt : rien à épingler.
    case "$entree" in
      ./*) continue ;;
    esac

    ref="${entree#*@}"
    if [ "$ref" = "$entree" ]; then
      ref=""
    fi

    if printf '%s' "$ref" | grep -qE '^[0-9a-f]{40}$'; then
      echo "OK     $fichier:$numero  $entree"
    else
      echo "ERREUR $fichier:$numero  « $entree » n'est pas épinglée à un SHA complet"
      echo "::error file=$fichier,line=$numero::action non épinglée à un SHA complet : $entree"
      echec=1
    fi
  done < <(grep -nE '^[[:space:]]*(-[[:space:]]*)?uses:' "$fichier" |
    sed -E 's/^([0-9]+):[[:space:]]*(-[[:space:]]*)?uses:[[:space:]]*/\1 /')
done

if [ "$echec" -ne 0 ]; then
  echo
  echo "ÉCHEC : au moins une action n'est pas épinglée à un SHA complet."
  exit 1
fi

echo
echo "OK : toutes les actions des workflows sont épinglées à un SHA complet."
