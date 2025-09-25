const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const path = require('path');

class WebhookServer {
    constructor(port = process.env.PORT || 3000) {
        this.app = express();
        this.port = port;
        this.secret = process.env.GITHUB_SECRET;

        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.json());

        this.app.use('/webhook', (req, res, next) => {
            const signature = req.get('x-hub-signature-256');
            const payload = JSON.stringify(req.body);

            if (!this.verifySignature(payload, signature)) {
                return res.status(401).json({ error: 'Signature invalide' });
            }

            next();
        });
    }

    setupRoutes() {
        this.app.post('/webhook', (req, res) => {
            const { ref, repository } = req.body;

            if (ref === 'refs/heads/main' || ref === 'refs/heads/master') {
                console.log(`🔄 Push détecté sur ${repository.name}`);
                this.deployBot();
                res.json({ status: 'Déploiement en cours...' });
            } else {
                res.json({ status: 'Branch ignorée' });
            }
        });

        this.app.get('/health', (req, res) => {
            res.json({ status: 'OK', timestamp: new Date().toISOString() });
        });
    }

    verifySignature(payload, signature) {
        if (!this.secret || !signature) {
            return false;
        }

        const hmac = crypto.createHmac('sha256', this.secret);
        hmac.update(payload);
        const calculatedSignature = `sha256=${hmac.digest('hex')}`;

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(calculatedSignature)
        );
    }

    deployBot() {
        const scriptPath = path.join(__dirname, '..', 'scripts', 'deploy.sh');

        console.log('🚀 Début du déploiement automatique...');

        exec(`bash ${scriptPath}`, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Erreur de déploiement:', error);
                return;
            }

            if (stderr) {
                console.error('⚠️ Avertissements:', stderr);
            }

            console.log('✅ Déploiement terminé:', stdout);
        });
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`🌐 Serveur webhook démarré sur le port ${this.port}`);
        });
    }
}

if (require.main === module) {
    require('dotenv').config();
    const server = new WebhookServer();
    server.start();
}

module.exports = WebhookServer;