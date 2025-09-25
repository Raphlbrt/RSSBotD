const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const cheerio = require('cheerio');

class GeminiAnalyzer {
    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            console.warn('⚠️ GEMINI_API_KEY non configuré. Analyse IA désactivée.');
            this.genAI = null;
            return;
        }

        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });

        console.log('✅ Google Gemini initialisé');
    }

    async fetchFullArticle(url) {
        try {
            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const $ = cheerio.load(response.data);

            // Supprimer les scripts, styles, et autres éléments non pertinents
            $('script, style, nav, header, footer, aside, .ads, .advertisement, .cookie').remove();

            // Extraire le contenu principal
            let content = '';
            const mainSelectors = [
                'article',
                'main',
                '.content',
                '.post-content',
                '.entry-content',
                '.article-content',
                '.story-body',
                'body'
            ];

            for (const selector of mainSelectors) {
                const element = $(selector).first();
                if (element.length && element.text().trim().length > 500) {
                    content = element.text().trim();
                    break;
                }
            }

            return this.cleanText(content);
        } catch (error) {
            console.error('Erreur lors de la récupération de l\'article:', error.message);
            return null;
        }
    }

    cleanText(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n')
            .replace(/[^\w\s\.,!?;:()\-'"àâäéèêëîïôöùûüÿçñ]/g, '') // Garder accents français
            .trim()
            .substring(0, 12000); // Limite généreuse pour Gemini
    }

    async analyzeNews(article, fullContent = null) {
        if (!this.genAI) {
            return this.createFallbackAnalysis(article);
        }

        try {
            const contentToAnalyze = fullContent || article.contentSnippet || article.content || '';

            const prompt = `
Tu es un assistant pédagogique spécialisé dans l'analyse d'actualités pour des étudiants en informatique.

ARTICLE À ANALYSER :
Titre: ${article.title}
URL: ${article.link}
Date: ${article.pubDate}
Contenu: ${contentToAnalyze}

MISSION : Créer un post de forum éducatif selon ces CONSIGNES STRICTES :

1. INFORMATIONS PRINCIPALES obligatoires :
   • QUI est concerné ? (personnes, entreprises, secteurs)
   • DE QUOI ça parle ? (sujet principal clairement défini)
   • OÙ ça se passe ? (lieu géographique ou virtuel)
   • COMMENT cela s'est produit ? (processus, méthodes)
   • QUAND est-ce arrivé ? (temporalité précise)
   • QUELLES conséquences ? (impacts actuels et futurs)
   • POURQUOI cette source est-elle fiable ? (crédibilité de l'éditeur)
   • POURQUOI c'est important pour des étudiants informatique ?

2. POUR LES COMMENTAIRES (suggestions) :
   • Points les plus intéressants de l'actualité
   • Liens avec les métiers informatiques et parcours académique
   • Connexions possibles avec d'autres actualités
   • Questions pour approfondir la réflexion

RÉPONDS UNIQUEMENT avec ce JSON exact (sans markdown, sans \`\`\`) :

{
  "post_principal": {
    "titre": "titre accrocheur et précis",
    "qui_concerne": "qui est concerné par cette actualité",
    "sujet": "de quoi ça parle exactement",
    "lieu": "où cela se déroule",
    "comment": "comment cela s'est produit",
    "quand": "quand cela s'est passé",
    "consequences": "quelles sont les conséquences",
    "source_fiabilite": "pourquoi faire confiance à cette source",
    "interet_classe": "pourquoi c'est intéressant pour étudiants informatique"
  },
  "commentaires_suggestions": {
    "points_interessants": "ce qui retient l'attention",
    "reflexion_metiers": "liens avec métiers informatique",
    "liens_actualites": "connexions avec autres sujets",
    "questions_approfondissement": ["question précise 1", "question précise 2", "question précise 3"]
  },
  "pertinence_score": 8.5,
  "mots_cles": ["mot1", "mot2", "mot3"]
}

IMPORTANT : Sois factuel, précis et éducatif. Adapte le niveau pour des étudiants informatique.
`;

            const result = await this.model.generateContent(prompt);
            const response = result.response;
            const analysisText = response.text();

            // Parser le JSON retourné
            try {
                // Nettoyer le texte au cas où il y aurait des backticks
                const cleanText = analysisText.replace(/```json|```/g, '').trim();
                const analysis = JSON.parse(cleanText);

                console.log('✅ Analyse Gemini générée avec succès');
                return analysis;
            } catch (parseError) {
                console.error('Erreur parsing JSON Gemini:', parseError);
                console.log('Réponse Gemini:', analysisText.substring(0, 500) + '...');
                return this.createFallbackAnalysis(article);
            }

        } catch (error) {
            console.error('Erreur Gemini:', error.message);

            // Gérer les limites de taux
            if (error.message.includes('quota') || error.message.includes('rate')) {
                console.warn('⚠️ Limite de taux Gemini atteinte, fallback activé');
            }

            return this.createFallbackAnalysis(article);
        }
    }

    createFallbackAnalysis(article) {
        const domain = new URL(article.link).hostname;

        return {
            post_principal: {
                titre: article.title || 'Actualité informatique',
                qui_concerne: "Secteur informatique et technologique",
                sujet: article.title || "Actualité technologique à analyser",
                lieu: "À préciser selon la source",
                comment: "Via publication sur " + domain,
                quand: article.pubDate || "Date récente",
                consequences: "Impact sur le secteur technologique à évaluer",
                source_fiabilite: `Source : ${domain} - Crédibilité à vérifier`,
                interet_classe: "Actualité du domaine informatique pertinente pour la veille technologique"
            },
            commentaires_suggestions: {
                points_interessants: "Sujet d'actualité technologique méritant analyse approfondie",
                reflexion_metiers: "Liens à établir avec les métiers du numérique",
                liens_actualites: "Connexions possibles avec les tendances tech actuelles",
                questions_approfondissement: [
                    "Quels sont les enjeux techniques de cette actualité ?",
                    "Comment cela impacte-t-il notre secteur d'activité ?",
                    "Quelles compétences développer en conséquence ?"
                ]
            },
            pertinence_score: 6.0,
            mots_cles: ["informatique", "technologie", "actualité"]
        };
    }

    formatForumPost(analysis, articleUrl) {
        const post = analysis.post_principal;

        return {
            title: post.titre,
            content: `# ${post.titre}

## 📋 Analyse complète de l'actualité

**👥 Qui est concerné ?**
${post.qui_concerne}

**📰 De quoi ça parle ?**
${post.sujet}

**📍 Où ça se passe ?**
${post.lieu}

**⚙️ Comment ?**
${post.comment}

**📅 Quand ?**
${post.quand}

**🎯 Conséquences ?**
${post.consequences}

## 🔍 Source et fiabilité

${post.source_fiabilite}

**🔗 Lien source :** ${articleUrl}

## 🎓 Intérêt pour les étudiants informatique

${post.interet_classe}

---

## 💬 **Pistes de réflexion pour vos commentaires**

**🔎 Points intéressants :** ${analysis.commentaires_suggestions.points_interessants}

**💼 Réflexion métiers :** ${analysis.commentaires_suggestions.reflexion_metiers}

**🔗 Liens actualités :** ${analysis.commentaires_suggestions.liens_actualites}

## ❓ **Questions pour approfondir**

${analysis.commentaires_suggestions.questions_approfondissement.map((q, i) => `${i + 1}. ${q}`).join('\n')}

---
*🤖 Analyse générée par IA • Score pertinence : ${analysis.pertinence_score}/10*
*🏷️ Mots-clés : ${analysis.mots_cles.join(', ')}*`
        };
    }

    // Vérification de la santé de l'API
    async healthCheck() {
        if (!this.genAI) {
            return { status: 'disabled', message: 'GEMINI_API_KEY non configuré' };
        }

        try {
            const result = await this.model.generateContent('Test simple');
            return { status: 'ok', message: 'Gemini fonctionnel' };
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }
}

module.exports = GeminiAnalyzer;