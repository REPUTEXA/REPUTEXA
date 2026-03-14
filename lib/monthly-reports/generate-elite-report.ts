/**
 * Moteur IA des rapports mensuels REPUTEXA.
 * Rédaction style consultant senior en stratégie — GPT-4o.
 */

import OpenAI from 'openai';
import type { ReportType, MonthlyStats, ReviewForReport, SummaryStats } from './types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildReviewsContext(reviews: ReviewForReport[]): string {
  if (!reviews.length) return 'Aucun avis disponible pour ce mois.';
  return reviews
    .slice(0, 100)
    .map((r) => `[${r.rating}/5] ${r.source} — ${r.comment}`)
    .join('\n');
}

function buildStatsContext(stats: MonthlyStats): string {
  return [
    `Note moyenne: ${stats.averageRating.toFixed(1)}/5`,
    `Total avis: ${stats.totalReviews}`,
    `Positifs (4-5★): ${stats.positiveCount}`,
    `Négatifs (1-3★): ${stats.negativeCount}`,
    `Plateformes: ${stats.platforms.map((p) => `${p.name} (${p.count})`).join(', ')}`,
  ].join('\n');
}

const ELITE_TONE = `RÈGLES OBLIGATOIRES : Vouvoiement exclusif. Ton Consultant de Luxe — expert, distingué, orienté résultats.
Conseils ultra-concrets : chiffres précis, actions nommées (ex: "Postez 2 stories Instagram/semaine sur les plats signature").
Aucune généralité ("améliorez le service") — uniquement des recommandations actionnables et mesurables.`;

const SYSTEM_VISION = `Tu es un consultant senior en stratégie e-réputation pour des cabinets premium. Ton ton : professionnel, factuel, orienté action.
Tu rédiges des analyses pour des établissements (restaurants, hôtels, commerces).
${ELITE_TONE}
Réponds UNIQUEMENT en JSON valide, sans markdown.`;

const SYSTEM_PULSE = `${SYSTEM_VISION}
Pour PULSE, ajoute une analyse sentimentale fine : ce que les clients adorent vs détestent (exemples concrets tirés des avis).`;

const SYSTEM_ZENITH = `${SYSTEM_PULSE}
Pour ZENITH, ajoute : analyse prédictive, benchmark sectoriel (restauration/hôtellerie), plan d'action step-by-step.
ET nextMonthAdvice : 2–3 conseils stratégiques ultra-concrets pour le mois suivant (actions nommées, dates suggérées).`;

export async function generateEliteReport(
  stats: MonthlyStats,
  reviews: ReviewForReport[],
  planType: ReportType,
  locale: string = 'fr'
): Promise<SummaryStats> {
  const lang = locale === 'fr' ? 'en français' : locale === 'en' ? 'in English' : 'en français';
  const statsCtx = buildStatsContext(stats);
  const reviewsCtx = buildReviewsContext(reviews);

  let systemPrompt = SYSTEM_VISION;
  let jsonSchema: string;

  switch (planType) {
    case 'VISION':
      systemPrompt = SYSTEM_VISION;
      jsonSchema = `{"kpis":["string","string","string"],"strength":"string","opportunity":"string"}`;
      break;
    case 'PULSE':
      systemPrompt = SYSTEM_PULSE;
      jsonSchema = `{"kpis":["string"],"strength":"string","opportunity":"string","sentiment":{"love":["string","string"],"hate":["string"]},"tactics":["string","string","string"]}`;
      break;
    case 'ZENITH':
      systemPrompt = SYSTEM_ZENITH;
      jsonSchema = `{"kpis":["string"],"strength":"string","opportunity":"string","sentiment":{"love":["string"],"hate":["string"]},"tactics":["string","string"],"predictive":"string","benchmark":"string","actionPlan":["string","string","string"],"nextMonthAdvice":"string"}`;
      break;
    default:
      systemPrompt = SYSTEM_VISION;
      jsonSchema = `{"kpis":["string"],"strength":"string","opportunity":"string"}`;
  }

  const userPrompt = `Établissement: ${stats.establishmentName}
Période: ${stats.monthLabel}
Type de rapport: ${planType}

## Statistiques
${statsCtx}

## Avis clients (extraits)
${reviewsCtx}

Rédige un rapport stratégique ${lang}. Réponds UNIQUEMENT en JSON valide au format: ${jsonSchema}
- kpis: 3 KPIs clés (phrases courtes)
- strength: un point fort majeur
- opportunity: une opportunité clé à saisir
${planType !== 'VISION' ? '- sentiment: love (ce que les clients adorent), hate (ce qu\'ils détestent)\n- tactics: 3 tactiques de croissance concrètes' : ''}
${planType === 'ZENITH' ? '- predictive: analyse prédictive (tendance des 3 prochains mois)\n- benchmark: comparaison secteur restauration/hôtellerie\n- actionPlan: plan d\'action step-by-step (3 étapes)\n- nextMonthAdvice: 2-3 conseils ultra-concrets pour le mois suivant (actions nommées)' : ''}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const parsed = JSON.parse(content) as Record<string, unknown>;
  return parsed as SummaryStats;
}
