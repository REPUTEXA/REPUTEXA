import OpenAI from 'openai';
import type { Article } from '@/lib/i18n/blog-articles/types';
import type { TopicPick } from './topic-matrix';

const SYSTEM = `Tu es un consultant senior e-réputation pour REPUTEXA. Tu rédiges un article long format, expert, pour dirigeants de PME et commerçants.

CONTRAINTES :
- Langue : français professionnel uniquement.
- Données : cite des sources sous forme textuelle entre parenthèses (Source: Organisme, année). Aucune URL dans le corps. Les sources listées en fin d'article peuvent inclure des URLs réelles génériques (Google Support, Commission européenne, etc.) uniquement si tu es certain qu'elles existent ; sinon mets label sans URL.
- Catégorie : une seule parmi EXACTEMENT ces libellés FR (champ "category") : Produit | Tendances | Réglementation | Guide pratique | Cas d'usage | SEO Local | Cybersécurité | Études | International
- Structure JSON : respecte le schéma fourni. Les sections peuvent mélanger paragraphs, bullets, numbered, callout (type stat|warning|tip|key), heading, lead.
- Secteur : tu DOIS contextualiser pour le secteur et le domaine fournis, et tisser l'actualité (titres RSS) dans l'intro ou une section "Fil de la semaine".
- Longueur : riche (plusieurs sections), conclusion et CTA actionnables.

FORMAT DE SORTIE : JSON strict uniquement, sans markdown autour.`;

function userPayload(topic: TopicPick, headlines: string[]): string {
  const block =
    headlines.length > 0
      ? `Titres d'actualité récents (à intégrer comme contexte) :\n${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
      : "Pas de flux RSS exploitable : appuie-toi sur des tendances documentées du secteur.";

  return `Domaine thématique : ${topic.domain}
Angle : ${topic.angle}
Secteur cible : ${topic.sector}
Index de diversité (hachage) : ${topic.weekIndex}

${block}

Réponds avec un JSON ayant EXACTEMENT cette forme (tous les champs requis) :
{
  "slug": "kebab-case-en-minuscules",
  "title": "...",
  "excerpt": "max 200 caractères",
  "date": "ex: 16 avril 2026",
  "readTime": "ex: 7 min",
  "category": "l'un des libellés FR autorisés",
  "author": "REPUTEXA Intelligence",
  "editorial": "courte ligne éditoriale",
  "intro": "paragraphe accroche",
  "sections": [ { "heading": "...", "paragraphs": ["..."], ... } ],
  "conclusion": "...",
  "cta": "phrase CTA",
  "methodology": "optionnel : ligne méthodo",
  "sources": [ { "label": "...", "url": "https://... ou omis", "note": "optionnel" } ]
}`;
}

export async function generateFrenchArticle(topic: TopicPick, headlines: string[]): Promise<Article> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.65,
    max_tokens: 6000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userPayload(topic, headlines) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw) as Article;
  if (!parsed.slug || !parsed.title || !parsed.sections?.length) {
    throw new Error('[blog-forge] Article FR invalide (JSON incomplet)');
  }
  parsed.slug = parsed.slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
  return parsed;
}
