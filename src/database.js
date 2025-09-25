const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'data', 'rss_bot.db');
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Erreur lors de l\'ouverture de la base de données:', err);
                    reject(err);
                } else {
                    console.log('✅ Base de données SQLite connectée');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            const sql = `
                CREATE TABLE IF NOT EXISTS rss_feeds (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    url TEXT NOT NULL,
                    name TEXT NOT NULL,
                    channel_id TEXT NOT NULL,
                    last_check DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(url, channel_id)
                )
            `;

            this.db.run(sql, (err) => {
                if (err) {
                    console.error('Erreur lors de la création des tables:', err);
                    reject(err);
                } else {
                    console.log('✅ Tables de base de données créées/vérifiées');
                    resolve();
                }
            });
        });
    }

    async addFeed(url, name, channelId) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO rss_feeds (url, name, channel_id) VALUES (?, ?, ?)`;

            this.db.run(sql, [url, name, channelId], function(err) {
                if (err) {
                    if (err.code === 'SQLITE_CONSTRAINT') {
                        reject(new Error('Ce flux RSS est déjà configuré pour ce salon'));
                    } else {
                        reject(err);
                    }
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async removeFeed(feedId, channelId) {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM rss_feeds WHERE id = ? AND channel_id = ?`;

            this.db.run(sql, [feedId, channelId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    async getFeeds(channelId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM rss_feeds WHERE channel_id = ? ORDER BY created_at DESC`;

            this.db.all(sql, [channelId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getAllFeeds() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM rss_feeds ORDER BY last_check ASC`;

            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async updateLastCheck(feedId, lastCheck) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE rss_feeds SET last_check = ? WHERE id = ?`;

            this.db.run(sql, [lastCheck.toISOString(), feedId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Erreur lors de la fermeture de la base de données:', err);
                } else {
                    console.log('🔌 Base de données fermée');
                }
            });
        }
    }
}

module.exports = Database;