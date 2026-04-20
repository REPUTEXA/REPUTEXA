import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runOperationalAuditOnProposal } from '@/lib/admin/code-guardian-operational-audit';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { code?: unknown; contextNotes?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  const code = typeof body.code === 'string' ? body.code : '';
  const contextNotes = typeof body.contextNotes === 'string' ? body.contextNotes : '';

  if (!code.trim()) {
    return NextResponse.json({ error: ta('codeGuardianCodeSnippetRequired') }, { status: 400 });
  }
  if (code.length > 120_000) {
    return NextResponse.json({ error: ta('codeGuardianSnippetTooLarge') }, { status: 400 });
  }

  const result = runOperationalAuditOnProposal(code, contextNotes);
  return NextResponse.json(result);
}
