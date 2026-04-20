import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createClient } from '@/lib/supabase/server';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { normalizePhoneE164 } from '@/lib/banano/phone';
import { preferredAppLocaleFromE164 } from '@/lib/banano/member-preferred-locale';
import { formatTerminalClientName } from '@/lib/banano/terminal-client-name-format';

type Ctx = { params: Promise<{ memberId: string }> };

type PatchBody = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  /** Jour d'anniversaire (yyyy-mm-dd) ou null pour effacer. */
  birth_date?: string | null;
  address_line?: string;
  city?: string;
  postal_code?: string;
  country?: string;
};

export async function PATCH(req: Request, ctx: Ctx) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));
  const { memberId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  if (!memberId) {
    return NextResponse.json({ error: tm('invalidClient') }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: tm('invalidJson') }, { status: 400 });
  }

  const { data: row, error: readErr } = await supabase
    .from('banano_loyalty_members')
    .select('*')
    .eq('id', memberId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (readErr || !row) {
    return NextResponse.json({ error: tm('clientNotFound') }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};

  if (body.first_name !== undefined) {
    patch.first_name = formatTerminalClientName(String(body.first_name).trim()).slice(0, 80);
  }
  if (body.last_name !== undefined) {
    patch.last_name = formatTerminalClientName(String(body.last_name).trim()).slice(0, 80);
  }

  if (body.birth_date !== undefined) {
    if (body.birth_date === null || body.birth_date === '') {
      patch.birth_date = null;
    } else {
      const raw = String(body.birth_date).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return NextResponse.json({ error: tm('loyaltyMemberBirthInvalid') }, { status: 400 });
      }
      patch.birth_date = raw;
    }
  }

  if (body.phone !== undefined) {
    const phone = normalizePhoneE164(body.phone);
    if (!phone) {
      return NextResponse.json({ error: tm('loyaltyMemberPhoneInvalid') }, { status: 400 });
    }
    const { data: taken } = await supabase
      .from('banano_loyalty_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('phone_e164', phone)
      .neq('id', memberId)
      .maybeSingle();
    if (taken) {
      return NextResponse.json({ error: tm('loyaltyMemberPhoneTaken') }, { status: 409 });
    }
    patch.phone_e164 = phone;
    const inferred = preferredAppLocaleFromE164(phone);
    if (inferred) {
      patch.preferred_locale = inferred;
    }
  }

  const r = row as { first_name?: string; last_name?: string; display_name?: string };
  if (patch.first_name !== undefined || patch.last_name !== undefined) {
    const nf = (patch.first_name !== undefined ? patch.first_name : r.first_name ?? '') as string;
    const nl = (patch.last_name !== undefined ? patch.last_name : r.last_name ?? '') as string;
    const disp = [nl, nf].filter(Boolean).join(' ').trim();
    if (disp) patch.display_name = formatTerminalClientName(disp).slice(0, 120);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ member: row });
  }

  const { data: updated, error: upErr } = await supabase
    .from('banano_loyalty_members')
    .update(patch)
    .eq('id', memberId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (upErr) {
    console.error('[banano/members PATCH]', upErr.message);
    return NextResponse.json({ error: 'Mise à jour impossible.' }, { status: 500 });
  }

  return NextResponse.json({ member: updated });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));
  const { memberId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  if (!memberId) {
    return NextResponse.json({ error: tm('invalidClient') }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('banano_loyalty_members')
    .select('id')
    .eq('id', memberId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: tm('clientNotFound') }, { status: 404 });
  }

  const { error: delErr } = await supabase
    .from('banano_loyalty_members')
    .delete()
    .eq('id', memberId)
    .eq('user_id', user.id);

  if (delErr) {
    console.error('[banano/members DELETE]', delErr.message);
    return apiJsonError(req, 'errors.crm_deleteFailed', 500);
  }

  return NextResponse.json({ ok: true });
}
