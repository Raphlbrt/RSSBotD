# 🤖 Bot Discord RSS

Bot Discord permettant de gérer des flux RSS avec des commandes slash et un déploiement automatique (avec ou sans webhooks).

## ✨ Fonctionnalités

- 📰 Ajout/suppression de flux RSS par salon Discord
- 🔄 Vérification automatique des nouveaux articles (toutes les 15 minutes)
- 📋 Liste des flux RSS configurés par salon
- 🧪 Test de flux RSS avant ajout
- 📱 Embeds Discord élégants pour les articles
- 🧠 **Analyse IA d'actualités avec génération de posts forum éducatifs**
- 📚 Système de réactions pour déclencher l'analyse automatique
- 🚀 **Déploiement automatique SANS ports externes** (polling Git)
- 🌐 Alternative webhook pour serveurs avec ports ouverts
- 💾 Base de données SQLite pour la persistance

## 🛠️ Installation sur Proxmox CT

### Prérequis

- Container Proxmox avec Ubuntu/Debian
- Node.js 16+ installé
- npm installé
- Git installé
- Accès sudo pour créer des répertoires de logs

### 1. Préparation du serveur

```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation de Node.js (si pas déjà fait)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installation de Git (si pas déjà fait)
sudo apt install git -y

# Création de l'utilisateur dédié (optionnel mais recommandé)
sudo useradd -m -s /bin/bash discordbot
sudo usermod -aG sudo discordbot
```

### 2. Clone du projet

```bash
# Se connecter en tant qu'utilisateur discordbot (ou votre utilisateur)
sudo su - discordbot

# Cloner le repository
git clone https://github.com/VOTRE_USERNAME/RSSBotD.git
cd RSSBotD

# Installation des dépendances
npm install
```

### 3. Configuration

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer la configuration
nano .env
```

Configurer le fichier `.env` :
```env
DISCORD_TOKEN=votre_token_discord_ici
DISCORD_CLIENT_ID=votre_client_id_discord_ici

# IA pour l'analyse d'actualités (REQUIS pour la fonction forum)
OPENAI_API_KEY=votre_cle_openai_ici

# Déploiement automatique (SANS ports externes - recommandé)
ENABLE_AUTO_DEPLOY=true
GIT_CHECK_INTERVAL=60000

# Optionnel : Webhook (seulement si vous pouvez ouvrir le port 3000)
# GITHUB_SECRET=votre_secret_webhook_github_ici
# PORT=3000
```

### 3.1. Configuration Google Gemini (IA GRATUITE pour l'analyse)

1. Aller sur [Google AI Studio](https://aistudio.google.com)
2. Se connecter avec votre compte Google
3. Cliquer sur "Create API key"
4. Copier la clé dans `GEMINI_API_KEY`

✅ **Avantages** :
- **Totalement gratuit** (15 requêtes/minute)
- **Pas de carte bancaire** requise
- **Excellent** pour l'analyse d'actualités
- **Multimodal** (texte + images)

### 4. Configuration Discord

1. Aller sur [Discord Developer Portal](https://discord.com/developers/applications)
2. Créer une nouvelle application
3. Aller dans \"Bot\" et créer un bot
4. Copier le token dans `DISCORD_TOKEN`
5. Copier l'Application ID dans `DISCORD_CLIENT_ID`
6. Dans \"OAuth2\" > \"URL Generator\" :
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`

### 5. Préparation des scripts

```bash
# Rendre les scripts exécutables
chmod +x scripts/*.sh

# Modifier le chemin dans deploy-simple.sh (déploiement sans ports)
nano scripts/deploy-simple.sh
# OU dans deploy.sh si vous utilisez les webhooks

# Créer les répertoires nécessaires
sudo mkdir -p /var/log/discord-bots
sudo chown $USER:$USER /var/log/discord-bots
mkdir -p data
```

### 6. Démarrage initial

