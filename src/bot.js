const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const RSSParser = require('rss-parser');
const Database = require('./database.js');
const GitPoller = require('./git-poller.js');
const GeminiAnalyzer = require('./ai-analyzer-gemini.js');
const cron = require('node-cron');
require('dotenv').config();

class RSSBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMessageReactions
            ]
        });
        this.parser = new RSSParser();
        this.db = new Database();
        this.gitPoller = new GitPoller();
        this.aiAnalyzer = new GeminiAnalyzer();
    }

    async init() {
        await this.db.init();
        this.setupEvents();
        this.setupCommands();
        this.startRSSCheck();

        // Démarrer le Git Poller si activé
        if (process.env.ENABLE_AUTO_DEPLOY === 'true') {
            await this.gitPoller.init();
        }

        await this.client.login(process.env.DISCORD_TOKEN);
    }

    setupEvents() {
        this.client.once('ready', () => {
            console.log(`✅ Bot connecté en tant que ${this.client.user.tag}`);
        });

        this.client.on('interactionCreate', async interaction => {
            if (!interaction.isChatInputCommand()) return;

            const { commandName } = interaction;

            try {
                switch (commandName) {
                    case 'rss-add':
                        await this.handleAddRSS(interaction);
                        break;
                    case 'rss-remove':
                        await this.handleRemoveRSS(interaction);
                        break;
                    case 'rss-list':
                        await this.handleListRSS(interaction);
                        break;
                    case 'rss-test':
                        await this.handleTestRSS(interaction);
                        break;
                    case 'rss-forum':
                        await this.handleSetForumChannel(interaction);
                        break;
                    case 'rss-health':
                        await this.handleHealthCheck(interaction);
                        break;
                }
            } catch (error) {
                console.error('Erreur lors de la commande:', error);
                const errorMessage = { content: '❌ Une erreur s\'est produite lors de l\'exécution de la commande.', ephemeral: true };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        });

        // Gestion des réactions pour l'analyse IA
        this.client.on('messageReactionAdd', async (reaction, user) => {
            if (user.bot) return;

            // Si c'est la réaction 🧠 sur un embed RSS
            if (reaction.emoji.name === '🧠' && reaction.message.embeds.length > 0) {
                await this.handleAIAnalysisRequest(reaction, user);
            }
        });
    }

    setupCommands() {
        const commands = [
            {
                name: 'rss-add',
                description: 'Ajouter un flux RSS à ce salon',
                options: [
                    {
                        name: 'url',
                        description: 'URL du flux RSS',
                        type: 3,
                        required: true
                    },
                    {
                        name: 'nom',
                        description: 'Nom du flux (optionnel)',
                        type: 3,
                        required: false
                    }
                ]
            },
            {
                name: 'rss-remove',
                description: 'Supprimer un flux RSS de ce salon',
                options: [
                    {
                        name: 'id',
                        description: 'ID du flux à supprimer',
                        type: 4,
                        required: true
                    }
                ]
            },
            {
                name: 'rss-list',
                description: 'Lister tous les flux RSS de ce salon'
            },
            {
                name: 'rss-test',
                description: 'Tester un flux RSS',
                options: [
                    {
                        name: 'url',
                        description: 'URL du flux RSS à tester',
                        type: 3,
                        required: true
                    }
                ]
            },
            {
                name: 'rss-forum',
                description: 'Configurer le salon de destination pour les posts forum',
                options: [
                    {
                        name: 'salon',
                        description: 'Salon où publier les analyses IA',
                        type: 7,
                        required: true
                    }
                ]
            },
            {
                name: 'rss-health',
                description: 'Vérifier le statut de l\'IA Gemini'
            }
        ];

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

        (async () => {
            try {
                console.log('🔄 Déploiement des commandes slash...');
                await rest.put(
                    Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
                    { body: commands }
                );
                console.log('✅ Commandes slash déployées avec succès!');
            } catch (error) {
                console.error('❌ Erreur lors du déploiement des commandes:', error);
            }
        })();
    }

    async handleAddRSS(interaction) {
        const url = interaction.options.getString('url');
        const nom = interaction.options.getString('nom');
        const channelId = interaction.channel.id;

        await interaction.deferReply();

        try {
            const feed = await this.parser.parseURL(url);
            const feedName = nom || feed.title || 'Flux RSS';

            const feedId = await this.db.addFeed(url, feedName, channelId);

            const embed = new EmbedBuilder()
                .setColor(0x00AE86)
                .setTitle('✅ Flux RSS ajouté')
                .setDescription(`**${feedName}** a été ajouté à ce salon`)
                .addFields(
                    { name: 'URL', value: url, inline: false },
                    { name: 'ID', value: feedId.toString(), inline: true },
                    { name: 'Articles trouvés', value: feed.items.length.toString(), inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Erreur lors de l\'ajout du flux:', error);
            await interaction.editReply({ content: '❌ Impossible d\'ajouter ce flux RSS. Vérifiez l\'URL.' });
        }
    }

    async handleRemoveRSS(interaction) {
        const feedId = interaction.options.getInteger('id');
        const channelId = interaction.channel.id;

        const success = await this.db.removeFeed(feedId, channelId);

        if (success) {
            await interaction.reply({ content: `✅ Flux RSS #${feedId} supprimé de ce salon.`, ephemeral: true });
        } else {
            await interaction.reply({ content: '❌ Flux RSS introuvable ou vous n\'avez pas les permissions.', ephemeral: true });
        }
    }

    async handleListRSS(interaction) {
        const channelId = interaction.channel.id;
        const feeds = await this.db.getFeeds(channelId);

        if (feeds.length === 0) {
            await interaction.reply({ content: '📭 Aucun flux RSS configuré pour ce salon.', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📰 Flux RSS configurés')
            .setDescription(`${feeds.length} flux RSS actifs dans ce salon`)
            .setTimestamp();

        feeds.forEach(feed => {
            embed.addFields({
                name: `#${feed.id} - ${feed.name}`,
                value: `[${feed.url}](${feed.url})`,
                inline: false
            });
        });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    async handleTestRSS(interaction) {
        const url = interaction.options.getString('url');

        await interaction.deferReply({ ephemeral: true });

        try {
            const feed = await this.parser.parseURL(url);
            const latestItem = feed.items[0];

            if (!latestItem) {
                await interaction.editReply({ content: '❌ Aucun article trouvé dans ce flux.' });
                return;
            }

            const embed = this.createArticleEmbed(latestItem, feed.title);
            await interaction.editReply({ content: '✅ Test du flux RSS - Dernier article:', embeds: [embed] });
        } catch (error) {
            console.error('Erreur lors du test:', error);
            await interaction.editReply({ content: '❌ Impossible de lire ce flux RSS. Vérifiez l\'URL.' });
        }
    }

    createArticleEmbed(item, feedTitle) {
        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle(item.title || 'Sans titre')
            .setURL(item.link || '')
            .setDescription(this.truncateText(item.contentSnippet || item.content || 'Aucun résumé disponible', 300))
            .setFooter({ text: `Source: ${feedTitle} • Réagissez avec 🧠 pour une analyse IA` })
            .setTimestamp(new Date(item.pubDate || Date.now()));

        return embed;
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    startRSSCheck() {
        cron.schedule('*/15 * * * *', async () => {
            console.log('🔄 Vérification des flux RSS...');
            await this.checkAllFeeds();
        });

        console.log('⏰ Vérification RSS programmée toutes les 15 minutes');
    }

    async checkAllFeeds() {
        const allFeeds = await this.db.getAllFeeds();

        for (const feed of allFeeds) {
            try {
                const parsedFeed = await this.parser.parseURL(feed.url);
                const latestItem = parsedFeed.items[0];

                if (!latestItem) continue;

                const itemDate = new Date(latestItem.pubDate || Date.now());
                const lastCheck = new Date(feed.last_check || 0);

                if (itemDate > lastCheck) {
                    const channel = await this.client.channels.fetch(feed.channel_id);
                    if (channel) {
                        const embed = this.createArticleEmbed(latestItem, feed.name);
                        const message = await channel.send({ embeds: [embed] });

                        // Ajouter automatiquement la réaction 🧠 pour l'analyse IA
                        await message.react('🧠');
                    }

                    await this.db.updateLastCheck(feed.id, itemDate);
                }
            } catch (error) {
                console.error(`Erreur lors de la vérification du flux ${feed.id}:`, error);
            }
        }
    }

    async handleSetForumChannel(interaction) {
        const channel = interaction.options.getChannel('salon');

        if (!channel.isTextBased()) {
            await interaction.reply({ content: '❌ Veuillez sélectionner un salon textuel.', ephemeral: true });
            return;
        }

        await this.db.setForumChannel(interaction.guild.id, channel.id);

        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle('✅ Salon forum configuré')
            .setDescription(`Les analyses IA seront publiées dans ${channel}`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    async handleAIAnalysisRequest(reaction, user) {
        try {
            const embed = reaction.message.embeds[0];
            if (!embed || !embed.url) return;

            const channel = reaction.message.channel;
            await channel.sendTyping();

            // Récupérer l'article original depuis l'embed
            const article = {
                title: embed.title,
                link: embed.url,
                pubDate: embed.timestamp,
                contentSnippet: embed.description
            };

            // Analyser l'article avec l'IA
            const fullContent = await this.aiAnalyzer.fetchFullArticle(article.link);
            const analysis = await this.aiAnalyzer.analyzeNews(article, fullContent);

            if (!analysis) {
                await channel.send({ content: `❌ ${user}, impossible d'analyser cet article.` });
                return;
            }

            // Générer le post formaté
            const forumPost = this.aiAnalyzer.formatForumPost(analysis, article.link);

            // Récupérer le salon forum configuré
            const forumChannelId = await this.db.getForumChannel(reaction.message.guild.id);

            if (!forumChannelId) {
                await channel.send({
                    content: `❌ ${user}, aucun salon forum configuré. Utilisez \`/rss-forum\` d'abord.`
                });
                return;
            }

            const forumChannel = await this.client.channels.fetch(forumChannelId);
            if (!forumChannel) {
                await channel.send({ content: `❌ ${user}, salon forum non trouvé.` });
                return;
            }

            // Publier l'analyse dans le salon forum
            const forumEmbed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`📚 ${forumPost.title}`)
                .setDescription(forumPost.content.substring(0, 4096))
                .setURL(article.link)
                .setFooter({ text: `Analysé par IA • Demandé par ${user.displayName}` })
                .setTimestamp();

            await forumChannel.send({ embeds: [forumEmbed] });

            // Confirmation
            await channel.send({
                content: `✅ ${user}, analyse IA publiée dans ${forumChannel} !`
            });

        } catch (error) {
            console.error('Erreur lors de l\'analyse IA:', error);
            await reaction.message.channel.send({
                content: `❌ ${user}, erreur lors de l'analyse IA.`
            });
        }
    }

    async handleHealthCheck(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const health = await this.aiAnalyzer.healthCheck();

            const embed = new EmbedBuilder()
                .setTitle('🏥 État du système IA')
                .setTimestamp();

            if (health.status === 'ok') {
                embed.setColor(0x00AE86)
                    .setDescription('✅ Google Gemini fonctionnel')
                    .addFields({ name: 'Status', value: health.message });
            } else if (health.status === 'disabled') {
                embed.setColor(0xFFA500)
                    .setDescription('⚠️ IA désactivée')
                    .addFields({ name: 'Raison', value: health.message });
            } else {
                embed.setColor(0xFF0000)
                    .setDescription('❌ Problème avec l\'IA')
                    .addFields({ name: 'Erreur', value: health.message.substring(0, 1000) });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Erreur handleHealthCheck:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Erreur lors du test IA', ephemeral: true });
            }
        }
    }
}

const bot = new RSSBot();
bot.init().catch(console.error);