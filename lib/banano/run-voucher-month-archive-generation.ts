/**
 * Génère l’export CSV mensuel des bons (fidélité ou collaborateurs) pour un mois calendaire.
 * Période : tous les bons « concernés » par le mois (créés avant fin de mois et non soldés avant le 1er).
 */

import { endOfMonth, format } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatVoucherRewardLine } from '@/lib/banano/format-voucher-reward';

export const BANANO_VOUCHER_MONTH_ARCHIVE_BUCKET = 'banano-voucher-month-archives';

function csvEscape(cell: string): string {
  const s = cell.replace(/\r\n/g, '\n');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function memberLabel(m: {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const d = (m.display_name ?? '').trim();
  if (d) return d;
  const a = [m.first_name, m.last_name].map((x) => (x ?? '').trim()).filter(Boolean);
  return a.length ? a.join(' ') : '';
}

export type RunVoucherMonthArchiveResult =
  | { ok: true; rowCount: number; summaryLine: string; skipped: boolean }
  | { ok: false; error: string };

export async function runBananoVoucherMonthArchiveGeneration(
  admin: SupabaseClient,
  userId: string,
  periodStart: Date,
  archiveKind: 'loyalty_threshold' | 'staff_allowance'
): Promise<RunVoucherMonthArchiveResult> {
  const monthEnd = endOfMonth(periodStart);
  const startIso = periodStart.toISOString();
  const endIso = new Date(
    monthEnd.getFullYear(),
    monthEnd.getMonth(),
    monthEnd.getDate(),
    23,
    59,
    59,
    999
  ).toISOString();

  const monthStartStr = format(periodStart, 'yyyy-MM-dd');

  const { data: rawRows, error } = await admin
    .from('banano_loyalty_vouchers')
    .select('*')
    .eq('user_id', userId)
    .lte('created_at', endIso)
    .or(`redeemed_at.is.null,redeemed_at.gte.${startIso}`)
    .limit(20_000);

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = (rawRows ?? []).filter((r) => {
    const vc = String((r as { voucher_class?: string | null }).voucher_class ?? 'loyalty_threshold');
    if (archiveKind === 'staff_allowance') return vc === 'staff_allowance';
    return vc !== 'staff_allowance';
  });

  if (rows.length === 0) {
    const { data: prev } = await admin
      .from('banano_loyalty_voucher_month_archives')
      .select('storage_path')
      .eq('user_id', userId)
      .eq('month_start', monthStartStr)
      .eq('archive_kind', archiveKind)
      .maybeSingle();
    const prevPath = String((prev as { storage_path?: string } | null)?.storage_path ?? '');
    if (prevPath) {
      await admin.storage.from(BANANO_VOUCHER_MONTH_ARCHIVE_BUCKET).remove([prevPath]);
    }
    await admin
      .from('banano_loyalty_voucher_month_archives')
      .delete()
      .eq('user_id', userId)
      .eq('month_start', monthStartStr)
      .eq('archive_kind', archiveKind);
    return { ok: true, rowCount: 0, summaryLine: '', skipped: true };
  }

  const memberIds = [...new Set(rows.map((r) => r.member_id as string))];
  const memberMap = new Map<
    string,
    { display_name: string | null; first_name: string | null; last_name: string | null; phone_e164: string }
  >();

  if (memberIds.length > 0) {
    const { data: memRows, error: memErr } = await admin
      .from('banano_loyalty_members')
      .select('id, display_name, first_name, last_name, phone_e164')
      .eq('user_id', userId)
      .in('id', memberIds);

    if (memErr) {
      return { ok: false, error: memErr.message };
    }
    for (const m of memRows ?? []) {
      const row = m as {
        id: string;
        display_name: string | null;
        first_name: string | null;
        last_name: string | null;
        phone_e164: string;
      };
      memberMap.set(row.id, {
        display_name: row.display_name,
        first_name: row.first_name,
        last_name: row.last_name,
        phone_e164: row.phone_e164,
      });
    }
  }

  const { data: profileRow } = await admin.from('profiles').select('locale').eq('id', userId).maybeSingle();
  const archiveLocale = (profileRow as { locale?: string | null } | null)?.locale ?? undefined;

  const lines: string[] = [];
  if (archiveKind === 'loyalty_threshold') {
    lines.push(
      [
        'member_id',
        'nom_client',
        'telephone',
        'code_bon',
        'statut',
        'avantage',
        'seuil',
        'reliquat_points',
        'unite_emission',
        'date_emission_utc',
        'expiration_utc',
        'utilise_le_utc',
      ].join(',')
    );
    for (const r of rows) {
      const mem = memberMap.get(r.member_id as string);
      const nm = mem ? memberLabel(mem) : '';
      const rewardLine = formatVoucherRewardLine(
        {
          reward_kind: String(r.reward_kind),
          reward_percent: r.reward_percent,
          reward_euro_cents: r.reward_euro_cents,
          reward_label: String(r.reward_label ?? ''),
        },
        archiveLocale
      );
      const issuer = String((r as { issuer_unit?: string }).issuer_unit ?? 'points');
      lines.push(
        [
          csvEscape(String(r.member_id)),
          csvEscape(nm),
          csvEscape(mem?.phone_e164 ?? ''),
          csvEscape(String(r.public_code)),
          csvEscape(String(r.status)),
          csvEscape(rewardLine),
          csvEscape(String(r.threshold_snapshot ?? '')),
          csvEscape(String(r.points_balance_after ?? '')),
          csvEscape(issuer),
          csvEscape(String(r.created_at ?? '')),
          csvEscape(r.expires_at != null ? String(r.expires_at) : ''),
          csvEscape(r.redeemed_at != null ? String(r.redeemed_at) : ''),
        ].join(',')
      );
    }
  } else {
    lines.push(
      [
        'member_id',
        'nom',
        'telephone',
        'code_bon',
        'statut',
        'charge_initial_centimes',
        'solde_restant_centimes',
        'cle_mois_allocation',
        'date_emission_utc',
        'expiration_utc',
        'utilise_le_utc',
      ].join(',')
    );
    for (const r of rows) {
      const mem = memberMap.get(r.member_id as string);
      const nm = mem ? memberLabel(mem) : '';
      const init =
        (r as { initial_euro_cents?: number | null }).initial_euro_cents != null
          ? Math.floor(Number((r as { initial_euro_cents?: number | null }).initial_euro_cents))
          : Math.floor(Number(r.threshold_snapshot) || 0);
      const rem = (r as { remaining_euro_cents?: number | null }).remaining_euro_cents;
      const remInt = rem != null ? Math.floor(Number(rem)) : '';
      lines.push(
        [
          csvEscape(String(r.member_id)),
          csvEscape(nm),
          csvEscape(mem?.phone_e164 ?? ''),
          csvEscape(String(r.public_code)),
          csvEscape(String(r.status)),
          csvEscape(String(init)),
          csvEscape(remInt === '' ? '' : String(remInt)),
          csvEscape(String((r as { allowance_month_key?: string | null }).allowance_month_key ?? '')),
          csvEscape(String(r.created_at ?? '')),
          csvEscape(r.expires_at != null ? String(r.expires_at) : ''),
          csvEscape(r.redeemed_at != null ? String(r.redeemed_at) : ''),
        ].join(',')
      );
    }
  }

  const y = periodStart.getFullYear();
  const mo = periodStart.getMonth() + 1;
  const path = `${userId}/${archiveKind}/${y}-${String(mo).padStart(2, '0')}.csv`;
  const body = '\uFEFF' + lines.join('\r\n');
  const buf = Buffer.from(body, 'utf8');

  const { error: upErr } = await admin.storage
    .from(BANANO_VOUCHER_MONTH_ARCHIVE_BUCKET)
    .upload(path, buf, { contentType: 'text/csv; charset=utf-8', upsert: true });

  if (upErr) {
    console.error('[banano/voucher-archive upload]', upErr.message);
    return { ok: false, error: 'Échec enregistrement CSV.' };
  }

  let summaryLine: string;
  if (archiveKind === 'loyalty_threshold') {
    const a = rows.filter((x) => x.status === 'available').length;
    const u = rows.filter((x) => x.status === 'redeemed').length;
    const e = rows.filter((x) => x.status === 'expired').length;
    summaryLine = `${rows.length} bons · ${a} dispo. · ${u} utilisés · ${e} expirés`;
  } else {
    let sumRem = 0;
    for (const r of rows) {
      const rem = (r as { remaining_euro_cents?: number | null }).remaining_euro_cents;
      if (rem != null && r.status === 'available') sumRem += Math.max(0, Math.floor(Number(rem)));
    }
    const eur = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: sumRem % 100 === 0 ? 0 : 2,
    }).format(sumRem / 100);
    summaryLine = `${rows.length} bons · ${eur} solde restant (actifs)`;
  }

  const { error: rowErr } = await admin.from('banano_loyalty_voucher_month_archives').upsert(
    {
      user_id: userId,
      month_start: monthStartStr,
      archive_kind: archiveKind,
      storage_path: path,
      row_count: rows.length,
      summary_line: summaryLine,
    },
    { onConflict: 'user_id,month_start,archive_kind' }
  );

  if (rowErr) {
    console.error('[banano/voucher-archive meta]', rowErr.message);
    return { ok: false, error: 'Métadonnées archive non enregistrées.' };
  }

  return { ok: true, rowCount: rows.length, summaryLine, skipped: false };
}
