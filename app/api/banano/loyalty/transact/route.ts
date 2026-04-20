import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { executeBananoLoyaltyTransact } from '@/lib/banano/loyalty-transact-execute';

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  let body: Parameters<typeof executeBananoLoyaltyTransact>[2];
  try {
    body = (await req.json()) as Parameters<typeof executeBananoLoyaltyTransact>[2];
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const result = await executeBananoLoyaltyTransact(supabase, user.id, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.body);
}