```bash
# Premier démarrage
./scripts/start.sh

# Vérifier les logs
tail -f /var/log/discord-bots/rss-bot.log

# Pour arrêter
./scripts/stop.sh
```

## 🚀 Déploiement Automatique

### Option 1: Polling Git (RECOMMANDÉ - Sans ports externes)

Le bot vérifie automatiquement les mises à jour Git toutes les minutes et se redémarre si nécessaire.

**Avantages :**
- ✅ Aucun port à ouvrir
- ✅ Fonctionne sur tous les serveurs
- ✅ Plus sécurisé

**Configuration :**
1. Dans `.env`, définir `ENABLE_AUTO_DEPLOY=true`
2. Le bot se met à jour automatiquement au démarrage

### Option 2: GitHub Webhook (Si vous pouvez ouvrir des ports)

**Configuration du webhook GitHub :**
1. Repository GitHub > Settings > Webhooks > Add webhook
2. Payload URL: `http://VOTRE_IP:3000/webhook`
3. Content type: `application/json`
4. Secret: votre `GITHUB_SECRET` du `.env`
5. Events: "Just the push event"

**Démarrage du serveur webhook :**
```bash
# Serveur webhook séparé
node src/webhook.js &

# Ou avec PM2
npm install -g pm2
pm2 start src/webhook.js --name "rss-webhook"
pm2 startup
pm2 save
```

**Test :**
```bash
curl http://localhost:3000/health
```

## 🚀 Utilisation automatisée avec systemd (Recommandé)

### 1. Créer le service pour le bot

```bash
sudo nano /etc/systemd/system/rss-discord-bot.service
```

```ini
[Unit]
Description=RSS Discord Bot
After=network.target

[Service]
Type=simple
User=discordbot
WorkingDirectory=/home/discordbot/RSSBotD
ExecStart=/usr/bin/node src/bot.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### 2. Créer le service pour le webhook

```bash
sudo nano /etc/systemd/system/rss-webhook.service
```

```ini
[Unit]
Description=RSS Bot GitHub Webhook
After=network.target

[Service]
Type=simple
User=discordbot
WorkingDirectory=/home/discordbot/RSSBotD
ExecStart=/usr/bin/node src/webhook.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### 3. Activer les services

```bash
sudo systemctl daemon-reload
sudo systemctl enable rss-discord-bot
sudo systemctl enable rss-webhook
sudo systemctl start rss-discord-bot
sudo systemctl start rss-webhook

# Vérifier le statut
sudo systemctl status rss-discord-bot
sudo systemctl status rss-webhook
```

## 📱 Commandes Discord

Une fois le bot ajouté à votre serveur :

### Commandes RSS de base
- `/rss-add <url> [nom]` - Ajouter un flux RSS au salon
- `/rss-remove <id>` - Supprimer un flux RSS du salon
- `/rss-list` - Lister tous les flux RSS du salon
- `/rss-test <url>` - Tester un flux RSS

### Commandes IA (Google Gemini GRATUIT)
- `/rss-forum <salon>` - Configurer le salon de destination pour les analyses IA
- `/rss-health` - Vérifier l'état de l'IA Gemini

### Utilisation de l'analyse IA
1. **Configuration** : Utilisez `/rss-forum #votre-salon-forum`
2. **Test** : `/rss-health` pour vérifier que Gemini fonctionne
3. **Déclenchement** : Réagissez avec 🧠 sur n'importe quel article RSS
4. **Analyse** : Le bot analyse l'article avec Google Gemini (gratuit!)
5. **Publication** : L'analyse est automatiquement publiée dans le salon forum

### ⚡ Mise à jour rapide vers Gemini (GRATUIT)

Si vous aviez OpenAI configuré :

