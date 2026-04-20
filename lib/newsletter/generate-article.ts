/**
 * Générateur d'article MDX hebdomadaire — Flux Stratégique REPUTEXA
 * Moteur : GPT-4o (OpenAI)
 * Contexte : Actualités réelles de la semaine via fetch RSS
 * Exécution : mardi 09h00 via /api/cron/newsletter
 */

import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';

const CONTENT_DIR = path.join(process.cwd(), 'content', 'blog');

/* ─── RSS Sources ─────────────────────────────────────────────────────────── */
const RSS_FEEDS = [
  { url: 'https://www.journaldunet.com/rss/', label: 'Journal du Net' },
  { url: 'https://www.usine-digitale.fr/rss/all.xml', label: 'Usine Digitale' },
  { url: 'https://www.maddyness.com/feed/', label: 'Maddyness' },
  { url: 'https://searchengineland.com/feed', label: 'Search Engine Land' },
  { url: 'https://www.lesechos.fr/rss/rss_tech.xml', label: 'Les Echos Tech' },
  { url: 'https://siecledigital.fr/feed/', label: 'Siècle Digital' },
  { url: 'https://www.01net.com/rss/news/', label: '01net' },
];

/* ─── Topic Pool (fallback si RSS inaccessible) ─────────────────────────── */
const TOPIC_POOL = [
  "L'impact des faux avis négatifs sur le chiffre d'affaires des restaurants en 2026 — chiffres réels et stratégies de défense",
  "Pourquoi les établissements qui répondent à 100% de leurs avis Google convertissent 40% mieux — l'analyse complète",
  "IA générative et e-réputation : comment les patrons économisent 3h par semaine sans perdre en authenticité",
  "Avis diffamatoires : le guide juridique 2026 pour contester efficacement auprès de Google avec le DSA",
  "Google vs Trustpilot : où investir votre réputation locale en 2026 ?",
  "Le paradoxe de la réponse parfaite : pourquoi trop bien répondre peut nuire à votre réputation",
  "Multi-établissements : comment gérer 10 fiches Google sans y passer ses nuits — stratégie et outils",
  "Cybersécurité de marque : les 5 signaux d'alerte d'une campagne de dénigrement coordonnée",
  "L'analyse de sentiment en temps réel — ce que vos clients vous disent entre les lignes",
  "WhatsApp Business + e-réputation : le duo gagnant pour collecter plus d'avis 5 étoiles",
  "Boost SEO par les réponses d'avis : la stratégie méconnue qui améliore votre référencement local",
  "Review bombing 2026 : comment une PME peut se défendre légalement et techniquement",
  "Note Google < 4 étoiles : ce que ça vous coûte vraiment (calcul précis par secteur)",
  "IA Act européen et réputation numérique : ce que les entreprises doivent anticiper",
  "Micro-influenceurs et e-réputation : quand vos meilleurs ambassadeurs sont vos clients",
];

/* ─── Fetch RSS headlines ─────────────────────────────────────────────────── */
async function fetchRSSHeadlines(): Promise<string[]> {
  const headlines: string[] = [];
  const today = new Date();
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  await Promise.allSettled(
    RSS_FEEDS.map(async ({ url, label }) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'REPUTEXA-Newsletter-Bot/1.0' },
        });
        clearTimeout(timeout);

        if (!res.ok) return;

        const xml = await res.text();

        // Extract CDATA titles
        const cdataMatches = Array.from(xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g));
        const plainMatches = Array.from(xml.matchAll(/<title>(.*?)<\/title>/g));
        const matches = cdataMatches.length > 1 ? cdataMatches.slice(1) : plainMatches.slice(1);

        // Extract pub dates to filter to last 7 days (best effort)
        const pubDates = Array.from(xml.matchAll(/<pubDate>(.*?)<\/pubDate>/g)).map((m) => m[1]);

        for (let i = 0; i < Math.min(matches.length, 8); i++) {
          const title = matches[i][1]
            .trim()
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");

          // Try to check date relevance
          let isRecent = true;
          if (pubDates[i]) {
            const pubDate = new Date(pubDates[i]);
            if (!isNaN(pubDate.getTime())) {
              isRecent = pubDate >= oneWeekAgo;
            }
          }

          if (isRecent && title.length > 10 && title.length < 200) {
            headlines.push(`[${label}] ${title}`);
          }
        }
      } catch {
        // Silently skip inaccessible feeds
      }
    })
  );

  // Deduplicate and return up to 25 headlines
  return Array.from(new Set(headlines)).slice(0, 25);
}

