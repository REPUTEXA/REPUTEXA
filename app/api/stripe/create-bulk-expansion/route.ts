/**
 * POST /api/stripe/create-bulk-expansion
 * Expansion multi-établissements. Délègue au BillingDomainService.
 * L'établissement est "activé" côté UI après réception du webhook invoice.paid (sync quantity).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { createBulkExpansionBodySchema } from '@/lib/validations/stripe';
import { createExpansionSession } from '@/lib/services/billing-domain';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = createBulkExpansionBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'expansionAddCount (1-15) est requis.' },
        { status: 400 }
      );
    }
    const { expansionAddCount } = parsed.data;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email?.trim()) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const baseUrl = getSiteUrl().replace(/\/+$/, '');
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') ?? 'fr';
    const successUrl = `${baseUrl}/${locale}/dashboard/establishments?status=upgraded&openConfig=1`;

    const { url } = await createExpansionSession({
      email: user.email.trim().toLowerCase(),
      addCount: expansionAddCount,
    });

    return NextResponse.json({ url: url || successUrl });
  } catch (err) {
    console.error('[stripe/create-bulk-expansion]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lors de l\'expansion' },
      { status: 500 }
    );
  }
}
