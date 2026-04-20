import { createTranslator } from 'next-intl';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/resend';
import { generateText, hasAiConfigured } from '@/lib/ai-service';
import { scrubAiTypography } from '@/lib/ai/human-keyboard-output';
import { getInfoBroadcastEmailHtml } from '@/lib/emails/info-broadcast-email';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { internalOpsMessageLocale } from '@/lib/admin/internal-ops-locale';
import {
  BROADCAST_EMAIL_LOCALES,
  type BroadcastEmailLocale,
  type LocalePack,
  normalizeLocalePacks,
} from '@/lib/admin/broadcast-email-token';
import { firstNameFromFullName } from '@/lib/i18n/first-name';

function resolveProfileLocale(raw: string | null | undefined): BroadcastEmailLocale {
  const k = (raw || 'fr').toLowerCase().split('-')[0];
  return BROADCAST_EMAIL_LOCALES.includes(k as BroadcastEmailLocale) ? (k as BroadcastEmailLocale) : 'fr';
}

function stripAiFence(text: string): string {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  }
  return t.trim();
}

function buildBroadcastJsonExampleShape(): string {
  const parts = BROADCAST_EMAIL_LOCALES.filter((l) => l !== 'fr').map(
    (loc) => `"${loc}":{"subject":"...","html":"..."}`,
  );
  return `{${parts.join(',')}}`;
}

function parseTranslationJson(text: string): Partial<Record<BroadcastEmailLocale, LocalePack>> {
  const raw = stripAiFence(text);
  const j = JSON.parse(raw) as Record<string, { subject?: string; html?: string }>;
  const out: Partial<Record<BroadcastEmailLocale, LocalePack>> = {};
  for (const loc of BROADCAST_EMAIL_LOCALES) {
    if (loc === 'fr') continue;
    const row = j[loc];
    if (row && typeof row.subject === 'string' && typeof row.html === 'string') {
      out[loc] = { subject: scrubAiTypography(row.subject.trim()), html: scrubAiTypography(row.html.trim()) };
    }
  }
  return out;
}

export async function translateFrToAllPacks(subjectFr: string, htmlFr: string): Promise<Record<BroadcastEmailLocale, LocalePack>> {
  const locale = internalOpsMessageLocale();
  const messages = getServerMessagesForLocale(locale);
  const t = createTranslator({ locale, messages, namespace: 'Admin' });

  if (!hasAiConfigured()) {
    throw new Error(t('broadcastTranslate.errorNoAi'));
  }

  const targets = BROADCAST_EMAIL_LOCALES.filter((l) => l !== 'fr').join(', ');
  const promptUser = [
    t('broadcastTranslate.lineFrenchSubject', { subjectFr }),
    '',
    t('broadcastTranslate.lineFrenchHtmlLabel'),
    htmlFr,
    '',
    t('broadcastTranslate.lineInstructions', { targets }),
    '',
    t('broadcastTranslate.lineJsonOnly'),
    buildBroadcastJsonExampleShape(),
  ].join('\n');

  const raw = await generateText({
    systemPrompt: t('broadcastTranslate.systemPrompt'),
    userContent: promptUser,
    temperature: 0.35,
    maxTokens: 12000,
    anthropicModel: process.env.LEGAL_ANTHROPIC_MODEL?.trim() || undefined,
  });
  const partial = parseTranslationJson(raw);
  return normalizeLocalePacks({
    fr: { subject: subjectFr.trim(), html: htmlFr.trim() },
    ...partial,
  });
}

export type BroadcastSendAllResult = {
  emailsSent: number;
  emailsFailed: number;
  totalUsers: number;
};

/**
 * Envoie le message information à tous les profils avec e-mail (locale → pack traduit).
 */
export async function executeBroadcastSendAll(
  admin: SupabaseClient,
  subjectFr: string,
  htmlFr: string
): Promise<BroadcastSendAllResult> {
  const packs = await translateFrToAllPacks(subjectFr, htmlFr);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.fr').replace(
    /\/$/,
    ''
  );

  const { data: rows, error } = await admin
    .from('profiles')
    .select('email, locale, establishment_name, full_name')
    .not('email', 'is', null);

  if (error) {
    throw new Error(error.message);
  }

  const recipients = (rows ?? []).filter((r) => r.email && String(r.email).includes('@'));
  let sent = 0;
  let failed = 0;

  const BATCH = 40;
  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (row) => {
        const email = String(row.email);
        const loc = resolveProfileLocale(row.locale);
        const pack = packs[loc];
        const dashUrl = `${siteUrl}/${loc}/dashboard`;
        const first = firstNameFromFullName(
          row && typeof row === 'object' ? (row as { full_name?: string | null }).full_name : ''
        );
        const html = getInfoBroadcastEmailHtml({
          locale: loc,
          title: pack.subject,
          bodyHtml: pack.html,
          recipientName: first || undefined,
          dashboardUrl: dashUrl,
        });
        const res = await sendEmail({ to: email, subject: pack.subject, html });
        if (res.success) sent++;
        else failed++;
      })
    );
    if (i + BATCH < recipients.length) {
      await new Promise((r) => setTimeout(r, 320));
    }
  }

  return { emailsSent: sent, emailsFailed: failed, totalUsers: recipients.length };
}
