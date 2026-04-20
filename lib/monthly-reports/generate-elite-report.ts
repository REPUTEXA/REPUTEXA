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

const SYSTEM_VISION = `Tu es un analyste e-réputation. Plan VISION : le rendu doit rester SIMPLE et FACTUEL (comme un tableau de bord en prose).
INTERDIT : conseils stratégiques, "nous recommandons", plans d'action, pistes d'amélioration, prévisions.
AUTORISÉ : reformuler les statistiques en 3 bullets courtes, une phrase "point le plus favorable" (strictement factual), une phrase "point le plus faible" (strictement factual, sans dire quoi faire).
Si des chiffres du MOIS PRÉCÉDENT sont fournis : au moins un KPI doit mentionner l'évolution ou l'écart (ex. volume ±X %, note ±0,1) en restant factuel, sans recommandation.
Réponds UNIQUEMENT en JSON valide, sans markdown.`;

const SYSTEM_PULSE = `Tu es un consultant senior en stratégie e-réputation pour des cabinets premium.
Tu rédiges des analyses pour des établissements (restaurants, hôtels, commerces).
${ELITE_TONE}
Ajoute une analyse sentimentale fine : ce que les clients adorent vs détestent (exemples concrets tirés des avis).
Pulse : mets en évidence les thèmes récurrents du mois (motifs qui reviennent sur plusieurs avis, pas un one-off).
OBLIGATOIRE — champ "predictive" : une phrase d'audit interne chiffrée, comme un directeur qui lit les données (ex. : « Sur la période, au moins N formulations distinctes évoquent [thème] ; corrélation avec les avis 1–2★ : … »). Si peu d'avis, reste prudent (« signal à surveiller », pas d'affirmation large).
Ajoute au moins une ligne de "lecture interne" dans tactics ou opportunity : ce qu'une équipe opérationnelle devrait vérifier en coulisses (briefing, stock, files d'attente) — sans bullshit, uniquement si les avis y donnent prise.
Si un découpage multi-établissements est fourni, cite au moins une comparaison factuelle (meilleur site vs site sous tension) sans inventer de chiffres absents.
Réponds UNIQUEMENT en JSON valide, sans markdown.`;

const SYSTEM_ZENITH = `${SYSTEM_PULSE}
Pour ZENITH, ajoute : analyse prédictive, benchmark sectoriel (restauration/hôtellerie), plan d'action step-by-step.
ET nextMonthAdvice : 2–3 conseils stratégiques ultra-concrets pour le mois suivant (actions nommées, dates suggérées).
Si des synthèses HEBDOMADAIRES sont fournies : tu t'en sers pour approfondir sans te contredire (comme un dossier client qui mûrit).`;

export type EliteReportExtraContext = {
  /** Données mois précédent pour deltas factuels */
  previousMonth?: {
    monthLabel: string;
    averageRating: number;
    totalReviews: number;
  };
  /** Résumés des rapports hebdo récents (cohérence dans le temps) */
  weeklyContinuity?: string;
  /** Lignes comparatives par établissement (holding) */
  multiEstablishmentBreakdown?: string;
};

