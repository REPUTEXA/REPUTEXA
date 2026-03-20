import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/resend';
import { getLegalUpdateEmailHtml } from '@/lib/emails/templates';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  cgu: 'CGU',
  politique_confidentialite: 'Politique de Confidentialité',
  mentions_legales: 'Mentions Légales',
};

const VALID_DOCUMENT_TYPES = ['cgu', 'politique_confidentialite', 'mentions_legales'] as const;
type DocumentType = (typeof VALID_DOCUMENT_TYPES)[number];

/**
 * POST /api/admin/legal/publish
 *
 * Publie une nouvelle version d'un document légal.
 * - Si effective_date > aujourd'hui → status PENDING (pas d'email)
 * - Si effective_date = aujourd'hui → status ACTIVE + envoi email groupé
 * - Vectorisation immédiate du contenu pour le RAG support
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  let body: {
    document_type: DocumentType;
    content?: string;
    summary_of_changes: string;
    effective_date: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { document_type, content = '', summary_of_changes, effective_date } = body;

  if (!VALID_DOCUMENT_TYPES.includes(document_type)) {
    return NextResponse.json(
      { error: `document_type invalide. Valeurs acceptées : ${VALID_DOCUMENT_TYPES.join(', ')}` },
      { status: 400 }
    );
  }
  if (!summary_of_changes?.trim()) {
    return NextResponse.json({ error: 'summary_of_changes est requis' }, { status: 400 });
  }
  if (!effective_date || !/^\d{4}-\d{2}-\d{2}$/.test(effective_date)) {
    return NextResponse.json(
      { error: 'effective_date invalide. Format attendu : YYYY-MM-DD' },
      { status: 400 }
    );
  }

  // — Statut basé sur la date d'entrée en vigueur —
  const today = new Date().toISOString().split('T')[0];
  const status: 'PENDING' | 'ACTIVE' = effective_date > today ? 'PENDING' : 'ACTIVE';

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
      const docLabel = DOCUMENT_TYPE_LABELS[document_type] || document_type;
      const textToEmbed = [
        `Document juridique : ${docLabel}`,
        `Version ${newVersion} — Statut : ${status}`,
        `Date d'entrée en vigueur : ${effective_date}`,
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

  // — Envoi emails uniquement si ACTIVE —
  let emailsSent = 0;
  let emailsFailed = 0;
  let totalUsers = 0;

  if (status === 'ACTIVE') {
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

    const effectiveDateFormatted = new Date(effective_date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

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
            subject: `Mise à jour de nos conditions juridiques — ${DOCUMENT_TYPE_LABELS[document_type]}`,
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
  }

  console.log(
    `[legal/publish] v${newVersion} (${document_type}) — status: ${status}, vectorized: ${vectorized}, emails: ${emailsSent}/${totalUsers}`
  );

  return NextResponse.json({
    success: true,
    version: newVersion,
    document_type,
    effective_date,
    status,
    vectorized,
    emailsSent,
    emailsFailed,
    totalUsers,
  });
}
