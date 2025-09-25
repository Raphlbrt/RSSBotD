const OpenAI = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');

class AIAnalyzer {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
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
            $('script, style, nav, header, footer, aside, .ads, .advertisement').remove();

            // Extraire le contenu principal
            let content = '';
            const mainSelectors = ['article', 'main', '.content', '.post-content', '.entry-content', 'body'];

            for (const selector of mainSelectors) {
                const element = $(selector).first();
                if (element.length && element.text().trim().length > 500) {
                    content = element.text().trim();
                    break;
                }
            }

            // Si aucun contenu principal trouvé, prendre tout le body
            if (!content) {
                content = $('body').text().trim();
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
            .trim()
            .substring(0, 8000); // Limiter pour l'API
    }

    async analyzeNews(article, fullContent = null) {
        try {
            const contentToAnalyze = fullContent || article.contentSnippet || article.content || '';

            const prompt = `
Analysez cette actualité selon les consignes suivantes pour créer un post éducatif de forum :

TITRE DE L'ARTICLE : ${article.title}
URL : ${article.link}
DATE DE PUBLICATION : ${article.pubDate}
CONTENU : ${contentToAnalyze}

CONSIGNES D'ANALYSE :

1. INFORMATIONS PRINCIPALES À MENTIONNER :
   - Le contenu de l'actualité (Qui ? Quoi ? Où ? Comment ? Quand ? Quelles conséquences ?)
   - Présentation de l'auteur/éditeur et de la source
   - Pourquoi cette source est fiable
   - Pourquoi cette information est intéressante pour des étudiants en informatique

2. INFORMATIONS POUR COMMENTAIRES :
   - Points intéressants de l'actualité
   - Réflexions sur les métiers de l'informatique et parcours académique
   - Liens possibles avec d'autres actualités
   - Questions pour approfondir

RÉPONDEZ AU FORMAT JSON :
{
  "post_principal": {
    "titre": "titre accrocheur",
    "contenu": "analyse complète selon les consignes",
    "qui_concerne": "description des personnes concernées",
    "sujet": "de quoi ça parle",
    "lieu": "où ça se passe",
    "comment": "comment cela s'est produit",
    "quand": "quand est-ce arrivé",
    "consequences": "quelles conséquences",
    "source_presentation": "présentation de la source",
    "fiabilite_source": "pourquoi faire confiance à cette source",
    "interet_classe": "pourquoi c'est intéressant pour des étudiants informatique"
  },
  "commentaires_suggestions": {
    "points_interessants": "ce qui est intéressant dans ce post",
    "reflexion_metiers": "réflexions sur les métiers informatique",
    "liens_actualites": "liens avec d'autres actualités possibles",
    "questions_approfondissement": ["question 1", "question 2", "question 3"]
  },
  "pertinence_score": 8.5,
  "mots_cles": ["mot1", "mot2", "mot3"]
}

Soyez précis, éducatif et engageant pour des étudiants en informatique.
`;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [{
                    role: "user",
                    content: prompt
                }],
                max_tokens: 2000,
                temperature: 0.7
            });

            const analysisText = response.choices[0].message.content;

            // Parser le JSON retourné
            try {
                const analysis = JSON.parse(analysisText);
                return analysis;
            } catch (parseError) {
                console.error('Erreur de parsing JSON:', parseError);
                return this.createFallbackAnalysis(article);
            }

        } catch (error) {
            console.error('Erreur lors de l\'analyse IA:', error);
            return this.createFallbackAnalysis(article);
        }
    }

    createFallbackAnalysis(article) {
        return {
            post_principal: {
                titre: article.title || 'Actualité informatique',
                contenu: `Nouvelle actualité : ${article.title}\n\n${article.contentSnippet || 'Contenu non disponible'}`,
                qui_concerne: "À analyser",
                sujet: article.title || "À définir",
                lieu: "À préciser",
                comment: "À analyser",
                quand: article.pubDate || "Date inconnue",
                consequences: "À évaluer",
                source_presentation: "Source à vérifier",
                fiabilite_source: "À évaluer",
                interet_classe: "Actualité du domaine informatique à discuter"
            },
            commentaires_suggestions: {
                points_interessants: "Article à analyser plus en détail",
                reflexion_metiers: "Réflexions à développer",
                liens_actualites: "Liens à établir",
                questions_approfondissement: [
                    "Quels sont les enjeux de cette actualité ?",
                    "Comment cela impacte-t-il notre domaine ?",
                    "Quelles sont les perspectives d'avenir ?"
                ]
            },
            pertinence_score: 5.0,
            mots_cles: ["informatique", "actualité", "technologie"]
        };
    }

    formatForumPost(analysis, articleUrl) {
        const post = analysis.post_principal;

        return {
            title: post.titre,
            content: `# ${post.titre}

## 📋 Analyse de l'actualité

**Qui est concerné ?** ${post.qui_concerne}

**De quoi ça parle ?** ${post.sujet}

**Où ça se passe ?** ${post.lieu}

**Comment ?** ${post.comment}

**Quand ?** ${post.quand}

**Conséquences ?** ${post.consequences}

## 🔍 Source et fiabilité

**Source :** ${post.source_presentation}

**Fiabilité :** ${post.fiabilite_source}

**Lien :** ${articleUrl}

## 🎓 Intérêt pour la classe

${post.interet_classe}

---

## 💬 **Pistes de réflexion en commentaires**

• **Ce qui m'intéresse :** ${analysis.commentaires_suggestions.points_interessants}

• **Réflexion métiers :** ${analysis.commentaires_suggestions.reflexion_metiers}

• **Liens avec d'autres actualités :** ${analysis.commentaires_suggestions.liens_actualites}

## ❓ **Questions pour approfondir**

${analysis.commentaires_suggestions.questions_approfondissement.map((q, i) => `${i + 1}. ${q}`).join('\n')}

---
*Score de pertinence : ${analysis.pertinence_score}/10*
*Mots-clés : ${analysis.mots_cles.join(', ')}*`
        };
    }
}

module.exports = AIAnalyzer;