/* ─── Prompts ─────────────────────────────────────────────────────────────── */
const SYSTEM_PROMPT = `Tu es un Consultant Senior en e-réputation, stratégie digitale et transformation numérique, rédacteur expert pour REPUTEXA.

TON AUDIENCE : Dirigeants de PME, responsables marketing et gérants d'établissements (restauration, hôtellerie, commerce, services) qui gèrent leur réputation en ligne et leur présence digitale. Ils ont peu de temps, sont pragmatiques, et veulent des résultats mesurables.

TON POSITIONNEMENT : Tu es le consultant le plus cher de ta catégorie, qui distille en 7 minutes de lecture ce qu'il faudrait 3 heures de veille pour trouver. Chaque analyse est une valeur tangible — pas du contenu.

RÈGLES DE RÉDACTION (non négociables) :
1. TON : Direct, confiant, parfois provocateur. Comme si tu briefais un PDG exigeant en lui faisant gagner du temps.
2. STRUCTURE OBLIGATOIRE :
   - Accroche choc (1 chiffre ou fait surprenant)
   - Corps en 4-6 sous-sections titrées, chacune avec : contexte → données → implication concrète
   - "Ce que vous devez faire dès cette semaine" (section finale actionnable)
3. DONNÉES : Cite toujours des chiffres. Si tu n'es pas certain, préfixe avec "selon nos estimations" ou "d'après les données disponibles". Quantifie toujours.
   - SOURCES : Pour citer une étude ou un organisme, écris la référence en texte simple entre parenthèses : (Source: BrightLocal, 2025) ou (Harvard Business Review, 2024). INTERDICTION ABSOLUE d'inventer ou d'inclure des URLs dans l'article. Aucun lien de type http(s):// dans le contenu. Les sources sont des mentions textuelles, jamais des hyperliens.
4. LONGUEUR : 900-1400 mots. Jamais moins, jamais beaucoup plus.
5. INTERDICTIONS : Jargon creux ("paradigme", "synergie", "disruptif" utilisé seul), intro généraliste commençant par "Dans un monde où...", conclusion vague.
6. LIEN AVEC L'ACTUALITÉ : Si des titres d'actualité sont fournis, tisse-les naturellement dans l'article comme contexte. L'article doit sembler avoir été écrit cette semaine.
7. PERSPECTIVE REPUTEXA : Intègre naturellement (sans publicité excessive) comment les outils de monitoring/IA peuvent aider, en 1-2 mentions subtiles maximum.

FORMAT DE SORTIE (JSON strict — zéro texte hors JSON) :
{
  "title": "Titre percutant (60-90 caractères)",
  "slug": "slug-url-en-minuscules-avec-tirets",
  "excerpt": "Résumé 2 phrases, max 180 caractères — ce qui donne envie de lire",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "readTime": "N min",
  "body": "Contenu Markdown complet (## pour H2, **gras** pour emphase, - pour listes)"
}`;

function buildUserPrompt(headlines: string[]): string {
  const today = new Date();
  const weekLabel = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Rotate fallback topic by week number
  const weekNum = Math.floor(today.getTime() / (7 * 24 * 60 * 60 * 1000));
  const fallbackTopic = TOPIC_POOL[weekNum % TOPIC_POOL.length];

  const headlinesBlock = headlines.length > 0
    ? `\n\nACTUALITÉS DE LA SEMAINE (titres bruts à contextualiser dans l'article) :\n${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
    : `\n\nSUJET FALLBACK (pas d'actualités disponibles cette semaine) :\n${fallbackTopic}`;

  return `Nous sommes le ${weekLabel}. Tu rédiges l'analyse flash hebdomadaire du Flux Stratégique REPUTEXA, envoyée chaque mardi matin à nos abonnés.${headlinesBlock}

CONSIGNE : Utilise les actualités ci-dessus comme contexte de départ pour construire une analyse originale, focalisée sur l'impact pour les dirigeants d'établissements et PME. L'article doit être entièrement en français professionnel, sans fautes, et livrer une valeur réelle et concrète. Retourne uniquement le JSON demandé.`;
}

/* ─── Types & Export ─────────────────────────────────────────────────────── */
export type GeneratedArticle = {
  title: string;
  slug: string;
  excerpt: string;
  tags: string[];
  readTime: string;
  body: string;
};

export async function generateWeeklyArticle(): Promise<GeneratedArticle & { filePath: string }> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Fetch real headlines first
  console.log('[generate-article] Fetching RSS headlines...');
  const headlines = await fetchRSSHeadlines();
  console.log(`[generate-article] ${headlines.length} headlines fetched from RSS feeds`);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.75,
    max_tokens: 3500,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(headlines) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw) as GeneratedArticle;

  const dateStr = new Date().toISOString().slice(0, 10);
  const slug = (parsed.slug ?? dateStr).replace(/[^a-z0-9-]/g, '-').slice(0, 80);
  const filename = `${dateStr}-${slug}.mdx`;

  const frontmatter = `---
title: "${parsed.title.replace(/"/g, '\\"')}"
date: "${dateStr}"
excerpt: "${parsed.excerpt.replace(/"/g, '\\"')}"
tags: [${parsed.tags.map((t: string) => `"${t}"`).join(', ')}]
readTime: "${parsed.readTime}"
author: "REPUTEXA Intelligence"
slug: "${slug}"
published: true
---

`;

  const mdxContent = frontmatter + parsed.body;

  if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
  }

  const filePath = path.join(CONTENT_DIR, filename);
  fs.writeFileSync(filePath, mdxContent, 'utf-8');

  console.log(`[generate-article] Article écrit : ${filename} (${headlines.length} sources RSS intégrées)`);

  return { ...parsed, slug, filePath };
}
