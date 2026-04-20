import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { assertStaffTerminalPinFormat, hashBananoPin } from '@/lib/banano/pin-crypto';

type Ctx = { params: Promise<{ id: string }> };

type PatchBody = { display_name?: string; pin?: string; is_active?: boolean };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: tm('invalidIdentifier') }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const patch: Record<string, unknown> = {};

  if (body.display_name !== undefined) {
    const name = String(body.display_name).trim();
    if (name.length < 1 || name.length > 80) {
      return NextResponse.json({ error: tm('bananoStaffDisplayNameInvalid') }, { status: 400 });
    }
    patch.display_name = name;
  }

  if (body.pin !== undefined) {
    const p = String(body.pin);
    try {
      assertStaffTerminalPinFormat(p);
    } catch {
      return NextResponse.json({ error: tm('bananoStaffTerminalPinInvalid') }, { status: 400 });
    }
    const plain = p.trim();
    patch.pin_hash = hashBananoPin(plain);
    patch.pin_public_code = plain;
  }

  if (body.is_active !== undefined) {
    patch.is_active = Boolean(body.is_active);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: tm('noUpdateFields') }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('banano_terminal_staff')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, display_name, is_active, created_at, pin_public_code, loyalty_member_id')
    .maybeSingle();

  if (error) {
    console.error('[banano/staff PATCH]', error.message);
    if (/unique|duplicate/i.test(error.message)) {
      return NextResponse.json({ error: tm('staffPinCodeDuplicate') }, { status: 400 });
    }
    return NextResponse.json({ error: tm('updateFailed') }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: tm('bananoTerminalStaffNotFound') }, { status: 404 });
  }

  return NextResponse.json({ staff: data });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(_req));

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(_req, 'unauthorized', 401);
  }

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: tm('invalidIdentifier') }, { status: 400 });
  }

  const { data: before } = await supabase
    .from('banano_terminal_staff')
    .select('id, loyalty_member_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  const memId =
    before && typeof (before as { loyalty_member_id?: string | null }).loyalty_member_id === 'string'
      ? (before as { loyalty_member_id: string }).loyalty_member_id
      : null;

  const { data, error } = await supabase
    .from('banano_terminal_staff')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id');

  if (error) {
    console.error('[banano/staff DELETE]', error.message);
    return NextResponse.json({ error: tm('bananoStaffDeleteFailed') }, { status: 500 });
  }

  if (!data?.length) {
    return NextResponse.json({ error: tm('bananoTerminalStaffNotFound') }, { status: 404 });
  }

  if (memId) {
    await supabase
      .from('banano_loyalty_members')
      .update({ crm_role: 'customer', receives_staff_allowance: false })
      .eq('id', memId)
      .eq('user_id', user.id);
  }

  return NextResponse.json({ ok: true });
}
