import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createClient } from '@/lib/supabase/server';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import {
  DEFAULT_BIRTHDAY,
  DEFAULT_LOST_CLIENT,
  mergeBirthdayConfig,
  mergeLostConfig,
  mergeNewClientWelcomeConfig,
  mergeVipOfMonthConfig,
  replaceLegacyFrenchMiddle,
  type BirthdayConfig,
  type LostClientConfig,
  type NewClientWelcomeConfig,
  type VipOfMonthConfig,
} from '@/lib/banano/banano-automation-defaults';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { isWalletArchetypeId, suggestedLostClientInactiveDaysForArchetype } from '@/lib/wallet/archetypes';

type RulesPayload = {
  lost_client?: LostClientConfig;
  birthday?: BirthdayConfig;
  vip_of_month?: VipOfMonthConfig;
  new_client_welcome?: NewClientWelcomeConfig;
  /** Préférence profil : alertes à proximité sur le passe Wallet (locations dans le .pkpass). */
  geo_notifications_enabled?: boolean;
};

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const { data: rows } = await supabase
    .from('banano_loyalty_automation_rules')
    .select('rule_type, enabled, config')
    .eq('user_id', user.id);

  let lostRaw: Record<string, unknown> | undefined;
  let birthdayRaw: Record<string, unknown> | undefined;
  let vipRaw: Record<string, unknown> | undefined;
  let welcomeRaw: Record<string, unknown> | undefined;
  let lostEnabled = DEFAULT_LOST_CLIENT.enabled;
  let birthdayEnabled = DEFAULT_BIRTHDAY.enabled;
  let vipEnabled = mergeVipOfMonthConfig(null).enabled;
  let welcomeEnabled = mergeNewClientWelcomeConfig(null).enabled;
  let hadLostClientRow = false;

  for (const row of rows ?? []) {
    const t = (row as { rule_type: string; enabled: boolean; config: unknown }).rule_type;
    if (t === 'lost_client') {
      hadLostClientRow = true;
      lostEnabled = (row as { enabled: boolean }).enabled;
      lostRaw = ((row as { config: unknown }).config as Record<string, unknown>) ?? {};
      lostRaw.enabled = lostEnabled;
    }
    if (t === 'birthday') {
      birthdayEnabled = (row as { enabled: boolean }).enabled;
      birthdayRaw = ((row as { config: unknown }).config as Record<string, unknown>) ?? {};
      birthdayRaw.enabled = birthdayEnabled;
    }
    if (t === 'vip_of_month') {
      vipEnabled = (row as { enabled: boolean }).enabled;
      vipRaw = ((row as { config: unknown }).config as Record<string, unknown>) ?? {};
      vipRaw.enabled = vipEnabled;
    }
    if (t === 'new_client_welcome') {
      welcomeEnabled = (row as { enabled: boolean }).enabled;
      welcomeRaw = ((row as { config: unknown }).config as Record<string, unknown>) ?? {};
      welcomeRaw.enabled = welcomeEnabled;
    }
  }

  const lost_client = mergeLostConfig(lostRaw ?? { enabled: lostEnabled });
  lost_client.enabled = lostEnabled;
  const birthday = mergeBirthdayConfig(birthdayRaw ?? { enabled: birthdayEnabled });
  birthday.enabled = birthdayEnabled;
  const vip_of_month = mergeVipOfMonthConfig(vipRaw ?? { enabled: vipEnabled });
  vip_of_month.enabled = vipEnabled;
  const new_client_welcome = mergeNewClientWelcomeConfig(welcomeRaw ?? { enabled: welcomeEnabled });
  new_client_welcome.enabled = welcomeEnabled;

  const { data: prof } = await supabase
    .from('profiles')
    .select(
      'establishment_name, banano_wallet_geo_notifications_enabled, banano_wallet_archetype_id'
    )
    .eq('id', user.id)
    .maybeSingle();

  const establishment_name = (
    (prof as { establishment_name?: string } | null)?.establishment_name ?? ''
  ).trim();

  const geo_notifications_enabled = Boolean(
    (prof as { banano_wallet_geo_notifications_enabled?: boolean | null } | null)
      ?.banano_wallet_geo_notifications_enabled ?? true
  );

  const archRaw = String(
    (prof as { banano_wallet_archetype_id?: string | null } | null)?.banano_wallet_archetype_id ?? ''
  ).trim();
  const wallet_archetype_id =
    archRaw && isWalletArchetypeId(archRaw) ? archRaw : null;

  if (!hadLostClientRow) {
    lost_client.inactive_days = suggestedLostClientInactiveDaysForArchetype(wallet_archetype_id);
  }

  const { searchParams } = new URL(req.url);
  const uiLocale = normalizeAppLocale(searchParams.get('uiLocale') || apiLocaleFromRequest(req));
  const tComposeUi = createServerTranslator('Dashboard.bananoAutomationCompose', uiLocale);
  lost_client.message_template = replaceLegacyFrenchMiddle(
    lost_client.message_template,
    tComposeUi('default_middle_lost'),
    'lost'
  );
  birthday.message_template = replaceLegacyFrenchMiddle(
    birthday.message_template,
    tComposeUi('default_middle_birth'),
    'birth'
  );
  vip_of_month.message_template = replaceLegacyFrenchMiddle(
    vip_of_month.message_template,
    tComposeUi('default_middle_vip'),
    'vip'
  );
  new_client_welcome.message_template = replaceLegacyFrenchMiddle(
    new_client_welcome.message_template,
    tComposeUi('default_middle_welcome'),
    'welcome'
  );

  return NextResponse.json({
    lost_client,
    birthday,
    vip_of_month,
    new_client_welcome,
    establishment_name,
    geo_notifications_enabled,
    wallet_archetype_id,
  });
}

