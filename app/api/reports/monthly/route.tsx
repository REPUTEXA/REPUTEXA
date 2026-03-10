import React from 'react';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MonthlyReportTemplate } from '@/components/reports/monthly-report-template';
import { pdf } from '@react-pdf/renderer';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('establishment_name')
      .eq('id', user.id)
      .single();

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);
    const monthLabel = from.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });

    const { data: reviews } = await supabase
      .from('reviews')
      .select('rating, source, created_at')
      .eq('user_id', user.id)
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString());

    const list = reviews ?? [];
    const totalReviews = list.length;
    const averageRating =
      totalReviews > 0 ? list.reduce((sum, r) => sum + (r.rating ?? 0), 0) / totalReviews : 0;
    const positiveCount = list.filter((r) => (r.rating ?? 0) >= 4).length;
    const negativeCount = list.filter((r) => (r.rating ?? 0) <= 3).length;

    const platformMap = new Map<string, number>();
    list.forEach((r) => {
      const src = String(r.source ?? '').toLowerCase();
      let key = 'Autre';
      if (src.includes('google')) key = 'Google';
      else if (src.includes('trip') || src.includes('advisor')) key = 'Tripadvisor';
      else if (src.includes('yelp')) key = 'Yelp';
      platformMap.set(key, (platformMap.get(key) ?? 0) + 1);
    });
    const platforms = Array.from(platformMap.entries()).map(([name, count]) => ({ name, count }));

    const doc = (
      <MonthlyReportTemplate
        establishmentName={profile?.establishment_name ?? 'Mon établissement'}
        monthLabel={monthLabel}
        averageRating={averageRating}
        totalReviews={totalReviews}
        positiveCount={positiveCount}
        negativeCount={negativeCount}
        platforms={platforms}
        insights={[]}
      />
    );
    const buffer = await pdf(doc).toBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="reputexa-rapport-${from.getFullYear()}-${from.getMonth() + 1}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[reports/monthly]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Report failed' },
      { status: 500 },
    );
  }
}

