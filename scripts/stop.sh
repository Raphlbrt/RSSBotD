#!/bin/bash

# Script d'arrêt du bot Discord RSS

set -e

# Variables
BOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="/var/log/discord-bots/rss-bot.log"
PID_FILE="$BOT_DIR/bot.pid"

# Fonction de logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

cd "$BOT_DIR"

log "🛑 Arrêt du bot RSS Discord..."

# Vérifier si le fichier PID existe
if [ ! -f "$PID_FILE" ]; then
    log "⚠️ Fichier PID introuvable. Le bot ne semble pas fonctionner."
    exit 1
fi

# Lire le PID
BOT_PID=$(cat "$PID_FILE")

# Vérifier si le processus existe
if ! kill -0 "$BOT_PID" 2>/dev/null; then
    log "⚠️ Le processus PID $BOT_PID n'existe pas."
    rm "$PID_FILE"
    exit 1
fi

# Arrêter le bot proprement
log "⏹️ Arrêt du bot (PID: $BOT_PID)..."
kill "$BOT_PID"

# Attendre que le processus se termine
timeout=15
while kill -0 "$BOT_PID" 2>/dev/null && [ $timeout -gt 0 ]; do
    sleep 1
    ((timeout--))
done

# Forcer l'arrêt si nécessaire
if kill -0 "$BOT_PID" 2>/dev/null; then
    log "🔨 Arrêt forcé du bot"
    kill -9 "$BOT_PID"
fi

# Supprimer le fichier PID
rm "$PID_FILE"

log "✅ Bot arrêté avec succès"