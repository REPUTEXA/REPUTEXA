import { createHash } from 'crypto';
import { gzipSync } from 'zlib';
import type { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { getBlackBoxS3Config, putGzipArchive } from '@/lib/black-box/s3-io';

function openaiForArchive(): OpenAI | null {
  const k = process.env.OPENAI_API_KEY?.trim();
  if (!k) return null;
  return new OpenAI({ apiKey: k });
}

function utcDayFolder(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function retentionCutoffIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

async function getWatermark(admin: SupabaseClient, table: string): Promise<string> {
  const { data } = await admin
    .from('black_box_archive_watermark')
    .select('last_archived_at')
    .eq('source_table', table)
    .maybeSingle();
  const t = data?.last_archived_at as string | undefined;
  return t ?? '1970-01-01T00:00:00.000Z';
}

async function setWatermark(admin: SupabaseClient, table: string, at: string): Promise<void> {
  const { error } = await admin.from('black_box_archive_watermark').upsert(
    { source_table: table, last_archived_at: at, updated_at: new Date().toISOString() },
    { onConflict: 'source_table' }
  );
  if (error) throw new Error(error.message);
}

async function archiveBatch(args: {
  admin: SupabaseClient;
  table: string;
  kind: string;
  rows: Record<string, unknown>[];
  deleteIds?: string[];
  hotDeleted: boolean;
}): Promise<{ bytes: number; s3Key: string } | null> {
  const { admin, table, kind, rows, deleteIds, hotDeleted } = args;
  if (rows.length === 0) return null;

  const cfg = getBlackBoxS3Config();
  if (!cfg) {
    console.warn('[black-box] SKIP — pas de BACKUP_S3_*');
    return null;
  }

  const payload = {
    v: 1,
    archived_at: new Date().toISOString(),
    source_table: table,
    kind,
    row_count: rows.length,
    rows,
  };
  const json = JSON.stringify(payload);
  const contentSha256 = sha256Hex(json);

  const { data: dup } = await admin
    .from('black_box_archive_index')
    .select('id')
    .eq('source_table', table)
    .eq('content_sha256', contentSha256)
    .maybeSingle();

  if (dup?.id) {
    if (!deleteIds?.length && table === 'reviews') {
      const lastAt = rows[rows.length - 1]?.created_at as string | undefined;
      if (lastAt) await setWatermark(admin, table, lastAt);
    }
    return null;
  }

  const gz = gzipSync(Buffer.from(json, 'utf8'), { level: 9 });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const s3Key = `black-box/${table}/${utcDayFolder(new Date())}/${contentSha256.slice(0, 12)}-${stamp}.json.gz`;

  await putGzipArchive(cfg.bucket, s3Key, gz);

  const ids: string[] = [];
  const userIds = new Set<string>();
  const parts: string[] = [];

  for (const r of rows) {
    const id = r.id as string | undefined;
    if (id) ids.push(id);
    const uid = r.user_id as string | undefined;
    if (uid) userIds.add(uid);
    if (table === 'support_audit_log') {
      parts.push(
        String(r.action_type ?? ''),
        String(r.ticket_id ?? ''),
        JSON.stringify(r.metadata ?? {}).slice(0, 400)
      );
    } else if (table === 'review_queue') {
      parts.push(
        String(r.first_name ?? ''),
        String(r.phone ?? ''),
        String(r.source_info ?? ''),
        String(r.status ?? '')
      );
    } else if (table === 'contact_messages') {
      parts.push(
        String(r.name ?? ''),
        String(r.email ?? ''),
        String(r.subject ?? ''),
        String(r.message ?? '').slice(0, 500)
      );
    } else if (table === 'reviews') {
      parts.push(
        String(r.reviewer_name ?? ''),
        String(r.comment ?? '').slice(0, 800),
        String(r.ai_response ?? '').slice(0, 400),
        String(r.response_text ?? '').slice(0, 400),
        `note=${String(r.rating ?? '')}`,
        String(r.source ?? '')
      );
    }
  }

  let aiSummary: string | null = null;
  const oai = openaiForArchive();
  if (process.env.BLACK_BOX_AI_SUMMARY === '1' && oai) {
    const rawSearch = parts.join(' ').slice(0, 6000);
    try {
      const c = await oai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content:
              'Tu résumes en 1 à 3 phrases françaises le contenu archivé (lot de lignes BDD). ' +
              'Pas de markdown. Mentionne type de données et période si visible.',
          },
          { role: 'user', content: rawSearch },
        ],
      });
      aiSummary = c.choices[0]?.message?.content?.trim().slice(0, 1200) ?? null;
    } catch (e) {
      console.warn('[black-box] ai summary', e instanceof Error ? e.message : e);
    }
  }

  const occurredTimes = rows
    .map((r) => {
      const t = (r.created_at ?? r.sent_at ?? r.updated_at) as string | undefined;
      return t ? new Date(t).getTime() : NaN;
    })
    .filter((n) => Number.isFinite(n));

  const occurredAtMin =
    occurredTimes.length > 0 ? new Date(Math.min(...occurredTimes)).toISOString() : new Date().toISOString();
  const occurredAtMax =
    occurredTimes.length > 0 ? new Date(Math.max(...occurredTimes)).toISOString() : new Date().toISOString();

  const { error: insErr } = await admin.from('black_box_archive_index').insert({
    source_kind: kind,
    source_table: table,
    occurred_at_min: occurredAtMin,
    occurred_at_max: occurredAtMax,
    row_count: rows.length,
    source_ids: ids,
    user_ids: [...userIds],
    search_text: parts.join(' ').slice(0, 32000),
    s3_bucket: cfg.bucket,
    s3_key: s3Key,
    content_sha256: contentSha256,
    gzip_bytes: gz.length,
    approx_plain_bytes: Buffer.byteLength(json, 'utf8'),
    compression: 'gzip',
    hot_deleted: hotDeleted,
    ai_summary: aiSummary,
  });

  if (insErr) {
    console.error('[black-box] index insert', insErr);
    throw new Error(insErr.message);
  }

  if (deleteIds && deleteIds.length > 0) {
    const { error: delErr } = await admin.from(table).delete().in('id', deleteIds);
    if (delErr) {
      console.error('[black-box] hot delete', table, delErr);
      throw new Error(delErr.message);
    }
  }

  return { bytes: gz.length, s3Key };
}

