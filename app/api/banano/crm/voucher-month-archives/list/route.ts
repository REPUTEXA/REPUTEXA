import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/server';
import type { VoucherMonthArchiveListItem } from '@/lib/banano/voucher-month-archive-types';

export const dynamic = 'force-dynamic';

function mapRow(r: {
  month_start: string;
  summary_line: string | null;
  row_count: number | null;
  created_at: string;
}): VoucherMonthArchiveListItem {
  const d = parseISO(String(r.month_start));
  const lf = format(d, 'MMMM yyyy', { locale: fr });
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    labelFr: lf.charAt(0).toUpperCase() + lf.slice(1),
    summaryLine: String(r.summary_line ?? ''),
    rowCount: Math.max(0, Math.floor(Number(r.row_count ?? 0))),
    createdAt: String(r.created_at ?? ''),
  };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const { data: loyaltyRows, error: lErr } = await supabase
    .from('banano_loyalty_voucher_month_archives')
    .select('month_start, summary_line, row_count, created_at')
    .eq('user_id', user.id)
    .eq('archive_kind', 'loyalty_threshold')
    .order('month_start', { ascending: false })
    .limit(48);

  const { data: staffRows, error: sErr } = await supabase
    .from('banano_loyalty_voucher_month_archives')
    .select('month_start, summary_line, row_count, created_at')
    .eq('user_id', user.id)
    .eq('archive_kind', 'staff_allowance')
    .order('month_start', { ascending: false })
    .limit(48);

  if (lErr || sErr) {
    console.error('[voucher-month-archives/list]', lErr?.message, sErr?.message);
    return apiJsonError(request, 'errors.crm_readFailed', 500);
  }

  const loyalty = (loyaltyRows ?? []).map(mapRow);
  const staff = (staffRows ?? []).map(mapRow);

  return NextResponse.json({ loyalty, staff });
}
