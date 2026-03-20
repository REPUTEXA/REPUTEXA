import twilio from 'twilio';
import type { WhatsAppAlertPayload, ReviewPlatform } from './types';
import { CALLBACK_ACTIONS } from './types';
import { createAdminClient } from '../supabase/admin';

type SupportedLocale = 'fr' | 'en';

async function loadMessages(locale: SupportedLocale) {
  try {
    const mod = await import(`../../messages/${locale}.json`);
    // next-intl charge les messages en default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (mod as any).default ?? mod;
  } catch {
    return null;
  }
}

async function getPreferredLocale(phone: string): Promise<SupportedLocale> {
  const admin = createAdminClient();
  if (!admin) return 'fr';

  try {
    const normalized = phone.replace(/\D/g, '');
    const { data, error } = await admin
      .from('profiles')
      .select('preferred_language, whatsapp_phone')
      .ilike('whatsapp_phone', `%${normalized.slice(-9)}%`)
      .limit(1)
      .maybeSingle();

    if (error || !data) return 'fr';
    const lang = (data.preferred_language as string | null) ?? 'fr';
    return (['fr', 'en'] as SupportedLocale[]).includes(lang as SupportedLocale)
      ? (lang as SupportedLocale)
      : 'fr';
  } catch {
    return 'fr';
  }
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) return `+33${digits.slice(1)}`;
  if (digits.startsWith('33') && digits.length === 11) return `+${digits}`;
  return digits.startsWith('+') ? phone : `+${digits}`;
}

/**
 * Envoie une alerte WhatsApp via Twilio.
 *
 * Si TWILIO_WHATSAPP_ALERT_CONTENT_SID est défini : utilise le template Content API (avec boutons).
 * Sinon : envoie un message texte simple (fonctionne avec le Sandbox pour les tests).
 *
 * Variables d'environnement : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 * TWILIO_WHATSAPP_FROM, TWILIO_WHATSAPP_ALERT_CONTENT_SID (optionnel)
 */
