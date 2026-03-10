import React from 'react';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { toPlanSlug, hasFeature, FEATURES } from '@/lib/feature-gate';
import { resend } from '@/lib/resend';
import { MonthlyReportTemplate } from '@/components/reports/monthly-report-template';
import { pdf } from '@react-pdf/renderer';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  try {
    const auth = request.headers.get('authorization');
    if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 });
    }
    if (!resend) {
      console.warn('[monthly-report] Resend not configured, skipping emails.');
    }

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);
    const monthLabel = from.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });

    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, establishment_name, subscription_plan, selected_plan')
      .neq('email', null);

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    let processed = 0;

    for (const profile of profiles) {
      const planSlug = toPlanSlug(profile.subscription_plan ?? null, profile.selected_plan ?? null);
      if (!hasFeature(planSlug, FEATURES.REPORTING)) continue;

      const { data: reviews } = await admin
        .from('reviews')
        .select('rating, source, created_at')
        .eq('user_id', profile.id)
        .gte('created_at', from.toISOString())
        .lt('created_at', to.toISOString());

      const list = reviews ?? [];
      const totalReviews = list.length;
      const averageRating =
        totalReviews > 0
          ? list.reduce((sum, r) => sum + (r.rating ?? 0), 0) / totalReviews
          : 0;
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
      const platforms = Array.from(platformMap.entries()).map(([name, count]) => ({
        name,
        count,
      }));

      const doc = (
        <MonthlyReportTemplate
          establishmentName={profile.establishment_name ?? 'Mon établissement'}
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

      if (resend && profile.email) {
        await resend.emails.send({
          from: 'REPUTEXA <reports@reputexa.com>',
          to: profile.email,
          subject: `Votre rapport mensuel REPUTEXA — ${monthLabel}`,
          html: `<p>Bonjour ${profile.establishment_name ?? ''},</p><p>Vous trouverez ci-joint votre rapport mensuel REPUTEXA pour ${monthLabel}.</p><p>— L'équipe REPUTEXA</p>`,
          attachments: [
            {
              filename: `reputexa-rapport-${from.getFullYear()}-${from.getMonth() + 1}.pdf`,
              content: buffer.toString('base64'),
              contentType: 'application/pdf',
            },
          ],
        });
      }

      processed += 1;
    }

    return NextResponse.json({ ok: true, processed });
  } catch (error) {
    console.error('[cron/monthly-report]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron failed' },
      { status: 500 },
    );
  }
}

