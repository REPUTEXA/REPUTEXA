/**
 * Liste des rapports mensuels de l'utilisateur connecté.
 * Génère des URLs signées pour le téléchargement (bucket privé).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('monthly_reports')
      .select('id, month, year, report_type, pdf_url, summary_stats, created_at')
      .eq('user_id', user.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(24);

    if (error) {
      console.error('[monthly-reports/list]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const reports = (data ?? []).map((r) => {
      const path = `${user.id}/${r.year}-${String(r.month).padStart(2, '0')}.pdf`;
      return {
        ...r,
        pdf_url: r.pdf_url,
        download_path: path,
      };
    });

    const withUrls = await Promise.all(
      reports.map(async (r) => {
        try {
          const { data: signed } = await supabase.storage
            .from('monthly-reports')
            .createSignedUrl(r.download_path, 3600);
          return {
            ...r,
            pdf_url: signed?.signedUrl ?? r.pdf_url,
          };
        } catch {
          return { ...r, pdf_url: r.pdf_url };
        }
      }),
    );

    return NextResponse.json({
      reports: withUrls.map(({ pdf_url: p, id: i, month: m, year: y, report_type: rt, summary_stats: ss, created_at: ca }) => ({
        pdf_url: p,
        id: i,
        month: m,
        year: y,
        report_type: rt,
        summary_stats: ss,
        created_at: ca,
      })),
    });
  } catch (e) {
    console.error('[monthly-reports/list]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
