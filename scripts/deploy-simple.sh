#!/bin/bash

# Script de déploiement simple sans webhook
# À utiliser quand les ports externes ne sont pas disponibles

set -e

echo "🔄 Déploiement simple du bot RSS..."

# Variables
BOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="/var/log/discord-bots/rss-bot-deploy.log"

# Fonction de logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Créer le répertoire de logs s'il n'existe pas
mkdir -p "$(dirname "$LOG_FILE")"

cd "$BOT_DIR"

log "🔄 Déploiement simple démarré"

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