export async function sendWhatsAppAlert(
  payload: WhatsAppAlertPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    to,
    reviewerName,
    rating,
    comment,
    suggestedReply,
    establishmentName,
    platform,
  } = payload;

  const locale = await getPreferredLocale(to);
  const messages = await loadMessages(locale);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alerts = (messages as any)?.Alerts?.whatsapp?.negativeReview ?? {};

  const authorFallback = locale === 'fr' ? 'Client' : 'Customer';
  const noCommentFallback = locale === 'fr' ? '(Aucun commentaire)' : '(No comment)';
  const noSuggestionFallback =
    locale === 'fr' ? '(Aucune suggestion)' : '(No suggestion available)';

  const authorName = String(reviewerName ?? '').trim() || alerts.anonymousAuthor || authorFallback;
  const reviewText = comment?.trim()
    ? comment.length > 300
      ? `${comment.slice(0, 300).trim()}...`
      : comment.trim()
    : alerts.noComment || noCommentFallback;
  const suggestedReplyVal =
    String(suggestedReply ?? '').trim() || alerts.noSuggestion || noSuggestionFallback;
  const suggestedReplyForTemplate =
    suggestedReplyVal.length > 500 ? `${suggestedReplyVal.slice(0, 500)}...` : suggestedReplyVal;

  console.log('Variables envoyées à Twilio:', {
    authorName,
    reviewText,
    suggestedReply: suggestedReplyForTemplate,
    platform: platform ?? 'google',
  });

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappNumberRaw =
    process.env.TWILIO_WHATSAPP_NUMBER ?? process.env.TWILIO_WHATSAPP_FROM ?? '';
  const whatsappNumber = String(whatsappNumberRaw).replace(/^whatsapp:/, '').trim();
  const contentSid =
    process.env.TWILIO_WHATSAPP_ALERT_CONTENT_SID ?? 'HX064e5d92f7e039ecb2b39d775ab28b33';

  console.log('DEBUG CONTENT SID:', process.env.TWILIO_WHATSAPP_ALERT_CONTENT_SID ?? '(fallback)');

  if (!accountSid || !authToken || !whatsappNumber) {
    return {
      success: false,
      error:
        locale === 'fr'
          ? 'Twilio non configuré. Définissez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_WHATSAPP_NUMBER (ou TWILIO_WHATSAPP_FROM).'
          : 'Twilio not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_NUMBER (or TWILIO_WHATSAPP_FROM).',
    };
  }

  const toFormatted = normalizePhone(to);
  const toWithPlus = toFormatted.startsWith('+') ? toFormatted : `+${toFormatted}`;
  const toWhatsApp = `whatsapp:${toWithPlus}`;
  const fromWhatsApp = `whatsapp:${whatsappNumber.startsWith('+') ? whatsappNumber : '+' + whatsappNumber}`;

  try {
    const client = twilio(accountSid, authToken);

    const platformEmojiMap: Record<ReviewPlatform, string> = {
      google: '🔵',
      facebook: '🟦',
      trustpilot: '🟩',
      tripadvisor: '🟢',
    };
    const emojiPrefix = platformEmojiMap[platform ?? 'google'];

    if (contentSid) {
      const message = await client.messages.create({
        from: fromWhatsApp,
        to: toWhatsApp,
        contentSid,
        contentVariables: JSON.stringify({
          '1': authorName || (alerts.anonymousAuthor ?? authorFallback),
          '2': reviewText || (alerts.noComment ?? noCommentFallback),
          '3': suggestedReplyForTemplate || (alerts.noSuggestion ?? noSuggestionFallback),
        }),
      });
      return { success: true, messageId: message.sid };
    }

    const titleCore =
      alerts.title ??
      (locale === 'fr'
        ? '*ALERTE NOUVEL AVIS NÉGATIF*'
        : '*NEW NEGATIVE REVIEW ALERT*');
    const title = `${emojiPrefix} ${titleCore}`;
    const reviewLabel =
      alerts.reviewLabel ??
      (locale === 'fr' ? '📝 *Avis client :*' : '📝 *Customer review:*');
    const aiLabel =
      alerts.aiSuggestionLabel ??
      (locale === 'fr' ? '🤖 *Suggestion de réponse IA :*' : '🤖 *AI-suggested reply:*');
    const cta =
      alerts.cta ??
      (locale === 'fr'
        ? "Répondez 'OK' pour valider cette réponse ou envoyez un vocal pour la modifier."
        : "Reply 'OK' to approve this reply or send a voice message to edit it.");
    const poweredBy =
      alerts.poweredBy ??
      (locale === 'fr'
        ? '_Propulsé par REPUTEXA_'
        : '_Powered by REPUTEXA_');

    const body = [
      title,
      '',
      establishmentName ? `📌 ${establishmentName}` : null,
      `👤 ${authorName} — ${rating}/5 ⭐`,
      '',
      reviewLabel,
      `"${reviewText}"`,
      '',
      aiLabel,
      `"${suggestedReplyForTemplate}"`,
      '',
      cta,
      '',
      poweredBy,
    ]
      .filter(Boolean)
      .join('\n');

    const message = await client.messages.create({
      body,
      from: fromWhatsApp,
      to: toWhatsApp,
    });

    return { success: true, messageId: message.sid };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[sendWhatsAppAlert] Twilio error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Renvoie la carte interactive (Content API) avec une nouvelle suggestion.
 * Utilisé après une modification vocale pour permettre de modifier à nouveau ou valider.
 */
export async function sendWhatsAppInteractiveCard(params: {
  to: string;
  reviewerName: string;
  comment: string;
  suggestedReply: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendWhatsAppAlert({
    to: params.to,
    reviewId: 'resend', // non utilisé pour l'envoi
    reviewerName: params.reviewerName,
    rating: 1,
    comment: params.comment,
    suggestedReply: params.suggestedReply,
  });
}

export { CALLBACK_ACTIONS };
