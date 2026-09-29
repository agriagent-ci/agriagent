# Politique de sécurité — AgriAgent

## Versions supportées

| Version | Supportée |
|---|---|
| 4.x | ✅ |
| 3.x | ⚠️ |
| 2.x | ❌ |
| 1.x | ❌ |

## Signaler une vulnérabilité

**Ne créez PAS d'issue publique pour signaler une vulnérabilité.**

Utilisez plutôt :

1. **GitHub Security Advisories** :
   https://github.com/agriagent-ci/agriagent/security/advisories/new

2. **Email** : kouamefanuel4@gmail.com

### Ce qu'il faut inclure

- Description de la vulnérabilité
- Étapes pour la reproduire
- Impact potentiel
- Suggestion de correction (si possible)

### Délai de réponse

- **Accusé de réception** : 48h
- **Évaluation** : 7 jours
- **Correction** : selon la gravité

## Bonnes pratiques pour les contributeurs

- ❌ **Ne jamais commiter** de clés API, tokens ou mots de passe
- ✅ Utiliser des variables d'environnement
- ✅ Activer Push Protection sur votre fork
- ✅ Signer vos commits (optionnel)

## Outils de sécurité activés

État vérifié par API le 2026-09-29 :

| Module | État |
|---|---|
| Secret scanning | ✅ Activé |
| Secret scanning — push protection | ✅ Activé |
| Dependabot alerts | ✅ Activé |
| Dependabot security updates | ✅ Activé |
| Private vulnerability reporting | ✅ Activé |
| Protection de la branche `main` | ✅ Activée : pull request obligatoire, force-push et suppression de branche interdits, résolution des conversations requise |
| Permissions GitHub Actions par défaut | ✅ Restreintes en lecture (`read`), approbation de PR par Actions désactivée |
| Code scanning (CodeQL) | ⚠️ Non applicable : le dépôt ne contient aucun langage analysable par CodeQL (uniquement YAML, SQL et Markdown). À activer dès que du code applicatif est ajouté. |
| Secret scanning — patterns hors fournisseurs et validity checks | ❌ Refusé par le plan Free de l'organisation : nécessite GitHub Secret Protection (Team/Enterprise) |

Les alertes Dependabot et les mises à jour de sécurité ne dépendent pas de
`.github/dependabot.yml` : ce fichier ne pilote que les mises à jour de version.

## Intégration continue

Le workflow `.github/workflows/securite.yml` s'exécute sur chaque pull request,
sur `main` et une fois par semaine. Ses trois contrôles sont des statuts requis
pour fusionner dans `main` :

| Contrôle | Objet |
|---|---|
| `secrets-scan` | recherche d'identifiants dans le code et l'historique (TruffleHog) |
| `configs-validation` | structure des `profiles/**/config.yaml` et absence de secret en clair (`scripts/validate_profiles.py`) |
| `sql-syntax` | syntaxe PostgreSQL des fichiers `sql/*.sql` (sqlfluff) |
| `actions-pinning` | épinglage de chaque action de workflow à un SHA complet (`scripts/verifier_epinglage.sh`) |

Les actions tierces utilisées sont épinglées à un SHA complet, que Dependabot
met à jour chaque semaine. Le réglage de dépôt `sha_pinning_required` de GitHub
est refusé ici (la politique Actions est gérée au niveau de l'organisation) :
le contrôle `actions-pinning` remplit ce rôle et bloque toute pull request qui
introduirait un tag ou une branche à la place d'un SHA.

## Contact

Attowla Charles Fanuel Kouamé
Email : kouamefanuel4@gmail.com