```bash
# Sur votre serveur
cd /home/botdiscord/RSSBotD

# Mettre à jour les dépendances
npm install @google/generative-ai
npm uninstall openai

# Dans .env, remplacer OPENAI_API_KEY par :
echo "GEMINI_API_KEY=votre_cle_gemini" >> .env

# Redémarrer
./scripts/stop.sh && ./scripts/start.sh

# Tester
# Discord: /rss-health
```

### Format de l'analyse IA générée
- **Analyse complète** : Qui, Quoi, Où, Comment, Quand, Conséquences
- **Source et fiabilité** : Présentation et évaluation de la source
- **Intérêt éducatif** : Pertinence pour les étudiants en informatique
- **Pistes de réflexion** : Points d'intérêt et liens avec les métiers
- **Questions d'approfondissement** : Pour stimuler les discussions

## 📁 Structure du projet

```
RSSBotD/
├── src/
│   ├── bot.js          # Bot principal avec IA
│   ├── database.js     # Gestion SQLite + tables forum
│   ├── ai-analyzer.js  # Analyseur IA d'actualités
│   ├── webhook.js      # Serveur webhook GitHub
│   └── git-poller.js   # Polling Git automatique
├── scripts/
│   ├── start.sh        # Script de démarrage
│   ├── stop.sh         # Script d'arrêt
│   ├── deploy.sh       # Script webhook
│   └── deploy-simple.sh # Script sans ports
├── data/               # Base de données SQLite
├── package.json        # Dépendances IA incluses
├── .env.example        # Config IA
└── README.md
```

## 🔧 Maintenance

### Logs

```bash
# Logs du bot
tail -f /var/log/discord-bots/rss-bot.log

# Logs systemd
sudo journalctl -u rss-discord-bot -f
sudo journalctl -u rss-webhook -f
```

### Mise à jour manuelle

**Avec auto-deploy activé (recommandé) :**
```bash
# Le bot se met à jour automatiquement, juste push sur GitHub !
git add .
git commit -m "Mise à jour"
git push origin main
# Le bot se redémarre automatiquement dans la minute
```

**Mise à jour manuelle traditionnelle :**
```bash
cd /home/discordbot/RSSBotD
git pull origin main
npm install
sudo systemctl restart rss-discord-bot
```

### Sauvegarde de la base de données

```bash
# Sauvegarde
cp data/rss_bot.db data/rss_bot.db.backup.$(date +%Y%m%d_%H%M%S)

# Automatiser avec cron
crontab -e
# Ajouter: 0 2 * * * cp /home/discordbot/RSSBotD/data/rss_bot.db /home/discordbot/RSSBotD/data/rss_bot.db.backup.$(date +\%Y\%m\%d)
```

## ❓ Dépannage

### Le bot ne démarre pas
1. Vérifier le fichier `.env`
2. Vérifier les logs : `tail -f /var/log/discord-bots/rss-bot.log`
3. Vérifier les permissions sur `/var/log/discord-bots`

### Le déploiement automatique ne fonctionne pas
1. Vérifier que `ENABLE_AUTO_DEPLOY=true` dans `.env`
2. Vérifier les logs : `tail -f /var/log/discord-bots/rss-bot.log`
3. Tester manuellement : `git fetch && git status`

### Le webhook ne fonctionne pas (Option 2 uniquement)
1. Vérifier que le port 3000 est accessible depuis Internet
2. Vérifier le secret GitHub dans `.env`
3. Tester : `curl http://VOTRE_IP:3000/health`

### Les flux RSS ne se mettent pas à jour
1. Vérifier les logs du bot
2. Tester manuellement un flux avec `/rss-test`
3. Vérifier la connectivité internet du container

## 🔒 Sécurité

- **Option 1 (Polling)** : Aucun port ouvert = Plus sécurisé
- **Option 2 (Webhook)** : Limitez l'accès au port 3000, changez le secret GitHub
- Utilisez un utilisateur dédié non-root
- Sauvegardez régulièrement la base de données
- Les tokens Discord ne sont jamais exposés

## 📝 Licence

MIT