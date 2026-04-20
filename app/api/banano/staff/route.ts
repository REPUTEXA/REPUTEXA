import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { assertStaffTerminalPinFormat, hashBananoPin } from '@/lib/banano/pin-crypto';

function staffLabelFromMember(
  m: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  },
  memberFallback: string
): string {
  const d = (m.display_name ?? '').trim();
  if (d) return d.slice(0, 80);
  const a = [m.first_name, m.last_name]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return (a || memberFallback).slice(0, 80);
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const { data: staff, error } = await supabase
    .from('banano_terminal_staff')
    .select('id, display_name, is_active, created_at, pin_public_code, loyalty_member_id')
    .eq('user_id', user.id)
    .order('display_name', { ascending: true });

  if (error) {
    console.error('[banano/staff GET]', error.message);
    return NextResponse.json({ error: tm('readFailed') }, { status: 500 });
  }

  const rows = staff ?? [];
  const memIds = [...new Set(rows.map((s) => s.loyalty_member_id).filter((id): id is string => typeof id === 'string'))];
  const phoneByMember = new Map<string, string>();
  if (memIds.length > 0) {
    const { data: mems, error: memErr } = await supabase
      .from('banano_loyalty_members')
      .select('id, phone_e164')
      .eq('user_id', user.id)
      .in('id', memIds);
    if (!memErr) {
      for (const m of mems ?? []) {
        phoneByMember.set(m.id as string, String((m as { phone_e164: string }).phone_e164));
      }
    }
  }

  const enriched = rows.map((s) => ({
    id: s.id as string,
    display_name: s.display_name as string,
    is_active: s.is_active as boolean,
    created_at: s.created_at as string,
    pin_public_code: s.pin_public_code as string | null | undefined,
    loyalty_member_id: (s.loyalty_member_id as string | null) ?? null,
    member_phone_e164:
      s.loyalty_member_id && typeof s.loyalty_member_id === 'string'
        ? phoneByMember.get(s.loyalty_member_id) ?? null
        : null,
  }));

  return NextResponse.json({ staff: enriched });
}

type PostBody = { pin: string; loyalty_member_id: string };

export async function POST(req: Request) {
  const supabase = await createClient();
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const memberId = String(body.loyalty_member_id ?? '').trim();
  if (!memberId) {
    return NextResponse.json({ error: tm('staffSelectMemberRequired') }, { status: 400 });
  }

  try {
    assertStaffTerminalPinFormat(body.pin ?? '');
  } catch {
    return NextResponse.json({ error: tm('bananoStaffTerminalPinInvalid') }, { status: 400 });
  }

  const { data: mem, error: memErr } = await supabase
    .from('banano_loyalty_members')
    .select('id, display_name, first_name, last_name, user_id')
    .eq('id', memberId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memErr || !mem) {
    return NextResponse.json({ error: tm('recordNotFound') }, { status: 404 });
  }

  const { data: dup } = await supabase
    .from('banano_terminal_staff')
    .select('id')
    .eq('user_id', user.id)
    .eq('loyalty_member_id', memberId)
    .maybeSingle();

  if (dup) {
    return NextResponse.json({ error: tm('staffMemberOneTillCode') }, { status: 400 });
  }

  const memberFallback = tm('crmVoucherArchiveMemberFallback');
  const name = staffLabelFromMember(mem as Record<string, unknown>, memberFallback);
  const pinPlain = (body.pin ?? '').trim();
  const pin_hash = hashBananoPin(pinPlain);

  const insertRow = {
    user_id: user.id,
    display_name: name,
    loyalty_member_id: memberId,
    pin_hash,
    pin_public_code: pinPlain,
    is_active: true,
  };

  const { data, error } = await supabase
    .from('banano_terminal_staff')
    .insert(insertRow)
    .select('id, display_name, is_active, created_at, pin_public_code, loyalty_member_id')
    .single();

  if (error) {
    console.error('[banano/staff POST]', error.message);
    if (/unique|duplicate/i.test(error.message)) {
      return NextResponse.json({ error: tm('staffPinCodeDuplicate') }, { status: 400 });
    }
    return NextResponse.json({ error: tm('memberCreateFailed') }, { status: 500 });
  }

  const { error: upMemErr } = await supabase
    .from('banano_loyalty_members')
    .update({ crm_role: 'staff', receives_staff_allowance: true })
    .eq('id', memberId)
    .eq('user_id', user.id);

  if (upMemErr) {
    console.error('[banano/staff POST member sync]', upMemErr.message);
    await supabase.from('banano_terminal_staff').delete().eq('id', data.id).eq('user_id', user.id);
    return NextResponse.json({ error: tm('staffMemberLinkFailed') }, { status: 500 });
  }

  const { data: memRow } = await supabase
    .from('banano_loyalty_members')
    .select('id, phone_e164')
    .eq('id', memberId)
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({
    staff: {
      ...data,
      member_phone_e164: memRow ? String((memRow as { phone_e164: string }).phone_e164) : null,
    },
  });
}
