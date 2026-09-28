# AGRIAGENT — Guide de déploiement VPS

**Version :** 1.0
**Date :** 28 septembre 2026
**Objet :** Procédure complète pour déployer AgriAgent sur un VPS.

---

## 1. Prérequis

- Un VPS Contabo (Cloud VPS Plus 4 recommandé : 4 vCPU / 8 GB RAM / 100 GB SSD)
- Ubuntu 24.04 LTS
- Une clé DeepSeek (`sk-...`)
- Un compte Supabase avec le projet `AgriAgent` (ref `kzuigdvxgqbtamgyxgbh`)

## 2. Installation de Hermes

```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Créer un utilisateur dédié
sudo adduser hermes
sudo usermod -aG sudo hermes
su - hermes

# Installer Hermes
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
source ~/.bashrc
hermes --version
