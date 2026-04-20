import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireFeature } from '@/lib/api-plan-guard';
import { FEATURES } from '@/lib/feature-gate';
import { generateText } from '@/lib/ai-service';
import { apiJsonError } from '@/lib/api/api-error-response';

export interface ShieldAnalysisResult {
  flags: {
    hatred: boolean;    // Insultes, haine, propos discriminatoires
    fake: boolean;      // Suspicion de faux compte / spam coordonné
    threat: boolean;    // Chantage ou menace explicite
  };
  confidence: number;   // 0-100
  reason: string;       // Explication humaine concise
  complaintText: string; // Texte de plainte prêt à envoyer
  engine: string;
}

const SYSTEM_PROMPT = `Tu es REPUTEXA Shield, un expert juridique et analyste IA spécialisé dans la détection d'avis frauduleux et haineux sur les plateformes d'avis en ligne.

Ton rôle : analyser un avis client et produire un diagnostic structuré en JSON.

TESTS À EFFECTUER :
1. HAINE (hatred) : L'avis contient-il des insultes, propos haineux, discriminatoires, ou attaques personnelles ? (ex: injures, racisme, sexisme, homophobie)
2. FAUX COMPTE (fake) : Y a-t-il des signaux de faux compte ? (avis vide ou très court, nom générique ou suspect, note sans commentaire justifié, pattern de spam coordonné, compte sans historique apparent)
3. MENACE (threat) : Y a-t-il un chantage explicite, une menace de représailles, ou une extorsion ? (ex: "si vous ne me remboursez pas, je vais détruire votre réputation", "j'ai des contacts dans la presse")

RÉDIGE également un texte de plainte professionnel, prêt à copier-coller sur le formulaire de signalement de la plateforme. Le texte doit :
- Être formel et juridiquement solide
- Citer les éléments problématiques de l'avis
- Mentionner la violation des conditions d'utilisation de la plateforme
- Demander la suppression immédiate
- Être en français
- Faire environ 200-250 mots

FORMAT DE RÉPONSE OBLIGATOIRE (JSON strict, aucun texte avant ou après) :
{
  "flags": {
    "hatred": boolean,
    "fake": boolean,
    "threat": boolean
  },
  "confidence": number (0-100, niveau de certitude global que cet avis est problématique),
  "reason": "string (1-2 phrases max expliquant pourquoi cet avis est signalé)",
  "complaintText": "string (texte complet de la plainte, ~200 mots)"
}`;

export async function POST(request: Request) {
  try {
    const planCheck = await requireFeature(FEATURES.SHIELD_HATEFUL);
    if (planCheck instanceof NextResponse) return planCheck;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const body = await request.json() as { reviewId?: string };
    const { reviewId } = body;
    if (!reviewId) {
      return apiJsonError(request, 'errors.reviewIdRequired', 400);
    }

    // Fetch the review
    const { data: review } = await supabase
      .from('reviews')
      .select('id, reviewer_name, rating, comment, source, toxicity_reason, toxicity_complaint_text, toxicity_legal_argumentation')
      .eq('id', reviewId)
      .eq('user_id', user.id)
      .single();

    if (!review) {
      return apiJsonError(request, 'errors.reviewNotFound', 404);
    }

    const userContent = `AVIS À ANALYSER :
Auteur : ${review.reviewer_name ?? 'Anonyme'}
Note : ${review.rating ?? '?'}/5
Plateforme : ${review.source ?? 'Inconnue'}
Contenu : "${review.comment ?? '(vide)'}"

Produis l'analyse JSON complète.`;

    // Call AI engine (Anthropic primary, OpenAI fallback)
    let raw: string;
    let engine = 'openai';
    try {
      raw = await generateText({
        systemPrompt: SYSTEM_PROMPT,
        userContent,
        temperature: 0.2,
        maxTokens: 1200,
      });
      engine = 'ai-service';
    } catch {
      return apiJsonError(request, 'errors.shield_aiKeysMissing', 503);
    }

    // Parse JSON response
    let parsed: {
      flags?: { hatred?: boolean; fake?: boolean; threat?: boolean };
      hatred?: boolean;
      fake?: boolean;
      threat?: boolean;
      confidence?: number;
      reason?: string;
      complaintText?: string;
    };
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
    } catch {
      return apiJsonError(request, 'errors.shield_invalidAiResponse', 500);
    }

    const result: ShieldAnalysisResult = {
      flags: {
        hatred: Boolean(parsed.flags?.hatred ?? parsed.hatred),
        fake: Boolean(parsed.flags?.fake ?? parsed.fake),
        threat: Boolean(parsed.flags?.threat ?? parsed.threat),
      },
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence ?? 80))),
      reason: String(parsed.reason ?? ''),
      complaintText: String(parsed.complaintText ?? ''),
      engine,
    };

    // Persist complaint text into the DB (only if not already set)
    if (result.complaintText && !review.toxicity_legal_argumentation) {
      await supabase
        .from('reviews')
        .update({
          toxicity_legal_argumentation: result.complaintText,
          toxicity_reason: result.reason || review.toxicity_reason,
        })
        .eq('id', reviewId)
        .eq('user_id', user.id);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[shield/analyze]', error);
    return apiJsonError(request, 'errors.shield_analysisFailed', 500);
  }
}
