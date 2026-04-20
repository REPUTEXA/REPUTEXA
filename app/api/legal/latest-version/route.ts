import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchCurrentPublishedLegal } from '@/lib/legal/current-published';

/**
 * GET /api/legal/latest-version
 * Version légale actuellement en vigueur (ACTIVE, effective_date ≤ aujourd'hui UTC).
 */
export async function GET() {
  const supabase = await createClient();
  const published = await fetchCurrentPublishedLegal(supabase);

  if (!published) {
    return NextResponse.json({ version: 0 });
  }

  return NextResponse.json({ version: published.version });
}
