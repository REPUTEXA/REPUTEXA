import { NextResponse } from 'next/server';
import { format, startOfMonth } from 'date-fns';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';
import {
  appendAutomationWalletLink,
  attributionCentsFromDiscount,
  composeBirthdayAnticipationWhatsAppBody,
  composeBirthdayWhatsAppBody,
  composeLostClientWhatsAppBody,
  composeNewClientWelcomeWhatsAppBody,
  composeVipOfMonthWhatsAppBody,
  formatReductionForMessage,
  formatSpendCentsForMessage,
  mergeBirthdayConfig,
  mergeLostConfig,
  mergeNewClientWelcomeConfig,
  mergeVipOfMonthConfig,
  reductionPayloadForLog,
} from '@/lib/banano/banano-automation-defaults';
import { calendarDaysSinceInParis } from '@/lib/banano/loyalty-automation-paris-calendar';
import { messageLocaleForAutomation } from '@/lib/banano/loyalty-automation-message-locale';
import { ensureBirthdayGiftVoucher } from '@/lib/banano/birthday-gift-voucher';
import { signWalletLinkPayload } from '@/lib/banano/wallet-link-token';
import { getSiteUrl } from '@/lib/site-url';
import {
  formatVipPeriodRangeLabel,
  previousMonthWindowForVipParis,
} from '@/lib/banano/vip-of-month-cron';
import { personalizeLoyaltyAutomationMiddle } from '@/lib/banano/generate-loyalty-whatsapp-narrative';
import {
  automationTemplateUsesDernierProduit,
  fetchDernierProduitFromLastEventNote,
} from '@/lib/banano/loyalty-automation-template-vars';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const BATCH = 40;

const establishmentLabelCache = new Map<string, string>();
const merchantLocaleCache = new Map<string, string>();
const loyaltyModeCache = new Map<string, 'points' | 'stamps'>();

async function merchantLocaleForUser(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string
): Promise<string> {
  if (merchantLocaleCache.has(userId)) {
    return merchantLocaleCache.get(userId)!;
  }
  const { data } = await admin.from('profiles').select('language').eq('id', userId).maybeSingle();
  const loc = normalizeAppLocale(String((data as { language?: string } | null)?.language ?? 'fr'));
  merchantLocaleCache.set(userId, loc);
  return loc;
}

