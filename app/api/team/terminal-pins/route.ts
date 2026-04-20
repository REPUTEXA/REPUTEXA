import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';

/** PINs terminal Banano du marchand (pour lier un salarié app ↔ équipier caisse). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if ((profile as { role?: string } | null)?.role === 'merchant_staff') {
    return apiJsonError(request, 'forbidden', 403);
  }

  const { data: rows, error } = await supabase
    .from('banano_terminal_staff')
    .select('id, display_name, is_active, linked_auth_user_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('display_name', { ascending: true });

  if (error) {
    console.error('[team/terminal-pins]', error.message);
    return apiJsonError(request, 'serverError', 500);
  }

  return NextResponse.json({
    pins: (rows ?? []).map((r) => {
      const row = r as {
        id: string;
        display_name: string;
        linked_auth_user_id: string | null;
      };
      return {
        id: row.id,
        displayName: row.display_name,
        linkedAuthUserId: row.linked_auth_user_id,
      };
    }),
  });
}
