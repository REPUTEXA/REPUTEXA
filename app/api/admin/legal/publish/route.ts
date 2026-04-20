import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/resend';
import { getLegalUpdateEmailHtml } from '@/lib/emails/templates';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import {
  buildEffectiveAtIso,
  formatLegalEffectiveUtcDisplay,
  legalTodayUtc,
  LEGAL_DEFAULT_EFFECTIVE_TIME_UTC,
  parseTimeUtcHm,
  validateLegalEffectiveDate,
} from '@/lib/legal/dates';

function documentTypeShortLabel(
  ta: ReturnType<typeof apiAdminT>,
  document_type: string
): string {
  if (document_type === 'cgu') return ta('legalPublishDocShortCgu');
  if (document_type === 'politique_confidentialite') return ta('legalPublishDocShortPrivacy');
  if (document_type === 'mentions_legales') return ta('legalPublishDocShortMentions');
  return document_type;
}

const VALID_DOCUMENT_TYPES = ['cgu', 'politique_confidentialite', 'mentions_legales'] as const;
type DocumentType = (typeof VALID_DOCUMENT_TYPES)[number];

/**
 * POST /api/admin/legal/publish
 *
 * Publie une nouvelle version d'un document légal.
 * - effective_date + effective_time_utc (HH:mm) → effective_at instant UTC
 * - Préavis 30 j sur la *date* calendaire uniquement ; l’heure précise l’entrée en vigueur / modale
 * - Si effective_at > maintenant → PENDING ; sinon ACTIVE
 * - Email groupé à tous les utilisateurs à la publication (annonce + date d'effet)
 * - Vectorisation immédiate du contenu pour le RAG support
 */
export async function POST(req: NextRequest) {
  const ta = apiAdminT();
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: ta('supabaseAdminMissing') }, { status: 500 });
  }

  let body: {
    document_type: DocumentType;
    content?: string;
    summary_of_changes: string;
    effective_date: string;
    /** Heure d’entrée en vigueur UTC, format HH:mm (défaut 00:00). */
    effective_time_utc?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  const { document_type, content = '', summary_of_changes, effective_date, effective_time_utc } = body;

  if (!VALID_DOCUMENT_TYPES.includes(document_type)) {
    return NextResponse.json(
      { error: ta('legalPublishDocumentTypeInvalid', { valid: VALID_DOCUMENT_TYPES.join(', ') }) },
      { status: 400 }
    );
  }
  if (!summary_of_changes?.trim()) {
    return NextResponse.json({ error: ta('legalPublishSummaryRequired') }, { status: 400 });
  }
  const today = legalTodayUtc();
  const v = validateLegalEffectiveDate(effective_date, today);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  const timeUtc = (effective_time_utc?.trim() || LEGAL_DEFAULT_EFFECTIVE_TIME_UTC).trim();
  if (!parseTimeUtcHm(timeUtc)) {
    return NextResponse.json(
      { error: ta('legalPublishUtcTimeInvalid', { time: timeUtc }) },
      { status: 400 }
    );
  }

  let effectiveAtIso: string;
  try {
    effectiveAtIso = buildEffectiveAtIso(effective_date, timeUtc);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('legalPublishEffectiveAtInvalid') },
      { status: 400 }
    );
  }

  const status: 'PENDING' | 'ACTIVE' =
    new Date(effectiveAtIso).getTime() > Date.now() ? 'PENDING' : 'ACTIVE';

  // — Prochain numéro de version global —
  const { data: maxRow } = await supabase
    .from('legal_versioning')
    .select('version')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const newVersion = (maxRow?.version ?? 0) + 1;

  // — Insertion —
  const { data: insertedDoc, error: insertError } = await supabase
    .from('legal_versioning')
    .insert({
      document_type,
      version: newVersion,
      content,
      summary_of_changes: summary_of_changes.trim(),
      effective_date,
      effective_at: effectiveAtIso,
      status,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[legal/publish] Insert error:', insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // — Vectorisation pour le RAG support —
  let vectorized = false;
  if (insertedDoc?.id && (content.trim() || summary_of_changes.trim())) {
    try {
      const { embedText } = await import('@/lib/support/embeddings');
      const docLabel = documentTypeShortLabel(ta, document_type);
      const textToEmbed = [
        `Document juridique : ${docLabel}`,
        `Version ${newVersion} — Statut : ${status}`,
        `Date et heure d'entrée en vigueur (UTC) : ${effectiveAtIso}`,
        `Résumé des changements : ${summary_of_changes.trim()}`,
        content.trim() ? `Contenu :\n${content.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 12000);

      const embedding = await embedText(textToEmbed);
      await supabase
        .from('legal_versioning')
        .update({ embedding })
        .eq('id', insertedDoc.id);
      vectorized = true;
    } catch (embedErr) {
      console.error('[legal/publish] Vectorization failed (non-bloquant):', embedErr);
    }
  }

  // — Email groupé : annonce à la publication (ACTIVE ou PENDING), date d'effet dans le corps —
  let emailsSent = 0;
  let emailsFailed = 0;
  let totalUsers = 0;

  let allUsers: Array<{ email?: string; full_name?: string }> = [];
  let page = 1;
  const PER_PAGE = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error || !data?.users?.length) break;
    allUsers = allUsers.concat(
      data.users
        .filter((u) => !!u.email)
        .map((u) => ({
          email: u.email,
          full_name: (u.user_metadata?.full_name as string | undefined) ?? undefined,
        }))
    );
    if (data.users.length < PER_PAGE) break;
    page++;
  }

  totalUsers = allUsers.length;

  const effectiveDateFormatted = formatLegalEffectiveUtcDisplay(effectiveAtIso);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.fr';
  const legalPageUrl = `${siteUrl.replace(/\/$/, '')}/fr/legal`;

  const BATCH_SIZE = 50;
  for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
    const batch = allUsers.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (user) => {
        if (!user.email) return;
        const html = getLegalUpdateEmailHtml({
          recipientName: user.full_name,
          documentTypes: [document_type],
          summaryOfChanges: summary_of_changes.trim(),
          effectiveDate: effectiveDateFormatted,
          legalPageUrl,
        });
        const result = await sendEmail({
          to: user.email,
          subject: ta('legalPublishEmailSubject', { label: documentTypeShortLabel(ta, document_type) }),
          html,
        });
        if (result.success) {
          emailsSent++;
        } else {
          emailsFailed++;
        }
      })
    );
    if (i + BATCH_SIZE < allUsers.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log(
    `[legal/publish] v${newVersion} (${document_type}) — status: ${status}, vectorized: ${vectorized}, emails: ${emailsSent}/${totalUsers}`
  );

  return NextResponse.json({
    success: true,
    version: newVersion,
    document_type,
    effective_date,
    effective_at: effectiveAtIso,
    effective_time_utc: timeUtc,
    status,
    vectorized,
    emailsSent,
    emailsFailed,
    totalUsers,
  });
}
