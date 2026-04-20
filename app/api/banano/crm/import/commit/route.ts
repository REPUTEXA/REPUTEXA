import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { normalizePhoneE164 } from '@/lib/banano/phone';
import { preferredAppLocaleFromE164 } from '@/lib/banano/member-preferred-locale';
import { normalizeTextForCrmImport } from '@/lib/banano/crm-import';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const MAX_ROWS = 10_000;
const CHUNK = 25;

const rowSchema = z.object({
  phone: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  display_name: z.string(),
  points_balance: z.number().int().min(0).max(9_999_999),
  stamps_balance: z.number().int().min(0).max(9_999_999),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(MAX_ROWS),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const userId = user.id;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return apiJsonError(req, 'errors.crm_importPayloadInvalid', 400);
  }

  type Row = z.infer<typeof rowSchema>;
  const cleaned: (Row & { phone: string })[] = [];
  let skippedInvalidPhone = 0;

  for (const r of parsed.data.rows) {
    const phone = normalizePhoneE164(r.phone);
    if (!phone) {
      skippedInvalidPhone++;
      continue;
    }
    cleaned.push({ ...r, phone });
  }

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  async function processOne(row: Row & { phone: string }) {
    const first_name = normalizeTextForCrmImport(row.first_name).slice(0, 80);
    const last_name = normalizeTextForCrmImport(row.last_name).slice(0, 80);
    const display_name =
      normalizeTextForCrmImport(row.display_name).slice(0, 120) || 'CLIENT';

    const { data: existing, error: selErr } = await supabase
      .from('banano_loyalty_members')
      .select('id, points_balance, stamps_balance')
      .eq('user_id', userId)
      .eq('phone_e164', row.phone)
      .maybeSingle();

    if (selErr) {
      console.error('[crm/import/commit select]', selErr.message);
      errors++;
      return;
    }

    if (existing) {
      const ex = existing as { id: string; points_balance?: number | null; stamps_balance?: number | null };
      const curP = Math.max(0, Math.floor(Number(ex.points_balance) || 0));
      const curS = Math.max(0, Math.floor(Number(ex.stamps_balance) || 0));
      const nextP = Math.min(9_999_999, curP + row.points_balance);
      const nextS = Math.min(9_999_999, curS + row.stamps_balance);

      const inferred = preferredAppLocaleFromE164(row.phone);
      const { error: upErr } = await supabase
        .from('banano_loyalty_members')
        .update({
          display_name,
          first_name: first_name || (!last_name ? 'CLIENT' : ''),
          last_name,
          points_balance: nextP,
          stamps_balance: nextS,
          ...(inferred ? { preferred_locale: inferred } : {}),
        })
        .eq('id', ex.id);

      if (upErr) {
        console.error('[crm/import/commit update]', upErr.message);
        errors++;
        return;
      }
      updated++;
      return;
    }

    const { error: insErr } = await supabase.from('banano_loyalty_members').insert({
      user_id: userId,
      phone_e164: row.phone,
      display_name,
      first_name: first_name || (!last_name ? 'CLIENT' : ''),
      last_name,
      points_balance: row.points_balance,
      stamps_balance: row.stamps_balance,
      preferred_locale: preferredAppLocaleFromE164(row.phone),
    });

    if (insErr) {
      console.error('[crm/import/commit insert]', insErr.message);
      errors++;
      return;
    }
    inserted++;
  }

  for (let i = 0; i < cleaned.length; i += CHUNK) {
    const slice = cleaned.slice(i, i + CHUNK);
    await Promise.all(slice.map((row) => processOne(row)));
  }

  return NextResponse.json({
    ok: true,
    processed: cleaned.length,
    inserted,
    updated,
    skippedInvalidPhone,
    errors,
  });
}
