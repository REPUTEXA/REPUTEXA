import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';

/**
 * Déconnecte Google Business Profile : efface google_location_id etc.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        google_location_id: null,
        google_location_name: null,
        google_location_address: null,
        google_connected_at: null,
      })
      .eq('id', user.id);

    if (error) {
      return apiJsonError(request, 'serverError', 500);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return apiJsonError(request, 'serverError', 500);
  }
}
