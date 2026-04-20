import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createClient } from '@/lib/supabase/server';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { normalizePhoneE164 } from '@/lib/banano/phone';
import { preferredAppLocaleFromE164 } from '@/lib/banano/member-preferred-locale';
import { formatTerminalClientName } from '@/lib/banano/terminal-client-name-format';
import { assertTerminalStaffActive } from '@/lib/banano/assert-terminal-staff';
import { BANANO_PROFILE_LOYALTY_COLUMNS } from '@/lib/banano/loyalty-profile-columns';
import { loyaltyConfigFromProfileRow } from '@/lib/banano/loyalty-profile';
import { ensureSignupWelcomeVoucher } from '@/lib/banano/signup-welcome-voucher';

export async function GET(req: Request) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';
  if (!q) {
    return NextResponse.json({ members: [] });
  }

  const n = normalizePhoneE164(q);
  if (n) {
    const { data, error } = await supabase
      .from('banano_loyalty_members')
      .select('*')
      .eq('user_id', user.id)
      .eq('phone_e164', n)
      .maybeSingle();
    if (error) {
      console.error('[banano/members GET]', error.message);
      return NextResponse.json({ error: tm('crmMembersReadError') }, { status: 500 });
    }
    return NextResponse.json({ members: data ? [data] : [] });
  }

  const safeForLike = q.replace(/[%_\\]/g, '').replace(/,/g, ' ').trim();
  const digitsOnly = safeForLike.replace(/\D/g, '').slice(0, 15);
  const hasLetter = /[a-zA-ZÀ-ÿ]/.test(safeForLike);

  const orParts: string[] = [];
  if (digitsOnly.length >= 3) {
    orParts.push(`phone_e164.ilike.%${digitsOnly}%`);
  }
  if (hasLetter && safeForLike.length >= 2) {
    orParts.push(`display_name.ilike.%${safeForLike}%`);
    orParts.push(`first_name.ilike.%${safeForLike}%`);
    orParts.push(`last_name.ilike.%${safeForLike}%`);
  }

  if (orParts.length === 0) {
    return NextResponse.json({ members: [] });
  }

  const { data, error } = await supabase
    .from('banano_loyalty_members')
    .select('*')
    .eq('user_id', user.id)
    .or(orParts.join(','))
    .limit(15);

  if (error) {
    console.error('[banano/members search]', error.message);
    return NextResponse.json({ error: tm('crmMembersSearchError') }, { status: 500 });
  }

  return NextResponse.json({ members: data ?? [] });
}

type PostBody = {
  phone: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  created_by_staff_id?: string | null;
  address_line?: string;
  city?: string;
  postal_code?: string;
  country?: string;
};

function buildMemberNames(body: PostBody, clientFallback: string): {
  first_name: string;
  last_name: string;
  display_name: string;
} {
  const fi = (body.first_name ?? '').trim().slice(0, 80);
  const la = (body.last_name ?? '').trim().slice(0, 80);
  let display = (body.display_name ?? '').trim().slice(0, 120);
  if (fi || la) {
    display = [fi, la].filter(Boolean).join(' ').trim();
  }
  if (!display) display = clientFallback;
  let first = fi;
  let last = la;
  if (!first && !last && display && display !== clientFallback) {
    const parts = display.split(/\s+/).filter(Boolean);
    first = parts[0] ?? clientFallback;
    last = parts.slice(1).join(' ');
  }
  if (!first && display === clientFallback) first = clientFallback;

  const first_name = first ? formatTerminalClientName(first).slice(0, 80) : '';
  const last_name = last ? formatTerminalClientName(last).slice(0, 80) : '';
  let display_name = display ? formatTerminalClientName(display).slice(0, 120) : 'CLIENT';
  if (!display_name) display_name = 'CLIENT';
  return { first_name, last_name, display_name };
}

function formatMemberAddressFields(body: PostBody): Record<string, string> {
  return {
    address_line: formatTerminalClientName((body.address_line ?? '').trim()).slice(0, 200),
    city: formatTerminalClientName((body.city ?? '').trim()).slice(0, 120),
    postal_code: formatTerminalClientName((body.postal_code ?? '').trim()).replace(/\s+/g, '').slice(0, 20),
    country: formatTerminalClientName((body.country ?? '').trim()).slice(0, 120),
  };
}

