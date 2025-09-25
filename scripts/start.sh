#!/bin/bash

# Script de démarrage du bot Discord RSS

set -e

# Variables
BOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="/var/log/discord-bots"
LOG_FILE="$LOG_DIR/rss-bot.log"
PID_FILE="$BOT_DIR/bot.pid"

# Créer les répertoires de logs
sudo mkdir -p "$LOG_DIR"
sudo chown $USER:$USER "$LOG_DIR"

# Fonction de logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Aller dans le répertoire du bot
cd "$BOT_DIR"

log "🚀 Démarrage du bot RSS Discord..."

# Vérifier si le bot fonctionne déjà
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        log "⚠️ Le bot fonctionne déjà (PID: $OLD_PID)"
        exit 1
    else
        log "🧹 Suppression de l'ancien fichier PID"
        rm "$PID_FILE"
    fi
fi

# Vérifier que les dépendances sont installées
if [ ! -d "node_modules" ]; then
    log "📦 Installation des dépendances..."
    npm install
fi

# Vérifier que le fichier .env existe
if [ ! -f ".env" ]; then
    log "❌ Fichier .env manquant! Copiez .env.example vers .env et configurez vos tokens."
    exit 1
fi

# Démarrer le bot
log "🔄 Démarrage en cours..."
nohup npm start >> "$LOG_FILE" 2>&1 &
BOT_PID=$!

# Sauvegarder le PID
echo $BOT_PID > "$PID_FILE"

log "✅ Bot démarré avec succès (PID: $BOT_PID)"
log "📋 Pour voir les logs: tail -f $LOG_FILE"
log "🛑 Pour arrêter le bot: $BOT_DIR/scripts/stop.sh"