async function loyaltyModeForUser(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string
): Promise<'points' | 'stamps'> {
  if (loyaltyModeCache.has(userId)) {
    return loyaltyModeCache.get(userId)!;
  }
  const { data } = await admin.from('profiles').select('banano_loyalty_mode').eq('id', userId).maybeSingle();
  const m =
    String((data as { banano_loyalty_mode?: string } | null)?.banano_loyalty_mode ?? '') === 'stamps'
      ? 'stamps'
      : 'points';
  loyaltyModeCache.set(userId, m);
  return m;
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function isAnticipationOnlyPayload(p: Record<string, unknown> | null | undefined): boolean {
  if (!p) return false;
  if (p.phase === 'anticipation') return true;
  const ak = String(p.automation_key ?? '');
  return ak.endsWith(':anticipation');
}

async function shouldSkipBirthdayAnticipation(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  memberId: string,
  occurrenceIso: string
): Promise<boolean> {
  const automationKeyAnt = `birthday:${occurrenceIso}:anticipation`;
  const { data: dup } = await admin
    .from('banano_loyalty_automation_log')
    .select('id')
    .eq('user_id', userId)
    .eq('member_id', memberId)
    .eq('rule_type', 'birthday')
    .contains('payload', { automation_key: automationKeyAnt })
    .limit(1);
  return Boolean(dup?.length);
}

async function shouldSkipBirthdayDay(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  memberId: string,
  occurrenceIso: string,
  yearStartIso: string
): Promise<boolean> {
  const automationKeyDay = `birthday:${occurrenceIso}:day`;
  const { data: dup } = await admin
    .from('banano_loyalty_automation_log')
    .select('id')
    .eq('user_id', userId)
    .eq('member_id', memberId)
    .eq('rule_type', 'birthday')
    .contains('payload', { automation_key: automationKeyDay })
    .limit(1);
  if (dup?.length) return true;

  const { data: rows } = await admin
    .from('banano_loyalty_automation_log')
    .select('payload')
    .eq('user_id', userId)
    .eq('member_id', memberId)
    .eq('rule_type', 'birthday')
    .gte('created_at', yearStartIso)
    .limit(80);

  for (const row of rows ?? []) {
    const p = row.payload as Record<string, unknown> | undefined;
    if (!isAnticipationOnlyPayload(p)) return true;
  }
  return false;
}

function walletSmartAddUrl(merchantUserId: string, memberId: string): string | null {
  const secret = process.env.BANANO_WALLET_LINK_SECRET?.trim();
  if (!secret || secret.length < 24) return null;
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  const token = signWalletLinkPayload({ m: memberId, u: merchantUserId, exp }, secret);
  const base = getSiteUrl().replace(/\/+$/, '');
  return `${base}/api/banano/wallet/smart-add?t=${encodeURIComponent(token)}`;
}

async function establishmentLabelForUser(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string
): Promise<string> {
  if (establishmentLabelCache.has(userId)) {
    return establishmentLabelCache.get(userId)!;
  }
  const { data } = await admin
    .from('profiles')
    .select('establishment_name')
    .eq('id', userId)
    .maybeSingle();
  const raw = ((data as { establishment_name?: string } | null)?.establishment_name ?? '').trim();
  const label = raw || 'notre équipe';
  establishmentLabelCache.set(userId, label);
  return label;
}

function authCron(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  return !!(process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`);
}

async function addMonthlyRevenue(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  cents: number
) {
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const { data: existing } = await admin
    .from('banano_loyalty_automation_monthly_stats')
    .select('attributed_revenue_cents, sends_count')
    .eq('user_id', userId)
    .eq('month_start', monthStart)
    .maybeSingle();

  const rev = Number((existing as { attributed_revenue_cents?: number })?.attributed_revenue_cents ?? 0) + cents;
  const sends =
    Number((existing as { sends_count?: number })?.sends_count ?? 0) + 1;

  await admin.from('banano_loyalty_automation_monthly_stats').upsert(
    {
      user_id: userId,
      month_start: monthStart,
      attributed_revenue_cents: rev,
      sends_count: sends,
    },
    { onConflict: 'user_id,month_start' }
  );
}

export async function GET(request: Request) {
  const ta = apiAdminT();
  if (!authCron(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('serviceUnavailable') }, { status: 500 });
  }

  const { data: rules, error: rulesErr } = await admin
    .from('banano_loyalty_automation_rules')
    .select('user_id, rule_type, enabled, config')
    .eq('enabled', true);

  if (rulesErr) {
    console.error('[cron banano-auto rules]', rulesErr.message);
    return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  }

  let sent = 0;
  const now = new Date();
  const todayMd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const cooldownIso = new Date(now.getTime() - 30 * 86400000).toISOString();
  const yearStartIso = new Date(now.getFullYear(), 0, 1).toISOString();

  for (const ruleRow of rules ?? []) {
    if (sent >= BATCH) break;
    const uid = (ruleRow as { user_id: string }).user_id;
    const ruleType = (ruleRow as { rule_type: string }).rule_type;
    const configRaw = (ruleRow as { config: Record<string, unknown> }).config ?? {};

    if (ruleType === 'lost_client') {
      const cfg = mergeLostConfig({ ...configRaw, enabled: true });
      const commerceName = await establishmentLabelForUser(admin, uid);
      const merchantLocale = await merchantLocaleForUser(admin, uid);
      const { data: members } = await admin
        .from('banano_loyalty_members')
        .select(
          'id, phone_e164, first_name, display_name, last_visit_at, lifetime_visit_count, preferred_locale'
        )
        .eq('user_id', uid);

      for (const mem of members ?? []) {
        if (sent >= BATCH) break;
        const m = mem as {
          id: string;
          phone_e164: string;
          first_name?: string;
          display_name?: string;
          last_visit_at: string | null;
          lifetime_visit_count: number | null;
          preferred_locale?: string | null;
        };
        const visits = Math.max(0, Math.floor(Number(m.lifetime_visit_count ?? 0)));
        if (visits < cfg.min_lifetime_visits) continue;
        if (!m.last_visit_at) continue;

        const last = m.last_visit_at ? new Date(m.last_visit_at).getTime() : 0;
        const days = last ? Math.floor((now.getTime() - last) / 86400000) : 999;
        if (last && days < cfg.inactive_days) continue;
        if (!last && visits === 0) continue;

        const { data: recent } = await admin
          .from('banano_loyalty_automation_log')
          .select('id')
          .eq('user_id', uid)
          .eq('member_id', m.id)
          .eq('rule_type', 'lost_client')
          .gte('created_at', cooldownIso)
          .limit(1);

        if (recent?.length) continue;

        const prenom = (m.first_name || m.display_name || '').split(/\s+/)[0] ?? '';
        const messageLocale = messageLocaleForAutomation(merchantLocale, m.preferred_locale);
        const tCompose = createServerTranslator('Dashboard.bananoAutomationCompose', messageLocale);
        const reductionLabel = formatReductionForMessage(
          cfg.discount_kind,
          cfg.discount_percent,
          cfg.discount_fixed_cents,
          messageLocale
        );
        let middleLost = cfg.message_template;
        if (process.env.OPENAI_API_KEY) {
          middleLost = await personalizeLoyaltyAutomationMiddle({
            scenario: 'lost_client',
            commerceName,
            prenom,
            baseMiddle: cfg.message_template,
            lostDaysInactive: days,
            locale: messageLocale,
          });
        }
        const needDp = automationTemplateUsesDernierProduit(cfg.message_template, middleLost);
        const dernierProduit = needDp
          ? await fetchDernierProduitFromLastEventNote(admin, m.id)
          : '';
        const body = composeLostClientWhatsAppBody(
          { ...cfg, message_template: middleLost },
          prenom,
          commerceName,
          tCompose('fallback_offer_lost'),
          tCompose,
          messageLocale,
          needDp ? { dernier_produit: dernierProduit } : undefined
        );
        const attrCents = attributionCentsFromDiscount(cfg.discount_kind, cfg.discount_fixed_cents);
        const res = await sendWhatsAppMessage(m.phone_e164, body);
        const status = res.success ? 'sent' : 'failed';
        await admin.from('banano_loyalty_automation_log').insert({
          user_id: uid,
          member_id: m.id,
          rule_type: 'lost_client',
          channel: 'whatsapp',
          status,
          payload: {
            error: res.error ?? null,
            messageId: res.messageId ?? null,
            message_body: body,
            reduction: reductionPayloadForLog(
              cfg.discount_kind,
              cfg.discount_percent,
              cfg.discount_fixed_cents,
              reductionLabel
            ),
            establishment: commerceName,
          },
          estimated_revenue_cents: res.success ? attrCents : 0,
        });
        if (res.success) {
          await addMonthlyRevenue(admin, uid, attrCents);
          sent++;
        }
      }
    }

    if (ruleType === 'new_client_welcome') {
      const cfg = mergeNewClientWelcomeConfig({ ...configRaw, enabled: true });
      const commerceName = await establishmentLabelForUser(admin, uid);
      const merchantLocale = await merchantLocaleForUser(admin, uid);
      const { data: membersWelcome } = await admin
        .from('banano_loyalty_members')
        .select('id, phone_e164, first_name, display_name, created_at, preferred_locale')
        .eq('user_id', uid);

      for (const mem of membersWelcome ?? []) {
        if (sent >= BATCH) break;
        const m = mem as {
          id: string;
          phone_e164: string;
          first_name?: string;
          display_name?: string;
          created_at: string;
          preferred_locale?: string | null;
        };
        const createdAt = new Date(m.created_at);
        if (Number.isNaN(createdAt.getTime())) continue;
        const daysSinceJoin = calendarDaysSinceInParis(createdAt, now);
        if (daysSinceJoin !== cfg.delay_days) continue;

        const phone = String(m.phone_e164 ?? '').trim();
        if (phone.length < 8) continue;

        const { data: dupWelcome } = await admin
          .from('banano_loyalty_automation_log')
          .select('id')
          .eq('user_id', uid)
          .eq('member_id', m.id)
          .eq('rule_type', 'new_client_welcome')
          .eq('status', 'sent')
          .limit(1);
        if (dupWelcome?.length) continue;

        const prenom = (m.first_name || m.display_name || '').split(/\s+/)[0] ?? '';
        const messageLocale = messageLocaleForAutomation(merchantLocale, m.preferred_locale);
        const tCompose = createServerTranslator('Dashboard.bananoAutomationCompose', messageLocale);
        const reductionLabel = formatReductionForMessage(
          cfg.discount_kind,
          cfg.discount_percent,
          cfg.discount_fixed_cents,
          messageLocale
        );
        let middleWelcome = cfg.message_template;
        if (process.env.OPENAI_API_KEY) {
          middleWelcome = await personalizeLoyaltyAutomationMiddle({
            scenario: 'new_client_welcome',
            commerceName,
            prenom,
            baseMiddle: cfg.message_template,
            locale: messageLocale,
          });
        }
        const needDpW = automationTemplateUsesDernierProduit(cfg.message_template, middleWelcome);
        const dernierW = needDpW ? await fetchDernierProduitFromLastEventNote(admin, m.id) : '';
        let bodyW = composeNewClientWelcomeWhatsAppBody(
          { ...cfg, message_template: middleWelcome },
          prenom,
          commerceName,
          tCompose('fallback_welcome_gift'),
          tCompose,
          messageLocale,
          needDpW ? { dernier_produit: dernierW } : undefined
        );
        bodyW = appendAutomationWalletLink(bodyW, walletSmartAddUrl(uid, m.id), tCompose);
        const attrCentsW = attributionCentsFromDiscount(cfg.discount_kind, cfg.discount_fixed_cents);
        const resW = await sendWhatsAppMessage(phone, bodyW);
        const statusW = resW.success ? 'sent' : 'failed';
        await admin.from('banano_loyalty_automation_log').insert({
          user_id: uid,
          member_id: m.id,
          rule_type: 'new_client_welcome',
          channel: 'whatsapp',
          status: statusW,
          payload: {
            error: resW.error ?? null,
            messageId: resW.messageId ?? null,
            message_body: bodyW,
            delay_days: cfg.delay_days,
            reduction: reductionPayloadForLog(
              cfg.discount_kind,
              cfg.discount_percent,
              cfg.discount_fixed_cents,
              reductionLabel
            ),
            establishment: commerceName,
          },
          estimated_revenue_cents: resW.success ? attrCentsW : 0,
        });
        if (resW.success) {
          await addMonthlyRevenue(admin, uid, attrCentsW);
          sent++;
        }
      }
    }

    if (ruleType === 'birthday') {
      const cfg = mergeBirthdayConfig({ ...configRaw, enabled: true });
      const commerceName = await establishmentLabelForUser(admin, uid);
      const merchantLocale = await merchantLocaleForUser(admin, uid);
      const loyaltyMode = await loyaltyModeForUser(admin, uid);
      const { data: members } = await admin
        .from('banano_loyalty_members')
        .select(
          'id, phone_e164, first_name, display_name, birth_date, points_balance, stamps_balance, preferred_locale'
        )
        .eq('user_id', uid)
        .not('birth_date', 'is', null);

      if (cfg.anticipation_enabled && sent < BATCH) {
        const target = new Date(now);
        target.setDate(target.getDate() + cfg.anticipation_days);
        const occurrenceIsoAnt = formatYmd(target);
        const targetMd = occurrenceIsoAnt.slice(5, 10);

        for (const mem of members ?? []) {
          if (sent >= BATCH) break;
          const m = mem as {
            id: string;
            phone_e164: string;
            birth_date: string;
            first_name?: string;
            display_name?: string;
            preferred_locale?: string | null;
          };
          const md = String(m.birth_date).slice(5, 10);
          if (md !== targetMd) continue;

          const phone = String(m.phone_e164 ?? '').trim();
          if (phone.length < 8) continue;

          if (await shouldSkipBirthdayAnticipation(admin, uid, m.id, occurrenceIsoAnt)) continue;

          const prenom = (m.first_name || m.display_name || '').split(/\s+/)[0] ?? '';
          const messageLocale = messageLocaleForAutomation(merchantLocale, m.preferred_locale);
          const tCompose = createServerTranslator('Dashboard.bananoAutomationCompose', messageLocale);
          let bodyAnt = composeBirthdayAnticipationWhatsAppBody(
            prenom,
            commerceName,
            tCompose,
            messageLocale
          );
          bodyAnt = appendAutomationWalletLink(bodyAnt, walletSmartAddUrl(uid, m.id), tCompose);
          const resAnt = await sendWhatsAppMessage(phone, bodyAnt);
          const statusAnt = resAnt.success ? 'sent' : 'failed';
          await admin.from('banano_loyalty_automation_log').insert({
            user_id: uid,
            member_id: m.id,
            rule_type: 'birthday',
            channel: 'whatsapp',
            status: statusAnt,
            payload: {
              phase: 'anticipation',
              automation_key: `birthday:${occurrenceIsoAnt}:anticipation`,
              target_birthday_iso: occurrenceIsoAnt,
              error: resAnt.error ?? null,
              messageId: resAnt.messageId ?? null,
              message_body: bodyAnt,
              establishment: commerceName,
            },
            estimated_revenue_cents: 0,
          });
          if (resAnt.success) sent++;
        }
      }

      for (const mem of members ?? []) {
        if (sent >= BATCH) break;
        const m = mem as {
          id: string;
          phone_e164: string;
          birth_date: string;
          first_name?: string;
          display_name?: string;
          points_balance?: number | null;
          stamps_balance?: number | null;
          preferred_locale?: string | null;
        };
        const md = String(m.birth_date).slice(5, 10);
        if (md !== todayMd) continue;

        const occurrenceIsoDay = `${now.getFullYear()}-${todayMd}`;

        if (await shouldSkipBirthdayDay(admin, uid, m.id, occurrenceIsoDay, yearStartIso)) continue;

        const prenom = (m.first_name || m.display_name || '').split(/\s+/)[0] ?? '';
        const messageLocale = messageLocaleForAutomation(merchantLocale, m.preferred_locale);
        const tCompose = createServerTranslator('Dashboard.bananoAutomationCompose', messageLocale);
        const reductionLabel = formatReductionForMessage(
          cfg.discount_kind,
          cfg.discount_percent,
          cfg.discount_fixed_cents,
          messageLocale
        );

        const vRes = await ensureBirthdayGiftVoucher({
          supabase: admin,
          merchantUserId: uid,
          memberId: m.id,
          birthdayOccurrenceKey: occurrenceIsoDay,
          cfg,
          pointsBalance: Math.floor(Number(m.points_balance ?? 0)),
          stampsBalance: Math.floor(Number(m.stamps_balance ?? 0)),
          loyaltyMode,
          merchantLocale,
        });

        let middleBirth = cfg.message_template;
        if (process.env.OPENAI_API_KEY) {
          middleBirth = await personalizeLoyaltyAutomationMiddle({
            scenario: 'birthday',
            commerceName,
            prenom,
            baseMiddle: cfg.message_template,
            locale: messageLocale,
          });
        }
        const needDpBirth = automationTemplateUsesDernierProduit(cfg.message_template, middleBirth);
        const dernierBirth = needDpBirth
          ? await fetchDernierProduitFromLastEventNote(admin, m.id)
          : '';
        let body = composeBirthdayWhatsAppBody(
          { ...cfg, message_template: middleBirth },
          prenom,
          commerceName,
          tCompose('fallback_gift_birth'),
          tCompose,
          messageLocale,
          needDpBirth ? { dernier_produit: dernierBirth } : undefined
        );
        body = appendAutomationWalletLink(body, walletSmartAddUrl(uid, m.id), tCompose);

        const attrCents = attributionCentsFromDiscount(cfg.discount_kind, cfg.discount_fixed_cents);
        const res = await sendWhatsAppMessage(m.phone_e164, body);
        const status = res.success ? 'sent' : 'failed';
        await admin.from('banano_loyalty_automation_log').insert({
          user_id: uid,
          member_id: m.id,
          rule_type: 'birthday',
          channel: 'whatsapp',
          status,
          payload: {
            phase: 'day',
            automation_key: `birthday:${occurrenceIsoDay}:day`,
            target_birthday_iso: occurrenceIsoDay,
            error: res.error ?? null,
            messageId: res.messageId ?? null,
            message_body: body,
            reduction: reductionPayloadForLog(
              cfg.discount_kind,
              cfg.discount_percent,
              cfg.discount_fixed_cents,
              reductionLabel
            ),
            establishment: commerceName,
            birthday_voucher:
              'publicCode' in vRes
                ? { code: vRes.publicCode, created: vRes.created }
                : { error: (vRes as { error: string }).error },
          },
          estimated_revenue_cents: res.success ? attrCents : 0,
        });
        if (res.success) {
          await addMonthlyRevenue(admin, uid, attrCents);
          sent++;
        }
      }
    }

    if (ruleType === 'vip_of_month') {
      if (sent >= BATCH) break;
      const win = previousMonthWindowForVipParis(now);
      if (!win) continue;
      const cfg = mergeVipOfMonthConfig({ ...configRaw, enabled: true });
      const commerceName = await establishmentLabelForUser(admin, uid);
      const merchantLocale = await merchantLocaleForUser(admin, uid);

      const { data: dup } = await admin
        .from('banano_loyalty_automation_log')
        .select('id')
        .eq('user_id', uid)
        .eq('rule_type', 'vip_of_month')
        .contains('payload', { vip_month: win.vipMonthKey })
        .limit(1);
      if (dup?.length) continue;

      const { data: evs, error: vipEvErr } = await admin
        .from('banano_loyalty_events')
        .select('member_id, amount_cents, event_type')
        .eq('user_id', uid)
        .in('event_type', ['earn_points', 'earn_stamps'])
        .gte('created_at', win.fromIso)
        .lt('created_at', win.toExclusiveIso)
        .limit(50_000);

      if (vipEvErr || !evs?.length) continue;

      const spendByMember = new Map<string, number>();
      const visitsByMember = new Map<string, number>();
      for (const raw of evs) {
        const e = raw as { member_id: string; amount_cents?: number | null };
        const cents = Math.max(0, Math.floor(Number(e.amount_cents ?? 0)));
        spendByMember.set(e.member_id, (spendByMember.get(e.member_id) ?? 0) + cents);
        visitsByMember.set(e.member_id, (visitsByMember.get(e.member_id) ?? 0) + 1);
      }

      let bestId: string | null = null;
      let bestSpend = -1;
      for (const [mid, cents] of spendByMember.entries()) {
        if (cents > bestSpend) {
          bestSpend = cents;
          bestId = mid;
        }
      }
      let basis: 'spend' | 'visits' = 'spend';
      if (!bestId || bestSpend <= 0) {
        bestId = null;
        bestSpend = 0;
        let bestV = 0;
        for (const [mid, vc] of visitsByMember.entries()) {
          if (vc > bestV) {
            bestV = vc;
            bestId = mid;
          }
        }
        if (!bestId || bestV < 2) continue;
        basis = 'visits';
        bestSpend = spendByMember.get(bestId) ?? 0;
      }

      const { data: memV } = await admin
        .from('banano_loyalty_members')
        .select('id, phone_e164, first_name, display_name, last_name, preferred_locale')
        .eq('user_id', uid)
        .eq('id', bestId!)
        .maybeSingle();
      if (!memV) continue;
      const phone = String((memV as { phone_e164?: string }).phone_e164 ?? '').trim();
      if (phone.length < 10) continue;

      const prenom = (
        (memV as { first_name?: string; display_name?: string }).first_name ||
        (memV as { display_name?: string }).display_name ||
        ''
      )
        .trim()
        .split(/\s+/)[0] ?? '';
      const messageLocale = messageLocaleForAutomation(
        merchantLocale,
        (memV as { preferred_locale?: string | null }).preferred_locale
      );
      const tCompose = createServerTranslator('Dashboard.bananoAutomationCompose', messageLocale);
      const vipPeriodLabel = formatVipPeriodRangeLabel(
        win.prevStart,
        win.last,
        messageLocale,
        (key, values) => tCompose(key, values as Record<string, string>)
      );
      const spendFormatted = formatSpendCentsForMessage(bestSpend, messageLocale);
      const reductionLabel = formatReductionForMessage(
        cfg.discount_kind,
        cfg.discount_percent,
        cfg.discount_fixed_cents,
        messageLocale
      );
      let middleVip = cfg.message_template;
      if (process.env.OPENAI_API_KEY) {
        middleVip = await personalizeLoyaltyAutomationMiddle({
          scenario: 'vip_of_month',
          commerceName,
          prenom,
          baseMiddle: cfg.message_template,
          vipPeriodLabel,
          vipMontantCa: spendFormatted,
          locale: messageLocale,
        });
      }
      const needDpVip = automationTemplateUsesDernierProduit(cfg.message_template, middleVip);
      const dernierVip = needDpVip
        ? await fetchDernierProduitFromLastEventNote(admin, bestId!)
        : '';
      const body = composeVipOfMonthWhatsAppBody(
        { ...cfg, message_template: middleVip },
        prenom,
        commerceName,
        vipPeriodLabel,
        spendFormatted,
        tCompose('fallback_attention_vip'),
        tCompose,
        messageLocale,
        needDpVip ? { dernier_produit: dernierVip } : undefined
      );
      const attrCents = attributionCentsFromDiscount(cfg.discount_kind, cfg.discount_fixed_cents);
      const res = await sendWhatsAppMessage(phone, body);
      const status = res.success ? 'sent' : 'failed';
      await admin.from('banano_loyalty_automation_log').insert({
        user_id: uid,
        member_id: bestId,
        rule_type: 'vip_of_month',
        channel: 'whatsapp',
        status,
        payload: {
          error: res.error ?? null,
          messageId: res.messageId ?? null,
          message_body: body,
          vip_month: win.vipMonthKey,
          period_label_fr: vipPeriodLabel,
          spend_cents: bestSpend,
          basis,
          reduction: reductionPayloadForLog(
            cfg.discount_kind,
            cfg.discount_percent,
            cfg.discount_fixed_cents,
            reductionLabel
          ),
          establishment: commerceName,
        },
        estimated_revenue_cents: res.success ? attrCents : 0,
      });
      if (res.success) {
        await addMonthlyRevenue(admin, uid, attrCents);
        sent++;
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
