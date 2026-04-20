import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loyaltyConfigFromProfileRow } from '@/lib/banano/loyalty-profile';
import { ensureBananoTerminalPublicSlug } from '@/lib/banano/ensure-terminal-slug';
import { mergeBirthdayConfig } from '@/lib/banano/banano-automation-defaults';
import { BANANO_PROFILE_LOYALTY_COLUMNS } from '@/lib/banano/loyalty-profile-columns';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

export async function GET(request: Request) {
  const tb = createServerTranslator('ApiBanano', apiLocaleFromRequest(request));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(`establishment_name, banano_pin_hash, banano_terminal_public_slug, ${BANANO_PROFILE_LOYALTY_COLUMNS}`)
    .eq('id', user.id)
    .maybeSingle();

  let staffActiveList: { id: string; display_name: string }[] = [];
  const { data: staffRows, error: staffListErr } = await supabase
    .from('banano_terminal_staff')
    .select('id, display_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('display_name', { ascending: true });
  if (staffListErr) {
    console.error('[banano/bootstrap staff]', staffListErr.message);
  } else {
    staffActiveList = staffRows ?? [];
  }

  if (error) {
    console.error('[banano/bootstrap]', error.message);
    return NextResponse.json({ error: tb('bootstrapProfileReadFailed') }, { status: 500 });
  }

  const profileRow = data as Record<string, unknown> | null;
  const loyalty = loyaltyConfigFromProfileRow(profileRow);

  let terminalPublicSlug: string;
  try {
    terminalPublicSlug = await ensureBananoTerminalPublicSlug(supabase, user.id);
  } catch (e) {
    console.error('[banano/bootstrap slug]', e);
    return NextResponse.json({ error: tb('bootstrapTerminalSlugUnavailable') }, { status: 500 });
  }

  let birthdayOffer: {
    automationEnabled: boolean;
    hasReduction: boolean;
    discount_kind: 'none' | 'percent' | 'fixed';
    discount_percent: number;
    discount_fixed_cents: number;
  } = {
    automationEnabled: false,
    hasReduction: false,
    discount_kind: 'none',
    discount_percent: 0,
    discount_fixed_cents: 0,
  };

  const { data: bdayRule, error: bdayErr } = await supabase
    .from('banano_loyalty_automation_rules')
    .select('enabled, config')
    .eq('user_id', user.id)
    .eq('rule_type', 'birthday')
    .maybeSingle();

  if (!bdayErr && bdayRule) {
    const rowEnabled = Boolean((bdayRule as { enabled?: boolean }).enabled);
    const cfgRaw = {
      ...(((bdayRule as { config?: unknown }).config as Record<string, unknown>) ?? {}),
      enabled: rowEnabled,
    };
    const merged = mergeBirthdayConfig(cfgRaw);
    const hasReduction =
      rowEnabled &&
      merged.discount_kind !== 'none' &&
      (merged.discount_kind === 'percent'
        ? merged.discount_percent > 0
        : merged.discount_fixed_cents > 0);
    birthdayOffer = {
      automationEnabled: rowEnabled,
      hasReduction,
      discount_kind: merged.discount_kind,
      discount_percent: merged.discount_percent,
      discount_fixed_cents: merged.discount_fixed_cents,
    };
  }

  const establishmentName =
    typeof profileRow?.establishment_name === 'string' &&
    profileRow.establishment_name.trim().length > 0
      ? profileRow.establishment_name.trim()
      : null;

  return NextResponse.json({
    pinConfigured: Boolean(profileRow?.banano_pin_hash),
    terminalPublicSlug,
    loyaltyMode: loyalty.mode,
    loyalty,
    establishmentName,
    activeTerminalStaff: staffActiveList,
    birthdayOffer,
  });
}