export async function generateEliteReport(
  stats: MonthlyStats,
  reviews: ReviewForReport[],
  planType: ReportType,
  locale: string = 'fr',
  extra?: EliteReportExtraContext
): Promise<SummaryStats> {
  const lang = locale === 'fr' ? 'en français' : locale === 'en' ? 'in English' : 'en français';
  const statsCtx = buildStatsContext(stats);
  const reviewsCtx = buildReviewsContext(reviews);

  let systemPrompt = SYSTEM_VISION;
  let jsonSchema: string;

  switch (planType) {
    case 'VISION':
      systemPrompt = SYSTEM_VISION;
      jsonSchema = `{"kpis":["string","string","string"],"strength":"string (1 phrase factuelle max)","opportunity":"string (1 phrase factuelle max, sans conseil)"}`;
      break;
    case 'PULSE':
      systemPrompt = SYSTEM_PULSE;
      jsonSchema = `{"kpis":["string"],"strength":"string","opportunity":"string","sentiment":{"love":["string","string"],"hate":["string"]},"tactics":["string","string","string"],"predictive":"string"}`;
      break;
    case 'ZENITH':
      systemPrompt = SYSTEM_ZENITH;
      jsonSchema = `{"kpis":["string"],"strength":"string","opportunity":"string","sentiment":{"love":["string"],"hate":["string"]},"tactics":["string","string"],"predictive":"string","benchmark":"string","actionPlan":["string","string","string"],"nextMonthAdvice":"string"}`;
      break;
    default:
      systemPrompt = SYSTEM_VISION;
      jsonSchema = `{"kpis":["string"],"strength":"string","opportunity":"string"}`;
  }

  const visionUserBlock = `Synthèse factuelle ${lang} (plan Vision). Réponds UNIQUEMENT en JSON: ${jsonSchema}
- kpis: 3 indicateurs chiffrés en une courte phrase chacun
- strength: le constat positif principal (nombre ou part), sans recommandation
- opportunity: le constat le plus sensible (nombre ou part), sans recommandation ni "vous devriez"`;

  const pulseUserBlock = `Rédige un rapport stratégique ${lang}, avec le niveau de détail d'un cabinet facturant des honoraires premium. Réponds UNIQUEMENT en JSON valide au format: ${jsonSchema}
- kpis: 3 KPIs chiffrés (au moins une compare au mois précédent si les données sont fournies)
- strength: point fort majeur, ancré dans les avis
- opportunity: levier prioritaire, mesurable ; si un thème négatif revient souvent, nomme-le comme motif récurrent (fréquence ou formulation)
- sentiment: love (thèmes positifs + formulations typiques des avis), hate (frictions concrètes ; signale les répétitions)
- tactics: 3 actions nommées, avec indicateur de succès simple ; au moins une action orientée "audit interne" (process, formation courte, créneaux) lorsque les avis s'y prêtent
- predictive: UNE phrase d'audit interne chiffrée (voir consignes système)`;

  const zenithExtras = `- predictive: analyse prédictive (tendance des 3 prochains mois)
- benchmark: comparaison secteur restauration/hôtellerie
- actionPlan: plan d'action step-by-step (3 étapes)
- nextMonthAdvice: 2-3 ultra-concrets pour le mois suivant (actions nommées)`;

  const userPromptBody =
    planType === 'VISION'
      ? visionUserBlock
      : planType === 'PULSE'
        ? pulseUserBlock
        : `${pulseUserBlock}\n${zenithExtras}`;

  const prevBlock =
    extra?.previousMonth && extra.previousMonth.totalReviews > 0
      ? `\n## Mois précédent (${extra.previousMonth.monthLabel})\nNote moyenne: ${extra.previousMonth.averageRating.toFixed(2)}/5 — Volume: ${extra.previousMonth.totalReviews} avis\n(Déduis écarts et tendances chiffrées dans le JSON selon le plan.)\n`
      : '';

  const weeklyBlock =
    extra?.weeklyContinuity && extra.weeklyContinuity.trim().length > 0
      ? `\n## Mémo des analyses hebdomadaires récentes (cohérence REPUTEXA)\n${extra.weeklyContinuity}\n`
      : '';

  const multiBlock =
    extra?.multiEstablishmentBreakdown && extra.multiEstablishmentBreakdown.trim().length > 0
      ? `\n## Par établissement (vu groupe — utiliser pour comparaisons factuelles)\n${extra.multiEstablishmentBreakdown}\n`
      : '';

  const userPrompt = `Établissement: ${stats.establishmentName}
Période: ${stats.monthLabel}
Type de rapport: ${planType}

## Statistiques
${statsCtx}
${prevBlock}
## Avis clients (extraits)
${reviewsCtx}
${weeklyBlock}${multiBlock}
${userPromptBody}`;

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