export async function PATCH(req: Request) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  let body: RulesPayload;
  try {
    body = (await req.json()) as RulesPayload;
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  if (typeof body.geo_notifications_enabled === 'boolean') {
    const { error: geoErr } = await supabase
      .from('profiles')
      .update({
        banano_wallet_geo_notifications_enabled: body.geo_notifications_enabled,
      })
      .eq('id', user.id);
    if (geoErr) {
      console.error('[banano/automation geo flag]', geoErr.message);
      return NextResponse.json({ error: tm('updateFailed') }, { status: 500 });
    }
  }

  if (body.lost_client) {
    const merged = mergeLostConfig({
      ...body.lost_client,
      enabled: body.lost_client.enabled,
    } as Record<string, unknown>);
    const { error } = await supabase.from('banano_loyalty_automation_rules').upsert(
      {
        user_id: user.id,
        rule_type: 'lost_client',
        enabled: Boolean(body.lost_client.enabled),
        config: {
          inactive_days: merged.inactive_days,
          min_lifetime_visits: merged.min_lifetime_visits,
          message_template: merged.message_template,
          discount_kind: merged.discount_kind,
          discount_percent: merged.discount_percent,
          discount_fixed_cents: merged.discount_fixed_cents,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,rule_type' }
    );
    if (error) {
      console.error('[banano/automation lost]', error.message);
      return NextResponse.json({ error: tm('updateFailed') }, { status: 500 });
    }
  }

  if (body.birthday) {
    const merged = mergeBirthdayConfig({
      ...body.birthday,
      enabled: body.birthday.enabled,
    } as Record<string, unknown>);
    const { error } = await supabase.from('banano_loyalty_automation_rules').upsert(
      {
        user_id: user.id,
        rule_type: 'birthday',
        enabled: Boolean(body.birthday.enabled),
        config: {
          message_template: merged.message_template,
          anticipation_enabled: merged.anticipation_enabled,
          anticipation_days: merged.anticipation_days,
          discount_kind: merged.discount_kind,
          discount_percent: merged.discount_percent,
          discount_fixed_cents: merged.discount_fixed_cents,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,rule_type' }
    );
    if (error) {
      console.error('[banano/automation birthday]', error.message);
      return NextResponse.json({ error: tm('updateFailed') }, { status: 500 });
    }
  }

  if (body.vip_of_month) {
    const merged = mergeVipOfMonthConfig({
      ...body.vip_of_month,
      enabled: body.vip_of_month.enabled,
    } as Record<string, unknown>);
    const { error } = await supabase.from('banano_loyalty_automation_rules').upsert(
      {
        user_id: user.id,
        rule_type: 'vip_of_month',
        enabled: Boolean(body.vip_of_month.enabled),
        config: {
          message_template: merged.message_template,
          discount_kind: merged.discount_kind,
          discount_percent: merged.discount_percent,
          discount_fixed_cents: merged.discount_fixed_cents,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,rule_type' }
    );
    if (error) {
      console.error('[banano/automation vip_of_month]', error.message);
      return NextResponse.json({ error: tm('updateFailed') }, { status: 500 });
    }
  }

  if (body.new_client_welcome) {
    const merged = mergeNewClientWelcomeConfig({
      ...body.new_client_welcome,
      enabled: body.new_client_welcome.enabled,
    } as Record<string, unknown>);
    const { error } = await supabase.from('banano_loyalty_automation_rules').upsert(
      {
        user_id: user.id,
        rule_type: 'new_client_welcome',
        enabled: Boolean(body.new_client_welcome.enabled),
        config: {
          delay_days: merged.delay_days,
          message_template: merged.message_template,
          discount_kind: merged.discount_kind,
          discount_percent: merged.discount_percent,
          discount_fixed_cents: merged.discount_fixed_cents,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,rule_type' }
    );
    if (error) {
      console.error('[banano/automation new_client_welcome]', error.message);
      return NextResponse.json({ error: tm('updateFailed') }, { status: 500 });
    }
  }

  return await GET(req);
}