export type ArchiveRunSummary = {
  batches: number;
  rows: number;
  bytes: number;
  skippedReason?: string;
  /** Ex. fenêtre hot actuelle en jours (pour messages UI) */
  skippedDetail?: string;
};

export async function runBlackBoxArchivePass(admin: SupabaseClient): Promise<ArchiveRunSummary> {
  const enabled = process.env.BLACK_BOX_ARCHIVE_ENABLED !== '0';
  if (!enabled) {
    return { batches: 0, rows: 0, bytes: 0, skippedReason: 'BLACK_BOX_ARCHIVE_ENABLED=0' };
  }
  if (!getBlackBoxS3Config()) {
    return { batches: 0, rows: 0, bytes: 0, skippedReason: 'pas de BACKUP_S3_*' };
  }

  const days = Math.max(7, Math.min(365, Number(process.env.BLACK_BOX_HOT_RETENTION_DAYS ?? '30') || 30));
  const cutoff = retentionCutoffIso(days);
  const batchLimit = Math.min(800, Math.max(50, Number(process.env.BLACK_BOX_BATCH_ROWS ?? '400') || 400));

  let batches = 0;
  let rows = 0;
  let bytes = 0;

  /* ── support_audit_log : supprimer après archive ── */
  const { data: auditRows, error: auditErr } = await admin
    .from('support_audit_log')
    .select('*')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(batchLimit);

  if (auditErr && !auditErr.message.includes('does not exist')) {
    console.warn('[black-box] support_audit_log', auditErr.message);
  } else if (auditRows && auditRows.length > 0) {
    const ids = auditRows.map((r) => r.id as string);
    const res = await archiveBatch({
      admin,
      table: 'support_audit_log',
      kind: 'nexus_audit',
      rows: auditRows as Record<string, unknown>[],
      deleteIds: ids,
      hotDeleted: true,
    });
    if (res) {
      batches += 1;
      rows += auditRows.length;
      bytes += res.bytes;
    }
  }

  /* ── review_queue : statuts terminaux (> rétention) ── */
  const [rqSent, rqFail] = await Promise.all([
    admin
      .from('review_queue')
      .select('*')
      .eq('status', 'sent')
      .not('sent_at', 'is', null)
      .lt('sent_at', cutoff)
      .order('sent_at', { ascending: true })
      .limit(batchLimit),
    admin
      .from('review_queue')
      .select('*')
      .in('status', ['failed', 'cancelled'])
      .lt('updated_at', cutoff)
      .order('updated_at', { ascending: true })
      .limit(batchLimit),
  ]);

  if (rqSent.error && !rqSent.error.message.includes('does not exist')) {
    console.warn('[black-box] review_queue sent', rqSent.error.message);
  }
  if (rqFail.error && !rqFail.error.message.includes('does not exist')) {
    console.warn('[black-box] review_queue fail', rqFail.error.message);
  }

  const rqMerged = [...(rqSent.data ?? []), ...(rqFail.data ?? [])].slice(0, batchLimit);
  if (rqMerged.length > 0) {
    const ids = rqMerged.map((r) => r.id as string);
    const res = await archiveBatch({
      admin,
      table: 'review_queue',
      kind: 'zenith_queue',
      rows: rqMerged as Record<string, unknown>[],
      deleteIds: ids,
      hotDeleted: true,
    });
    if (res) {
      batches += 1;
      rows += rqMerged.length;
      bytes += res.bytes;
    }
  }

  /* ── contact_messages ── */
  const { data: cmRows, error: cmErr } = await admin
    .from('contact_messages')
    .select('*')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(batchLimit);

  if (cmErr && !cmErr.message.includes('does not exist')) {
    console.warn('[black-box] contact_messages', cmErr.message);
  } else if (cmRows && cmRows.length > 0) {
    const ids = cmRows.map((r) => r.id as string);
    const res = await archiveBatch({
      admin,
      table: 'contact_messages',
      kind: 'contact_form',
      rows: cmRows as Record<string, unknown>[],
      deleteIds: ids,
      hotDeleted: true,
    });
    if (res) {
      batches += 1;
      rows += cmRows.length;
      bytes += res.bytes;
    }
  }

  /* ── reviews : mirror seulement (watermark) ── */
  const wm = await getWatermark(admin, 'reviews');
  const { data: revRows, error: revErr } = await admin
    .from('reviews')
    .select(
      'id, user_id, reviewer_name, rating, comment, source, response_text, ai_response, status, created_at, establishment_id'
    )
    .gt('created_at', wm)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(Math.min(200, batchLimit));

  if (revErr && !revErr.message.includes('does not exist')) {
    console.warn('[black-box] reviews', revErr.message);
  } else if (revRows && revRows.length > 0) {
    const res = await archiveBatch({
      admin,
      table: 'reviews',
      kind: 'review_mirror',
      rows: revRows as Record<string, unknown>[],
      hotDeleted: false,
    });
    if (res) {
      batches += 1;
      rows += revRows.length;
      bytes += res.bytes;
      const lastAt = revRows[revRows.length - 1]?.created_at as string;
      if (lastAt) await setWatermark(admin, 'reviews', lastAt);
    }
  }

  const out: ArchiveRunSummary = { batches, rows, bytes };
  if (batches === 0 && rows === 0) {
    out.skippedReason = 'no_eligible_rows';
    out.skippedDetail = `${days}j`;
  }
  return out;
}
