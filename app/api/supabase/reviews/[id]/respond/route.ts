import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { responseText } = body as { responseText?: string };

    if (!responseText || typeof responseText !== 'string') {
      return apiJsonError(request, 'errors.responseTextRequired', 400);
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const { data, error } = await supabase
      .from('reviews')
      .update({ response_text: responseText })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return apiJsonError(request, 'errors.reviewNotFound', 404);
    }

    return NextResponse.json({ id, success: true });
  } catch (error) {
    console.error('[supabase/reviews/respond]', error);
    return apiJsonError(request, 'serverError', 500);
  }
}
