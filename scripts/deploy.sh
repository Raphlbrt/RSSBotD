#!/bin/bash

# Script de déploiement automatique pour le bot Discord RSS
# Ce script est exécuté par le webhook GitHub

set -e

echo "🔄 Début du déploiement automatique..."

# Variables
BOT_DIR="/path/to/your/bot/directory"  # À modifier selon votre installation
BOT_NAME="rss-bot-discord"
LOG_FILE="/var/log/discord-bots/rss-bot-deploy.log"

# Fonction de logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Créer le répertoire de logs s'il n'existe pas
mkdir -p "$(dirname "$LOG_FILE")"

log "🔄 Déploiement démarré"

# Aller dans le répertoire du bot
cd "$BOT_DIR"

# Sauvegarder l'ancien processus PID s'il existe
OLD_PID=""
if [ -f "bot.pid" ]; then
    OLD_PID=$(cat bot.pid)
    log "📝 PID du bot actuel: $OLD_PID"
fi

# Pull des dernières modifications
log "📥 Pull des modifications Git..."
git pull origin main

# Installation/mise à jour des dépendances
log "📦 Installation des dépendances..."
npm install --production

# Arrêter l'ancien processus s'il existe
if [ ! -z "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    log "⏹️ Arrêt du bot (PID: $OLD_PID)"
    kill "$OLD_PID"

    # Attendre que le processus se termine
    timeout=10
    while kill -0 "$OLD_PID" 2>/dev/null && [ $timeout -gt 0 ]; do
        sleep 1
        ((timeout--))
    done

    # Forcer l'arrêt si nécessaire
    if kill -0 "$OLD_PID" 2>/dev/null; then
        log "🔨 Arrêt forcé du bot"
        kill -9 "$OLD_PID"
    fi
fi

# Démarrer le nouveau bot
log "🚀 Démarrage du nouveau bot..."
nohup npm start > "/var/log/discord-bots/rss-bot.log" 2>&1 &
NEW_PID=$!

# Sauvegarder le nouveau PID
echo $NEW_PID > bot.pid
log "✅ Nouveau bot démarré (PID: $NEW_PID)"

# Vérifier que le bot fonctionne
sleep 5
if kill -0 "$NEW_PID" 2>/dev/null; then
    log "✅ Déploiement réussi! Bot opérationnel."
else
    log "❌ Erreur: Le bot ne semble pas fonctionner"
    exit 1
fi