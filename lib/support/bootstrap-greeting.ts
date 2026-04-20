import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ANTHROPIC_DEFAULT_HAIKU } from '@/lib/ai/anthropic-model-defaults';
import { collectUserAccountSignals } from './user-account-signals';
import { fetchActiveHealthIntelligence } from './health-intelligence';

function displayNameFromProfile(p: {
  full_name?: string | null;
  establishment_name?: string | null;
}): string {
  const n = (p.full_name ?? '').trim();
  if (n) return n.split(/\s+/)[0] ?? n;
  const e = (p.establishment_name ?? '').trim();
  return e || '';
}

export async function loadProfileDisplayName(
  admin: SupabaseClient,
  userId: string
): Promise<string> {
  const { data } = await admin
    .from('profiles')
    .select('full_name, establishment_name')
    .eq('id', userId)
    .maybeSingle();
  return displayNameFromProfile((data ?? {}) as { full_name?: string; establishment_name?: string });
}

/**
 * Premier message du conseiller : signaux compte + incidents plateforme connus,
 * sans attendre une question du client.
 */
export async function generateSupportBootstrapGreeting(params: {
  admin: SupabaseClient;
  userId: string;
  locale?: string;
}): Promise<string> {
  const locale = (params.locale ?? 'fr').toLowerCase();
  const displayName = await loadProfileDisplayName(params.admin, params.userId);

  const { markdown: sigMd } = await collectUserAccountSignals(params.admin, params.userId, {
    maxSignals: 5,
    maxAgeHours: 72,
  });
  const { markdown: healthMd } = await fetchActiveHealthIntelligence(params.admin);

  const { data: estRows, count: estCount } = await params.admin
    .from('establishments')
    .select('name', { count: 'exact' })
    .eq('user_id', params.userId)
    .limit(8);
  const establishmentHint =
    (estCount ?? estRows?.length ?? 0) > 0
      ? `Parc établissements : ${estCount ?? estRows?.length ?? 0} site(s) — ${(estRows ?? [])
          .map((r) => String((r as { name?: string }).name ?? '').trim())
          .filter(Boolean)
          .slice(0, 6)
          .join(' · ')}`
      : '';

  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    return displayName
      ? `Bonjour, ${displayName}. Je suis votre conseiller REPUTEXA. En quoi puis-je vous être utile ?`
      : 'Bonjour, je suis votre conseiller REPUTEXA. En quoi puis-je vous être utile ?';
  }

  const contextParts = [
    `Personnalisation (prénom ou enseigne si pertinent) : ${displayName || 'Madame, Monsieur'}.`,
    ...(establishmentHint ? [`${establishmentHint} (si multi-sites : vous pouvez proposer d’optimiser le site le plus faible vs le meilleur, sans dette technique).`] : []),
    sigMd || '(Aucun signal d’échec récent enregistré sur ce compte.)',
    healthMd || '(Aucun incident plateforme large signalé pour le moment.)',
  ].join('\n\n');

  const isEn = locale.startsWith('en');
  const userPrompt = isEn
    ? `Write ONLY the concierge's first message (2–4 short sentences), polished professional English, "you" formal where natural. If account signals warrant it, offer proactive help on one concrete topic—no jargon (no "log", "API", "tool"). If a platform health line matches sync / delivery / review collection, say the team is on it and give ETA if provided. Otherwise a warm standard welcome. No emojis. No bullet points.`
    : `Rédigez UNIQUEMENT le premier message du conseiller (2 à 4 phrases courtes). Vouvoiement impeccable tout au long. ` +
      `Si les signaux récents du compte le justifient, proposez votre aide de façon proactive sur UN sujet concret, en langage humain (pas de « log », « API », « base de données », « outil »). ` +
      `Si une ligne « incidents plateforme » correspond manifestement à un souci de synchronisation, d’envoi ou de collecte d’avis, vous pouvez indiquer que nous travaillons dessus et mentionner l’ETA si elle est indiquée. ` +
      `Sinon, accueil chaleureux standard. Pas d’émojis. Pas de liste à puces.`;

  const anthropic = new Anthropic({ apiKey: key });
  const model =
    process.env.ANTHROPIC_BOOTSTRAP_MODEL?.trim() ||
    process.env.ANTHROPIC_AGENT_MODEL?.trim() ||
    ANTHROPIC_DEFAULT_HAIKU;

  try {
    const res = await anthropic.messages.create({
      model,
      max_tokens: 450,
      temperature: 0.35,
      system:
        'Sortie : uniquement le texte du message destiné au client, sans préambule ni guillemets. ' +
        (isEn
          ? 'You are REPUTEXA premium support.'
          : 'Vous êtes le conseiller expert REPUTEXA, ton luxe et précis.'),
      messages: [
        {
          role: 'user',
          content: `${userPrompt}\n\n--- Contexte interne (confidentiel) ---\n${contextParts}`,
        },
      ],
    });
    const block = res.content.find((b) => b.type === 'text');
    const out =
      block && 'text' in block ? String(block.text).trim() : '';
    if (out.length > 20) return out;
  } catch (e) {
    console.error('[support-bootstrap]', e);
  }

  return displayName
    ? `Bonjour, ${displayName}. Je suis votre conseiller REPUTEXA. Comment puis-je vous aider aujourd’hui ?`
    : 'Bonjour, je suis votre conseiller REPUTEXA. Comment puis-je vous aider aujourd’hui ?';
}