export async function POST(req: Request) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));
  const tLoyalty = createServerTranslator('Loyalty', apiLocaleFromRequest(req));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const phone = normalizePhoneE164(body.phone ?? '');
  if (!phone) {
    return NextResponse.json({ error: tm('loyaltyMemberPhoneInvalid') }, { status: 400 });
  }

  const staffCheck = await assertTerminalStaffActive(
    supabase,
    user.id,
    body.created_by_staff_id,
    tLoyalty
  );
  if (!staffCheck.ok) {
    return NextResponse.json({ error: staffCheck.error }, { status: 400 });
  }

  const { first_name, last_name, display_name } = buildMemberNames(body, tm('crmVoucherArchiveMemberFallback'));
  const addr = formatMemberAddressFields(body);
  const hasAddr =
    addr.address_line.length > 0 ||
    addr.city.length > 0 ||
    addr.postal_code.length > 0 ||
    addr.country.length > 0;

  const { data: existing } = await supabase
    .from('banano_loyalty_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('phone_e164', phone)
    .maybeSingle();

  if (existing) {
    const nextDisp = display_name || (existing as { display_name?: string }).display_name || '';
    const patch: Record<string, unknown> = {
      display_name: nextDisp,
      first_name: first_name || (existing as { first_name?: string }).first_name || '',
      last_name: last_name || (existing as { last_name?: string }).last_name || '',
    };
    if (hasAddr) {
      patch.address_line = addr.address_line;
      patch.city = addr.city;
      patch.postal_code = addr.postal_code;
      patch.country = addr.country;
    }
    const dirty =
      patch.display_name !== existing.display_name ||
      patch.first_name !== ((existing as { first_name?: string }).first_name ?? '') ||
      patch.last_name !== ((existing as { last_name?: string }).last_name ?? '') ||
      (hasAddr &&
        (addr.address_line !== ((existing as { address_line?: string }).address_line ?? '') ||
          addr.city !== ((existing as { city?: string }).city ?? '') ||
          addr.postal_code !== ((existing as { postal_code?: string }).postal_code ?? '') ||
          addr.country !== ((existing as { country?: string }).country ?? '')));
    if (dirty) {
      const { data: updated, error } = await supabase
        .from('banano_loyalty_members')
        .update(patch)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) {
        return NextResponse.json({ error: tm('updateFailed') }, { status: 500 });
      }
      return NextResponse.json({ member: updated });
    }
    return NextResponse.json({ member: existing });
  }

  const insertPayload: Record<string, unknown> = {
    user_id: user.id,
    phone_e164: phone,
    display_name,
    first_name: first_name || (!last_name ? 'CLIENT' : ''),
    last_name,
    address_line: addr.address_line,
    city: addr.city,
    postal_code: addr.postal_code,
    country: addr.country,
    preferred_locale: preferredAppLocaleFromE164(phone),
  };
  if (body.created_by_staff_id && typeof body.created_by_staff_id === 'string') {
    insertPayload.created_by_staff_id = body.created_by_staff_id;
  }

  const { data: inserted, error } = await supabase
    .from('banano_loyalty_members')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error('[banano/members insert]', error.message);
    return NextResponse.json({ error: tm('memberCreateFailed') }, { status: 500 });
  }

  const evRow: Record<string, unknown> = {
    user_id: user.id,
    member_id: inserted.id,
    event_type: 'member_created',
    delta_points: 0,
    delta_stamps: 0,
    note: null,
  };
  if (body.created_by_staff_id && typeof body.created_by_staff_id === 'string') {
    evRow.staff_id = body.created_by_staff_id;
  }
  const { error: evErr } = await supabase.from('banano_loyalty_events').insert(evRow);
  if (evErr) {
    console.error('[banano/members member_created event]', evErr.message);
  }

  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select(`language, ${BANANO_PROFILE_LOYALTY_COLUMNS}`)
      .eq('id', user.id)
      .maybeSingle();
    if (prof) {
      const loyalty = loyaltyConfigFromProfileRow(prof as unknown as Record<string, unknown>);
      const loc = String((prof as { language?: string }).language ?? '').trim();
      const ins = inserted as {
        id: string;
        points_balance?: number;
        stamps_balance?: number;
      };
      const welcomeRes = await ensureSignupWelcomeVoucher({
        supabase,
        merchantUserId: user.id,
        memberId: ins.id,
        cfg: loyalty.signupWelcome,
        pointsBalance: ins.points_balance ?? 0,
        stampsBalance: ins.stamps_balance ?? 0,
        loyaltyMode: loyalty.mode,
        merchantLocale: loc || null,
      });
      if ('error' in welcomeRes && welcomeRes.error) {
        console.warn('[banano/members signup_welcome]', welcomeRes.error);
      }
    }
  } catch (e) {
    console.warn('[banano/members signup_welcome]', e);
  }

  return NextResponse.json({ member: inserted });
}
