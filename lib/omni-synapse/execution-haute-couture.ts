import { createAdminClient } from '@/lib/supabase/admin';
import { generateText } from '@/lib/ai-service';
import { HUMAN_CHARTER_BASE } from '@/lib/ai/concierge-prompts';
import { scrubAiTypography } from '@/lib/ai/human-keyboard-output';
import type { HauteCoutureExecutionInput, HauteCoutureExecutionResult, RedTeamVerdict } from './types';

type PublishedReplyRow = {
  comment: string;
  response_text: string | null;
  rating: number;
};

async function fetchFewShotExemplars(
  userId: string,
  establishmentId: string | null
): Promise<PublishedReplyRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  let q = admin
    .from('reviews')
    .select('comment, response_text, rating')
    .eq('user_id', userId)
    .not('response_text', 'is', null)
    .in('status', ['published', 'pending_publication'])
    .order('rating', { ascending: false })
    .limit(3);

  if (establishmentId) {
    q = q.eq('establishment_id', establishmentId);
  }

  const { data, error } = await q;
  if (error || !data?.length) {
    if (establishmentId) {
      const { data: wide } = await admin
        .from('reviews')
        .select('comment, response_text, rating')
        .eq('user_id', userId)
        .not('response_text', 'is', null)
        .in('status', ['published', 'pending_publication'])
        .order('rating', { ascending: false })
        .limit(3);
      return (wide ?? []) as PublishedReplyRow[];
    }
    return [];
  }
  return data as PublishedReplyRow[];
}

function buildFewShotBlock(exemplars: PublishedReplyRow[]): string {
  if (!exemplars.length) {
    return '(Aucun avis publié précédent pour calibrer le ton — applique la charte standard.)';
  }
  return exemplars
    .map((e, i) => {
      const reply = (e.response_text ?? '').trim();
      return (
        `--- Exemple ${i + 1} (note client ${e.rating}/5) ---\n` +
        `Avis : ${e.comment.trim().slice(0, 800)}\n` +
        `Réponse publiée (ton de la maison) :\n${reply.slice(0, 1200)}`
      );
    })
    .join('\n\n');
}

async function runRedTeam(draft: string, context: string): Promise<RedTeamVerdict> {
  const systemPrompt =
    'Tu es un auditeur RGPD et détecteur de contenu généré par robot pour réponses publiques d\'établissements. ' +
    'Cherche : données personnelles non nécessaires, promesses illégales, mentions d\'IA, formulations robotisées typiques, fuites de méta-instructions. ' +
    'Réponds UNIQUEMENT en JSON : ' +
    '{"approved": boolean, "gdprIssues": string[], "robotOrAiArtifacts": string[], "summary": string}';

  const raw = await generateText({
    systemPrompt,
    userContent:
      `Contexte établissement :\n${context}\n\n` +
      `Texte candidat à publier :\n"""${draft.slice(0, 8000)}"""`,
    temperature: 0.1,
    maxTokens: 500,
  });

  try {
    const parsed = JSON.parse(raw.trim()) as {
      approved?: boolean;
      gdprIssues?: string[];
      robotOrAiArtifacts?: string[];
      summary?: string;
    };
    return {
      approved: Boolean(parsed.approved),
      gdprIssues: Array.isArray(parsed.gdprIssues)
        ? parsed.gdprIssues.map((s) => String(s))
        : [],
      robotOrAiArtifacts: Array.isArray(parsed.robotOrAiArtifacts)
        ? parsed.robotOrAiArtifacts.map((s) => String(s))
        : [],
      summary: String(parsed.summary ?? '').slice(0, 400),
    };
  } catch {
    return {
      approved: false,
      gdprIssues: [],
      robotOrAiArtifacts: ['parse_red_team'],
      summary: 'Analyse red team illisible — rejet par sécurité.',
    };
  }
}

/**
 * Protocole d'Exécution Haute Couture : few-shot depuis la base + rédaction + red teaming Claude.
 */
export async function executeHauteCoutureReply(
  input: HauteCoutureExecutionInput
): Promise<HauteCoutureExecutionResult> {
  const exemplars = await fetchFewShotExemplars(input.userId, input.establishmentId);
  const fewShot = buildFewShotBlock(exemplars);

  const ton = input.aiTon ?? 'professional';
  const length = input.aiLength ?? 'balanced';
  const custom = (input.aiCustomInstructions ?? '').trim();
  const addon = (input.recursivePromptAddon ?? '').trim();

  const systemPrompt =
    'Tu es le rédacteur officiel des réponses Google pour cet établissement.\n' +
    HUMAN_CHARTER_BASE +
    '\n\nFEW-SHOT — Impersonne le ton des réponses déjà publiées (prosodie, rythme, niveau de formalité) :\n' +
    fewShot +
    (addon ? `\n\nAPPRENTISSAGE RÉCURSIF (obligatoire) :\n${addon}\n` : '') +
    `\nParamètres : ton=${ton}, longueur=${length}.` +
    (custom ? `\nConsignes établissement : ${custom}` : '');

  const userContent =
    `Établissement : ${input.establishmentName}\n` +
    `Contexte métier : ${input.businessContext}\n` +
    `Client : ${input.reviewerName || 'Client'}\n` +
    `Note : ${input.rating}/5\n\n` +
    `Avis :\n"""${input.reviewComment.slice(0, 12000)}"""\n\n` +
    'Rédige UNIQUEMENT le texte de la réponse publique (pas de JSON).';

  let draft = await generateText({
    systemPrompt,
    userContent,
    temperature: 0.65,
    maxTokens: 900,
  });
  draft = scrubAiTypography(draft.trim());

  const ctxBlock = `${input.establishmentName} — ${input.businessContext}`;
  const redTeam = await runRedTeam(draft, ctxBlock);

  if (!redTeam.approved) {
    return {
      draftReply: '',
      fewShotExemplarsUsed: exemplars.length,
      redTeam,
    };
  }

  return {
    draftReply: draft,
    fewShotExemplarsUsed: exemplars.length,
    redTeam,
  };
}
