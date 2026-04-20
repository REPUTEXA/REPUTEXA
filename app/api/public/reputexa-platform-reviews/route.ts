import { NextResponse } from 'next/server';
import { getApprovedReputexaPlatformReviewsForLanding } from '@/lib/reputexa-platform-reviews/landing-data';

export const revalidate = 60;

/**
 * Témoignages produit approuvés (lecture publique, cache court).
 */
export async function GET() {
  const items = await getApprovedReputexaPlatformReviewsForLanding();
  return NextResponse.json(
    { items },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    },
  );
}
