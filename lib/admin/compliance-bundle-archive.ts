/**
 * Archivage PDF dossier conformité — Supabase Storage + table admin_compliance_bundle_archives.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createTranslator } from 'next-intl';

import { loadOperatorChecklist, normalizeOperatorChecklist } from '@/lib/admin/admin-operator-checklist';
import { internalOpsMessageLocale } from '@/lib/admin/internal-ops-locale';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { buildComplianceBundlePdf, monthRangeUtcIso } from '@/lib/admin/compliance-bundle-pdf';

export const COMPLIANCE_BUNDLE_BUCKET = 'admin-compliance-bundles';

export type ComplianceBundleArchiveSource = 'cron' | 'manual';

export async function createComplianceBundleArchive(
  admin: SupabaseClient,
  opts: {
    year: number;
    month: number;
    signedBy: string | null;
    source: ComplianceBundleArchiveSource;
    createdByUserId: string | null;
    /** Si true et source cron : pas d’insert si une archive cron existe déjà pour ce mois. */
    skipIfCronExists?: boolean;
  }
): Promise<
  | { ok: true; id: string }
  | { ok: true; skipped: true }
  | { ok: false; error: string }
> {
  if (opts.skipIfCronExists && opts.source === 'cron') {
    const { data: existing, error: selErr } = await admin
      .from('admin_compliance_bundle_archives')
      .select('id')
      .eq('period_year', opts.year)
      .eq('period_month', opts.month)
      .eq('source', 'cron')
      .maybeSingle();
    if (selErr) return { ok: false, error: selErr.message };
    if (existing?.id) return { ok: true, skipped: true };
  }

  const raw = await loadOperatorChecklist(admin);
  const operator = normalizeOperatorChecklist(raw);
  const { start, end } = monthRangeUtcIso(opts.year, opts.month);
  const inMonth = (iso: string) => {
    const t = iso.trim();
    return t >= start && t < end;
  };
  const logN = operator.log.filter((e) => inMonth(e.at)).length;
  const snapN = operator.snapshots.filter((s) => inMonth(s.at)).length;

  const pdf = await buildComplianceBundlePdf({
    year: opts.year,
    month: opts.month,
    signedBy: opts.signedBy,
    operator,
  });

  const buf = Buffer.from(pdf.output('arraybuffer'));
  const content_sha256 = createHash('sha256').update(buf).digest('hex');
  const idFrag = randomBytes(4).toString('hex');
  const folder = opts.source === 'cron' ? 'cron' : `manual/${opts.createdByUserId ?? 'unknown'}`;
  const storagePath = `${folder}/${opts.year}-${String(opts.month).padStart(2, '0')}-${Date.now()}-${idFrag}.pdf`;
  const file_name = `REPUTEXA-Dossier-Conformite-${opts.year}-${String(opts.month).padStart(2, '0')}-${idFrag}.pdf`;

  const up = await admin.storage.from(COMPLIANCE_BUNDLE_BUCKET).upload(storagePath, buf, {
    contentType: 'application/pdf',
    upsert: false,
  });

  if (up.error) {
    return { ok: false, error: up.error.message };
  }

  const { data: row, error: insErr } = await admin
    .from('admin_compliance_bundle_archives')
    .insert({
      created_by: opts.createdByUserId,
      source: opts.source,
      period_year: opts.year,
      period_month: opts.month,
      storage_path: storagePath,
      file_name,
      byte_size: buf.length,
      content_sha256,
      signed_by: opts.signedBy,
      summary: {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        logEntriesInPeriod: logN,
        snapshotsInPeriod: snapN,
      },
    })
    .select('id')
    .single();

  if (insErr) {
    await admin.storage.from(COMPLIANCE_BUNDLE_BUCKET).remove([storagePath]);
    const dup =
      opts.source === 'cron' &&
      (insErr.code === '23505' || /duplicate key|unique constraint/i.test(insErr.message ?? ''));
    if (dup) return { ok: true, skipped: true };
    return { ok: false, error: insErr.message };
  }

  if (!row?.id) {
    await admin.storage.from(COMPLIANCE_BUNDLE_BUCKET).remove([storagePath]);
    const locale = internalOpsMessageLocale();
    const messages = getServerMessagesForLocale(locale);
    const tErr = createTranslator({ locale, messages, namespace: 'Admin.complianceBundleArchive' });
    return { ok: false, error: tErr('insertMissingId') };
  }

  return { ok: true, id: row.id };
}

/** Mois civil UTC précédent (ex. le 1er avril → mars). */
export function previousUtcMonth(now: Date = new Date()): { year: number; month: number } {
  const cur = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  cur.setUTCMonth(cur.getUTCMonth() - 1);
  return { year: cur.getUTCFullYear(), month: cur.getUTCMonth() + 1 };
}
