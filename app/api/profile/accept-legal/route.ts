import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/profile/accept-legal
 *
 * Enregistre l'acceptation des nouvelles conditions légales par l'utilisateur connecté.
 *
 * Body JSON :
 *   { version: number }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let version: number;
  try {
    const body = await req.json();
    version = Number(body.version);
    if (!Number.isInteger(version) || version < 1) throw new Error('invalid');
  } catch {
    return NextResponse.json({ error: 'version invalide' }, { status: 400 });
  }

  const { error } = await supabase
    .from('profiles')
    .update({ last_legal_agreement_version: version })
    .eq('id', user.id);

  if (error) {
    console.error('[accept-legal]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, version });
}
