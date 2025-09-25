const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class GitPoller {
    constructor(interval = 60000) { // 1 minute par défaut
        this.interval = interval;
        this.isRunning = false;
        this.lastCommit = null;
        this.botDir = process.cwd();
    }

    async init() {
        console.log('🔄 Initialisation du Git Poller...');

        // Obtenir le commit actuel
        this.lastCommit = await this.getCurrentCommit();
        console.log(`📍 Commit actuel: ${this.lastCommit}`);

        this.start();
    }

    async getCurrentCommit() {
        return new Promise((resolve, reject) => {
            exec('git rev-parse HEAD', (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    async fetchChanges() {
        return new Promise((resolve, reject) => {
            exec('git fetch origin main', (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    async getRemoteCommit() {
        return new Promise((resolve, reject) => {
            exec('git rev-parse origin/main', (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    async deployUpdates() {
        const scriptPath = path.join(this.botDir, 'scripts', 'deploy.sh');

        console.log('🚀 Déploiement des mises à jour...');

        return new Promise((resolve, reject) => {
            exec(`bash ${scriptPath}`, (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ Erreur de déploiement:', error);
                    reject(error);
                } else {
                    console.log('✅ Déploiement réussi:', stdout);
                    resolve(stdout);
                }
            });
        });
    }

    async checkForUpdates() {
        try {
            // Récupérer les dernières modifications du remote
            await this.fetchChanges();

            // Obtenir le commit distant
            const remoteCommit = await this.getRemoteCommit();

            // Comparer avec le commit local
            if (remoteCommit !== this.lastCommit) {
                console.log(`🔄 Nouveau commit détecté: ${remoteCommit.substring(0, 8)}`);

                // Déployer les mises à jour
                await this.deployUpdates();

                // Mettre à jour le commit local
                this.lastCommit = remoteCommit;

                console.log('✅ Mise à jour terminée');
            } else {
                console.log('✓ Aucune mise à jour disponible');
            }
        } catch (error) {
            console.error('❌ Erreur lors de la vérification des mises à jour:', error.message);
        }
    }

    start() {
        if (this.isRunning) {
            console.log('⚠️ Le poller Git fonctionne déjà');
            return;
        }

        this.isRunning = true;
        console.log(`⏰ Git Poller démarré (vérification toutes les ${this.interval / 1000}s)`);

        this.intervalId = setInterval(async () => {
            await this.checkForUpdates();
        }, this.interval);
    }

    stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        clearInterval(this.intervalId);
        console.log('⏹️ Git Poller arrêté');
    }
}

// Démarrage automatique si ce fichier est exécuté directement
if (require.main === module) {
    const poller = new GitPoller(60000); // Vérification toutes les minutes

    poller.init().catch(error => {
        console.error('❌ Erreur d\'initialisation du Git Poller:', error);
        process.exit(1);
    });

    // Gestion propre de l'arrêt
    process.on('SIGINT', () => {
        console.log('\n🛑 Arrêt du Git Poller...');
        poller.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n🛑 Arrêt du Git Poller...');
        poller.stop();
        process.exit(0);
    });
}

module.exports = GitPoller;