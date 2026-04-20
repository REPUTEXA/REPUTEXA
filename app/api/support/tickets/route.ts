import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Détecte si l'erreur est due à une colonne manquante (migration pas encore appliquée)
function isMissingColumn(e: unknown, col: string): boolean {
  if (!e || typeof e !== 'object') return false;
  const msg = ('message' in e ? String((e as { message: unknown }).message) : '');
  const code = ('code'    in e ? String((e as { code:    unknown }).code)    : '');
  return code === '42703' || msg.includes(`column`) && msg.includes(col);
}

/**
 * GET — liste des tickets ( ?status=open|archived|all )
 * POST — crée un ticket ouvert
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiJsonError(request, 'unauthorized', 401);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? 'all';

    const buildQuery = (withTitle: boolean, withGravity: boolean) => {
      const gravityCol = withGravity ? ', gravity_score' : '';
      const cols = withTitle
        ? `id, status, title, created_at, updated_at${gravityCol}`
        : `id, status, created_at, updated_at${gravityCol}`;
      let q = supabase.from('tickets').select(cols).eq('user_id', user.id);
      if (status === 'open' || status === 'archived') q = q.eq('status', status);
      if (status === 'open' && withGravity) {
        q = q
          .order('gravity_score', { ascending: false, nullsFirst: false })
          .order('updated_at', { ascending: false });
      } else {
        q = q.order('updated_at', { ascending: false });
      }
      return q;
    };

    let { data, error } = await buildQuery(true, true);

    if (error && isMissingColumn(error, 'gravity_score')) {
      console.warn('[tickets GET] colonne gravity_score absente — fallback sans tri gravité');
      ({ data, error } = await buildQuery(true, false));
    }

    // Fallback : colonne title absente (migration 076 pas encore appliquée)
    if (error && isMissingColumn(error, 'title')) {
      console.warn('[tickets GET] colonne title absente — fallback sans title');
      ({ data, error } = await buildQuery(false, true));
      if (error && isMissingColumn(error, 'gravity_score')) {
        ({ data, error } = await buildQuery(false, false));
      }
    }

    if (error) throw error;

    const tickets = (data ?? []).map((t) => ({ title: null, ...(t as unknown as Record<string, unknown>) }));
    return NextResponse.json({ tickets });
  } catch (e) {
    console.error('[api/support/tickets GET]', e);
    return apiJsonError(request, 'serverError', 500);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiJsonError(request, 'unauthorized', 401);

    // Essayer avec title
    let { data, error } = await supabase
      .from('tickets')
      .insert({ user_id: user.id, status: 'open' })
      .select('id, status, title, created_at, updated_at')
      .single();

    // Fallback : colonne title absente
    if (error && isMissingColumn(error, 'title')) {
      console.warn('[tickets POST] colonne title absente — fallback sans title');
      ({ data, error } = await supabase
        .from('tickets')
        .insert({ user_id: user.id, status: 'open' })
        .select('id, status, created_at, updated_at')
        .single());
    }

    if (error) throw error;

    return NextResponse.json({ ticket: { title: null, ...data } });
  } catch (e) {
    console.error('[api/support/tickets POST]', e);
    return apiJsonError(request, 'serverError', 500);
  }
}
