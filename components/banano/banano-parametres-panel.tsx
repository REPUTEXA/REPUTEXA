'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Gem, Gift, Loader2, SlidersHorizontal, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { BananoLoyaltyMerchantSettings } from '@/components/banano/banano-loyalty-merchant-settings';
import { BananoGhostAgentTokensSection } from '@/components/banano/banano-ghost-agent-tokens';
import { TeamPageClient } from '@/components/dashboard/team-page-client';
import { BananoStaffSettings } from '@/components/banano/banano-staff-settings';
import { BananoEliteRewardSettings } from '@/components/banano/banano-elite-reward-settings';
import { WhatsAppBubble } from '@/components/banano/WhatsAppBubble';
import type { BananoLoyaltyMerchantConfig } from '@/lib/banano/loyalty-profile';
import { recommendedInactivityDaysForTrade } from '@/lib/wallet/themes';
import {
  appendAutomationWalletLink,
  composeBirthdayAnticipationWhatsAppBody,
  composeBirthdayWhatsAppBody,
  composeLostClientWhatsAppBody,
  composeNewClientWelcomeWhatsAppBody,
  composeVipOfMonthWhatsAppBody,
  mergeBirthdayConfig,
  mergeLostConfig,
  mergeNewClientWelcomeConfig,
  mergeVipOfMonthConfig,
  type DiscountKind,
} from '@/lib/banano/banano-automation-defaults';

function insertAtCursor(
  el: HTMLTextAreaElement | null,
  chunk: string,
  value: string,
  onChange: (next: string) => void
) {
  if (!el) {
    onChange(value + chunk);
    return;
  }
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const next = value.slice(0, start) + chunk + value.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + chunk.length;
    el.setSelectionRange(pos, pos);
  });
}

function AutomationTagBar({
  disabled,
  onInsert,
  t,
}: {
  disabled?: boolean;
  onInsert: (token: string) => void;
  t: (key: string) => string;
}) {
  const tags: { label: string; token: string }[] = [
    { label: t('tagInsertPrenom'), token: '{{prenom}}' },
    { label: t('tagInsertCommerce'), token: '{{etablissement}}' },
    { label: t('tagInsertDernierProduit'), token: '{{dernier_produit}}' },
  ];
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 mt-1.5"
      role="group"
      aria-label={t('tagBarAria')}
    >
      {tags.map((x) => (
        <button
          key={x.token}
          type="button"
          disabled={disabled}
          onClick={() => onInsert(x.token)}
          className="text-[11px] font-medium px-2 py-1 rounded-full border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-200 hover:border-emerald-500/50 hover:text-emerald-700 dark:hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {x.label}
        </button>
      ))}
    </div>
  );
}

type BootstrapPayload = {
  pinConfigured: boolean;
  loyalty: BananoLoyaltyMerchantConfig;
};

type LostClientRules = {
  enabled: boolean;
  inactive_days: number;
  min_lifetime_visits: number;
  message_template: string;
  discount_kind: DiscountKind;
  discount_percent: number;
  discount_fixed_cents: number;
};

type BirthdayRules = {
  enabled: boolean;
  message_template: string;
  anticipation_enabled: boolean;
  anticipation_days: number;
  discount_kind: DiscountKind;
  discount_percent: number;
  discount_fixed_cents: number;
};

type VipOfMonthRules = {
  enabled: boolean;
  message_template: string;
  discount_kind: DiscountKind;
  discount_percent: number;
  discount_fixed_cents: number;
};

type NewClientWelcomeRules = {
  enabled: boolean;
  delay_days: number;
  message_template: string;
  discount_kind: DiscountKind;
  discount_percent: number;
  discount_fixed_cents: number;
};

type AutomationSegmentTab = 'recovery' | 'welcome' | 'privilege' | 'birthday';

export function BananoParametresPanel() {
  const locale = useLocale();
  const t = useTranslations('Dashboard.bananoParametres');
  const tCompose = useTranslations('Dashboard.bananoAutomationCompose');
  const [bootLoading, setBootLoading] = useState(true);
  const [bootErr, setBootErr] = useState<string | null>(null);
  const [loyaltyCfg, setLoyaltyCfg] = useState<BananoLoyaltyMerchantConfig | null>(null);
  const [lostRules, setLostRules] = useState<LostClientRules | null>(null);
  const [birthRules, setBirthRules] = useState<BirthdayRules | null>(null);
  const [vipRules, setVipRules] = useState<VipOfMonthRules | null>(null);
  const [welcomeRules, setWelcomeRules] = useState<NewClientWelcomeRules | null>(null);
  const [automationSegment, setAutomationSegment] = useState<AutomationSegmentTab>('recovery');
  const [pilotLoading, setPilotLoading] = useState(true);
  const [pilotSaving, setPilotSaving] = useState(false);
  const [establishmentName, setEstablishmentName] = useState('');
  const [automationSaveSuccess, setAutomationSaveSuccess] = useState(false);
  const [testScenarioSending, setTestScenarioSending] = useState<string | null>(null);
  /** Métier Wallet / collecte d’avis (`profiles.banano_wallet_archetype_id`). */
  const [walletArchetypeId, setWalletArchetypeId] = useState<string | null>(null);
  const lostTaRef = useRef<HTMLTextAreaElement | null>(null);
  const birthTaRef = useRef<HTMLTextAreaElement | null>(null);
  const vipTaRef = useRef<HTMLTextAreaElement | null>(null);
  const welcomeTaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewFirst = t('previewFirstName');
  const establishmentSuffixStr = establishmentName.trim()
    ? t('establishmentSuffix', { name: establishmentName.trim() })
    : '';
  const previewDernier = tCompose('fallback_dernier_produit');
  const previewChatTitle = establishmentName.trim() || t('establishmentNameFallback');
  const tradeRecommendedInactiveDays = recommendedInactivityDaysForTrade(walletArchetypeId);

  const loadBootstrap = useCallback(async () => {
    setBootErr(null);
    setBootLoading(true);
    try {
      const res = await fetch('/api/banano/bootstrap');
      const data = (await res.json()) as BootstrapPayload & { error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errLoad'));
      if (!data.loyalty) throw new Error(t('errInvalid'));
      setLoyaltyCfg(data.loyalty);
    } catch (e) {
      setBootErr(e instanceof Error ? e.message : t('errGeneric'));
      setLoyaltyCfg(null);
    } finally {
      setBootLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    let cancelled = false;
    setPilotLoading(true);
    void fetch(
      `/api/banano/loyalty/automation?uiLocale=${encodeURIComponent(locale)}`
    )
      .then(async (r) => {
        const data = (await r.json()) as {
          lost_client?: LostClientRules;
          birthday?: BirthdayRules;
          vip_of_month?: VipOfMonthRules;
          new_client_welcome?: NewClientWelcomeRules;
          establishment_name?: string;
          wallet_archetype_id?: string | null;
          error?: string;
        };
        if (cancelled) return;
        if (!r.ok || data.error) {
          setLostRules(null);
          setBirthRules(null);
          setVipRules(null);
          setWelcomeRules(null);
          setWalletArchetypeId(null);
          return;
        }
        if (typeof data.establishment_name === 'string') {
          setEstablishmentName(data.establishment_name.trim());
        }
        setWalletArchetypeId(
          typeof data.wallet_archetype_id === 'string' && data.wallet_archetype_id
            ? data.wallet_archetype_id
            : null
        );
        setLostRules(mergeLostConfig(data.lost_client ?? {}));
        setBirthRules(mergeBirthdayConfig(data.birthday ?? {}));
        setVipRules(mergeVipOfMonthConfig(data.vip_of_month ?? {}));
        setWelcomeRules(mergeNewClientWelcomeConfig(data.new_client_welcome ?? {}));
      })
      .catch(() => {
        if (!cancelled) {
          setLostRules(null);
          setBirthRules(null);
          setVipRules(null);
          setWelcomeRules(null);
          setWalletArchetypeId(null);
        }
      })
      .finally(() => {
        if (!cancelled) setPilotLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  async function savePilotRules() {
    if (!lostRules || !birthRules || !vipRules || !welcomeRules) return;
    setPilotSaving(true);
    try {
      const res = await fetch(
        `/api/banano/loyalty/automation?uiLocale=${encodeURIComponent(locale)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lost_client: lostRules,
            birthday: birthRules,
            vip_of_month: vipRules,
            new_client_welcome: welcomeRules,
          }),
        }
      );
      const data = (await res.json()) as {
        lost_client?: LostClientRules;
        birthday?: BirthdayRules;
        vip_of_month?: VipOfMonthRules;
        new_client_welcome?: NewClientWelcomeRules;
        wallet_archetype_id?: string | null;
        establishment_name?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      if (data.lost_client) setLostRules(mergeLostConfig(data.lost_client));
      if (data.birthday) setBirthRules(mergeBirthdayConfig(data.birthday));
      if (data.vip_of_month) setVipRules(mergeVipOfMonthConfig(data.vip_of_month));
      if (data.new_client_welcome) {
        setWelcomeRules(mergeNewClientWelcomeConfig(data.new_client_welcome));
      }
      if ('wallet_archetype_id' in data) {
        const w = data.wallet_archetype_id;
        setWalletArchetypeId(typeof w === 'string' && w ? w : null);
      }
      if (typeof data.establishment_name === 'string') {
        setEstablishmentName(data.establishment_name.trim());
      }
      setAutomationSaveSuccess(true);
      window.setTimeout(() => setAutomationSaveSuccess(false), 6500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setPilotSaving(false);
    }
  }

  const sendAutomationTest = useCallback(
    async (
      scenario:
        | 'lost_client'
        | 'birthday'
        | 'birthday_anticipation'
        | 'vip_of_month'
        | 'new_client_welcome'
    ) => {
      if (!lostRules || !birthRules || !vipRules || !welcomeRules) return;
      setTestScenarioSending(scenario);
      try {
        const res = await fetch('/api/banano/loyalty/automation/test-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario,
            lost_client: lostRules,
            birthday: birthRules,
            vip_of_month: vipRules,
            new_client_welcome: welcomeRules,
            preview_labels: {
              prenom: previewFirst,
              vip_period: t('vipPreviewPeriod'),
              vip_amount: t('vipPreviewAmount'),
              wallet_url_placeholder: t('previewWalletUrlPlaceholder'),
            },
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          retryAfterSec?: number;
        };
        if (!res.ok) {
          const lead = data.error ?? t('testErrorGeneric');
          const extra =
            res.status === 429 && data.retryAfterSec ? ` (${data.retryAfterSec}s)` : '';
          throw new Error(lead + extra);
        }
        toast.success(t('testSentToast'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('testErrorGeneric'));
      } finally {
        setTestScenarioSending(null);
      }
    },
    [lostRules, birthRules, vipRules, welcomeRules, previewFirst, t]
  );

  if (bootLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">{t('loadingSettings')}</p>
      </div>
    );
  }

  if (bootErr || !loyaltyCfg) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-6 text-sm text-red-800 dark:text-red-200">
        {bootErr ?? t('loadLoyaltyFailed')}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-[#2563eb]">
          <SlidersHorizontal className="w-5 h-5" />
          <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-50">
            {t('headerTitle')}
          </h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          {t('headerLead')}
        </p>
      </header>

      <section
        id="banano-wallet-geo"
        className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] p-4 sm:p-6 shadow-sm space-y-4 scroll-mt-24"
      >
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wide">
          {t('sectionLoyaltyTitle')}
        </h3>
        <BananoLoyaltyMerchantSettings
          loyalty={loyaltyCfg}
          onSaved={(next) => {
            setLoyaltyCfg(next);
          }}
          onRefreshBootstrap={loadBootstrap}
        />
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wide">
          {t('sectionRelancesTitle')}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
          {t('relancesTabsLead')}
        </p>
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] p-4 space-y-4 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              {t('autoMessagesTitle')}
            </h4>
            <AnimatePresence>
              {automationSaveSuccess ? (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                  className="flex gap-3 items-start rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-950 dark:text-emerald-50"
                >
                  <div className="mt-0.5 rounded-full bg-emerald-500 text-white p-0.5 shrink-0">
                    <Check className="w-4 h-4" strokeWidth={2.5} aria-hidden />
                  </div>
                  <div>
                    <p className="font-semibold">{t('automationSaveSuccessTitle')}</p>
                    <p className="text-emerald-900/90 dark:text-emerald-100/90 text-xs mt-0.5 leading-relaxed">
                      {t('automationSaveSuccessLead')}
                    </p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed rounded-lg border border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40 px-3 py-2">
              {t('whatsappHelpA')}
              <strong className="text-slate-700 dark:text-slate-200">
                {establishmentName.trim() || t('establishmentNameFallback')}
              </strong>
              {t('whatsappHelpB')}
              <Link
                href="/dashboard/settings"
                className="text-[#2563eb] font-semibold underline underline-offset-2"
              >
                {t('linkAccountSettings')}
              </Link>
              {t('whatsappHelpC')}
            </p>
            {pilotLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('loadingPilotRules')}
              </div>
            ) : lostRules && birthRules && vipRules && welcomeRules ? (
              <div className="space-y-5">
                <div
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3"
                  role="tablist"
                  aria-label={t('relancesTabsAria')}
                >
                  {(
                    [
                      ['recovery', t('segmentRecovery')] as const,
                      ['welcome', t('segmentWelcome')] as const,
                      ['privilege', t('segmentPrivilege')] as const,
                      ['birthday', t('segmentBirthday')] as const,
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={automationSegment === id}
                      onClick={() => setAutomationSegment(id)}
                      className={`text-sm font-semibold min-h-[44px] px-3 py-2 rounded-xl border transition-colors ${
                        automationSegment === id
                          ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#1d4ed8] dark:text-blue-300'
                          : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-zinc-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed -mt-1">
                  {automationSegment === 'recovery'
                    ? t('segmentRecoveryLead')
                    : automationSegment === 'welcome'
                      ? t('segmentWelcomeLead')
                      : automationSegment === 'privilege'
                        ? t('segmentPrivilegeLead')
                        : t('segmentBirthdayLead')}
                </p>
                {automationSegment === 'recovery' ? (
                <div
                  id="banano-automation-lost"
                  className="space-y-2 border-b border-slate-100 dark:border-zinc-800 pb-4 scroll-mt-24"
                >
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                    <input
                      type="checkbox"
                      checked={lostRules.enabled}
                      onChange={(e) =>
                        setLostRules((r) => (r ? { ...r, enabled: e.target.checked } : r))
                      }
                      className="rounded border-slate-300"
                    />
                    {t('lostClientLabel')}
                  </label>
                  {!lostRules.enabled ? (
                    <p className="text-[11px] text-amber-800 dark:text-amber-200/90 rounded-lg border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 px-2.5 py-1.5">
                      {t('lostClientDisabled')}
                    </p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block text-xs text-slate-500">
                      <span className="flex flex-wrap items-center gap-2">
                        <span>{t('daysInactiveLabel')}</span>
                        {walletArchetypeId ? (
                          <button
                            type="button"
                            disabled={!lostRules.enabled}
                            title={t('lostInactiveTradeRecommendedAria', {
                              days: tradeRecommendedInactiveDays,
                            })}
                            aria-label={t('lostInactiveTradeRecommendedAria', {
                              days: tradeRecommendedInactiveDays,
                            })}
                            onClick={() =>
                              setLostRules((r) =>
                                r
                                  ? {
                                      ...r,
                                      inactive_days: Math.min(
                                        90,
                                        Math.max(7, tradeRecommendedInactiveDays)
                                      ),
                                    }
                                  : r
                              )
                            }
                            className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {t('lostInactiveTradeRecommended', { days: tradeRecommendedInactiveDays })}
                          </button>
                        ) : null}
                      </span>
                      <input
                        type="number"
                        min={7}
                        max={90}
                        disabled={!lostRules.enabled}
                        value={lostRules.inactive_days}
                        onChange={(e) =>
                          setLostRules((r) =>
                            r ? { ...r, inactive_days: Number(e.target.value) } : r
                          )
                        }
                        className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </label>
                    <label className="block text-xs text-slate-500">
                      {t('minVisitsLabel')}
                      <input
                        type="number"
                        min={1}
                        max={50}
                        disabled={!lostRules.enabled}
                        value={lostRules.min_lifetime_visits}
                        onChange={(e) =>
                          setLostRules((r) =>
                            r ? { ...r, min_lifetime_visits: Number(e.target.value) } : r
                          )
                        }
                        className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </label>
                  </div>
                  <label className="block text-xs text-slate-500">
                    {t('personalTouchLabel')}
                    <AutomationTagBar
                      disabled={!lostRules.enabled}
                      t={t}
                      onInsert={(token) =>
                        insertAtCursor(lostTaRef.current, token, lostRules.message_template, (next) =>
                          setLostRules((r) => (r ? { ...r, message_template: next } : r))
                        )
                      }
                    />
                    <textarea
                      ref={lostTaRef}
                      disabled={!lostRules.enabled}
                      value={lostRules.message_template}
                      onChange={(e) =>
                        setLostRules((r) => (r ? { ...r, message_template: e.target.value } : r))
                      }
                      rows={3}
                      className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder={t('placeholderLost')}
                    />
                  </label>
                  <div
                    className={`rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/30 p-3 space-y-2 ${!lostRules.enabled ? 'opacity-50' : ''}`}
                  >
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {t('discountWithMessage')}
                    </p>
                    <label className="block text-[11px] text-slate-500">
                      {t('typeLabel')}
                      <select
                        disabled={!lostRules.enabled}
                        value={lostRules.discount_kind}
                        onChange={(e) =>
                          setLostRules((r) =>
                            r ? { ...r, discount_kind: e.target.value as DiscountKind } : r
                          )
                        }
                        className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:cursor-not-allowed"
                      >
                        <option value="none">{t('optNone')}</option>
                        <option value="percent">{t('optPercent')}</option>
                        <option value="fixed">{t('optFixedEur')}</option>
                      </select>
                    </label>
                    {lostRules.discount_kind === 'percent' ? (
                      <label className="block text-[11px] text-slate-500">
                        {t('percentRange')}
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={lostRules.discount_percent}
                          onChange={(e) =>
                            setLostRules((r) =>
                              r ? { ...r, discount_percent: Number(e.target.value) } : r
                            )
                          }
                          className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                        />
                      </label>
                    ) : null}
                    {lostRules.discount_kind === 'fixed' ? (
                      <label className="block text-[11px] text-slate-500">
                        {t('amountEurFixed')}
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={lostRules.discount_fixed_cents / 100}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setLostRules((r) =>
                              r ? { ...r, discount_fixed_cents: Math.round(v * 100) } : r
                            );
                          }}
                          className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                        />
                      </label>
                    ) : null}
                    <div className="pt-2 border-t border-slate-200/80 dark:border-zinc-700/80 space-y-2">
                      <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {t('previewWhatsAppTitle')}
                      </p>
                      <WhatsAppBubble
                        chatTitle={previewChatTitle}
                        locale={locale}
                        message={composeLostClientWhatsAppBody(
                          lostRules,
                          previewFirst,
                          establishmentName.trim(),
                          t('previewOfferLost'),
                          tCompose,
                          locale,
                          { dernier_produit: previewDernier }
                        )}
                      />
                      <button
                        type="button"
                        disabled={Boolean(testScenarioSending) || !lostRules.enabled}
                        onClick={() => void sendAutomationTest('lost_client')}
                        className="text-[11px] font-semibold text-[#128c7e] dark:text-emerald-400 hover:underline disabled:opacity-40 disabled:no-underline"
                      >
                        {testScenarioSending === 'lost_client' ? t('testSending') : t('testSendLost')}
                      </button>
                    </div>
                  </div>
                </div>
                ) : null}

                {automationSegment === 'welcome' ? (
                <div
                  id="banano-automation-welcome"
                  className="space-y-2 border-b border-slate-100 dark:border-zinc-800 pb-4 scroll-mt-24"
                >
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                    <input
                      type="checkbox"
                      checked={welcomeRules.enabled}
                      onChange={(e) =>
                        setWelcomeRules((r) => (r ? { ...r, enabled: e.target.checked } : r))
                      }
                      className="rounded border-slate-300"
                    />
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    {t('newClientLabel')}
                  </label>
                  {!welcomeRules.enabled ? (
                    <p className="text-[11px] text-amber-800 dark:text-amber-200/90 rounded-lg border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 px-2.5 py-1.5">
                      {t('newClientDisabled')}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t('newClientDelayHint')}
                  </p>
                  <label className="block text-xs text-slate-500">
                    {t('newClientDelayLabel')}
                    <input
                      type="number"
                      min={1}
                      max={14}
                      disabled={!welcomeRules.enabled}
                      value={welcomeRules.delay_days}
                      onChange={(e) =>
                        setWelcomeRules((r) =>
                          r
                            ? {
                                ...r,
                                delay_days: Math.min(
                                  14,
                                  Math.max(1, Math.floor(Number(e.target.value)))
                                ),
                              }
                            : r
                        )
                      }
                      className="mt-1 w-full max-w-[120px] px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </label>
                  <label className="block text-xs text-slate-500">
                    {t('personalTouchLabel')}
                    <AutomationTagBar
                      disabled={!welcomeRules.enabled}
                      t={t}
                      onInsert={(token) =>
                        insertAtCursor(
                          welcomeTaRef.current,
                          token,
                          welcomeRules.message_template,
                          (next) => setWelcomeRules((r) => (r ? { ...r, message_template: next } : r))
                        )
                      }
                    />
                    <textarea
                      ref={welcomeTaRef}
                      disabled={!welcomeRules.enabled}
                      value={welcomeRules.message_template}
                      onChange={(e) =>
                        setWelcomeRules((r) =>
                          r ? { ...r, message_template: e.target.value } : r
                        )
                      }
                      rows={3}
                      className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder={t('placeholderWelcome')}
                    />
                  </label>
                  <div
                    className={`rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/30 p-3 space-y-2 ${!welcomeRules.enabled ? 'opacity-50' : ''}`}
                  >
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {t('newClientDiscountTitle')}
                    </p>
                    <label className="block text-[11px] text-slate-500">
                      {t('typeLabel')}
                      <select
                        disabled={!welcomeRules.enabled}
                        value={welcomeRules.discount_kind}
                        onChange={(e) =>
                          setWelcomeRules((r) =>
                            r ? { ...r, discount_kind: e.target.value as DiscountKind } : r
                          )
                        }
                        className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:cursor-not-allowed"
                      >
                        <option value="none">{t('optNoneTextOnly')}</option>
                        <option value="percent">{t('optPercent')}</option>
                        <option value="fixed">{t('optFixedEur')}</option>
                      </select>
                    </label>
                    {welcomeRules.discount_kind === 'percent' ? (
                      <label className="block text-[11px] text-slate-500">
                        {t('percentRange')}
                        <input
                          type="number"
                          min={1}
                          max={100}
                          disabled={!welcomeRules.enabled}
                          value={welcomeRules.discount_percent}
                          onChange={(e) =>
                            setWelcomeRules((r) =>
                              r ? { ...r, discount_percent: Number(e.target.value) } : r
                            )
                          }
                          className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </label>
                    ) : null}
                    {welcomeRules.discount_kind === 'fixed' ? (
                      <label className="block text-[11px] text-slate-500">
                        {t('amountEurFixed')}
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          disabled={!welcomeRules.enabled}
                          value={welcomeRules.discount_fixed_cents / 100}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setWelcomeRules((r) =>
                              r ? { ...r, discount_fixed_cents: Math.round(v * 100) } : r
                            );
                          }}
                          className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </label>
                    ) : null}
                    <div className="pt-2 border-t border-slate-200/80 dark:border-zinc-700/80 space-y-2">
                      <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {t('previewWelcomeTitle', {
                          prenom: previewFirst,
                          establishmentSuffix: establishmentSuffixStr,
                        })}
                      </p>
                      <WhatsAppBubble
                        chatTitle={previewChatTitle}
                        locale={locale}
                        message={appendAutomationWalletLink(
                          composeNewClientWelcomeWhatsAppBody(
                            welcomeRules,
                            previewFirst,
                            establishmentName.trim(),
                            t('previewWelcomeGift'),
                            tCompose,
                            locale,
                            { dernier_produit: previewDernier }
                          ),
                          t('previewWalletUrlPlaceholder'),
                          tCompose
                        )}
                      />
                      <button
                        type="button"
                        disabled={Boolean(testScenarioSending) || !welcomeRules.enabled}
                        onClick={() => void sendAutomationTest('new_client_welcome')}
                        className="text-[11px] font-semibold text-[#128c7e] dark:text-emerald-400 hover:underline disabled:opacity-40 disabled:no-underline"
                      >
                        {testScenarioSending === 'new_client_welcome'
                          ? t('testSending')
                          : t('testSendWelcome')}
                      </button>
                    </div>
                  </div>
                </div>
                ) : null}

                {automationSegment === 'birthday' ? (
                <div id="banano-automation-birthday" className="space-y-2 scroll-mt-24">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                    <input
                      type="checkbox"
                      checked={birthRules.enabled}
                      onChange={(e) =>
                        setBirthRules((r) => (r ? { ...r, enabled: e.target.checked } : r))
                      }
                      className="rounded border-slate-300"
                    />
                    <Gift className="w-4 h-4 text-rose-500" />
                    {t('birthdayLabel')}
                  </label>
                  {!birthRules.enabled ? (
                    <p className="text-[11px] text-amber-800 dark:text-amber-200/90 rounded-lg border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 px-2.5 py-1.5">
                      {t('birthdayDisabled')}
                    </p>
                  ) : null}
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={birthRules.anticipation_enabled}
                      disabled={!birthRules.enabled}
                      onChange={(e) =>
                        setBirthRules((r) =>
                          r ? { ...r, anticipation_enabled: e.target.checked } : r
                        )
                      }
                      className="rounded border-slate-300"
                    />
                    {t('birthdayAnticipationLabel')}
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t('birthdayAnticipationHint')}
                  </p>
                  <label className="block text-xs text-slate-500">
                    {t('birthdayAnticipationDays')}
                    <input
                      type="number"
                      min={1}
                      max={21}
                      disabled={!birthRules.enabled || !birthRules.anticipation_enabled}
                      value={birthRules.anticipation_days}
                      onChange={(e) =>
                        setBirthRules((r) =>
                          r ? { ...r, anticipation_days: Number(e.target.value) } : r
                        )
                      }
                      className="mt-1 w-full max-w-[120px] px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </label>
                  <label className="block text-xs text-slate-500">
                    {t('personalTouchLabel')}
                    <AutomationTagBar
                      disabled={!birthRules.enabled}
                      t={t}
                      onInsert={(token) =>
                        insertAtCursor(
                          birthTaRef.current,
                          token,
                          birthRules.message_template,
                          (next) => setBirthRules((r) => (r ? { ...r, message_template: next } : r))
                        )
                      }
                    />
                    <textarea
                      ref={birthTaRef}
                      disabled={!birthRules.enabled}
                      value={birthRules.message_template}
                      onChange={(e) =>
                        setBirthRules((r) => (r ? { ...r, message_template: e.target.value } : r))
                      }
                      rows={2}
                      className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder={t('placeholderBirth')}
                    />
                  </label>
                  <div
                    className={`rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/30 p-3 space-y-2 ${!birthRules.enabled ? 'opacity-50' : ''}`}
                  >
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {t('birthdayDiscountTitle')}
                    </p>
                    <label className="block text-[11px] text-slate-500">
                      {t('typeLabel')}
                      <select
                        disabled={!birthRules.enabled}
                        value={birthRules.discount_kind}
                        onChange={(e) =>
                          setBirthRules((r) =>
                            r ? { ...r, discount_kind: e.target.value as DiscountKind } : r
                          )
                        }
                        className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:cursor-not-allowed"
                      >
                        <option value="none">{t('optNoneTextOnly')}</option>
                        <option value="percent">{t('optPercent')}</option>
                        <option value="fixed">{t('optFixedEur')}</option>
                      </select>
                    </label>
                    {birthRules.discount_kind === 'percent' ? (
                      <label className="block text-[11px] text-slate-500">
                        {t('percentRange')}
                        <input
                          type="number"
                          min={1}
                          max={100}
                          disabled={!birthRules.enabled}
                          value={birthRules.discount_percent}
                          onChange={(e) =>
                            setBirthRules((r) =>
                              r ? { ...r, discount_percent: Number(e.target.value) } : r
                            )
                          }
                          className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </label>
                    ) : null}
                    {birthRules.discount_kind === 'fixed' ? (
                      <label className="block text-[11px] text-slate-500">
                        {t('amountEurFixed')}
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          disabled={!birthRules.enabled}
                          value={birthRules.discount_fixed_cents / 100}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setBirthRules((r) =>
                              r ? { ...r, discount_fixed_cents: Math.round(v * 100) } : r
                            );
                          }}
                          className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </label>
                    ) : null}
                    <div className="pt-2 border-t border-slate-200/80 dark:border-zinc-700/80 space-y-2">
                      <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {t('previewBirthAnticipationTitle')}
                      </p>
                      <WhatsAppBubble
                        chatTitle={previewChatTitle}
                        locale={locale}
                        message={appendAutomationWalletLink(
                          composeBirthdayAnticipationWhatsAppBody(
                            previewFirst,
                            establishmentName.trim(),
                            tCompose,
                            locale
                          ),
                          t('previewWalletUrlPlaceholder'),
                          tCompose
                        )}
                      />
                      <button
                        type="button"
                        disabled={
                          Boolean(testScenarioSending) ||
                          !birthRules.enabled ||
                          !birthRules.anticipation_enabled
                        }
                        onClick={() => void sendAutomationTest('birthday_anticipation')}
                        className="text-[11px] font-semibold text-[#128c7e] dark:text-emerald-400 hover:underline disabled:opacity-40 disabled:no-underline"
                      >
                        {testScenarioSending === 'birthday_anticipation'
                          ? t('testSending')
                          : t('testSendBirthdayAnticipation')}
                      </button>
                    </div>
                    <div className="pt-2 border-t border-slate-200/80 dark:border-zinc-700/80 space-y-2">
                      <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {t('previewLostBirthTitle', {
                          prenom: previewFirst,
                          establishmentSuffix: establishmentSuffixStr,
                        })}
                      </p>
                      <WhatsAppBubble
                        chatTitle={previewChatTitle}
                        locale={locale}
                        message={appendAutomationWalletLink(
                          composeBirthdayWhatsAppBody(
                            birthRules,
                            previewFirst,
                            establishmentName.trim(),
                            t('previewGiftBirth'),
                            tCompose,
                            locale,
                            { dernier_produit: previewDernier }
                          ),
                          t('previewWalletUrlPlaceholder'),
                          tCompose
                        )}
                      />
                      <button
                        type="button"
                        disabled={Boolean(testScenarioSending) || !birthRules.enabled}
                        onClick={() => void sendAutomationTest('birthday')}
                        className="text-[11px] font-semibold text-[#128c7e] dark:text-emerald-400 hover:underline disabled:opacity-40 disabled:no-underline"
                      >
                        {testScenarioSending === 'birthday' ? t('testSending') : t('testSendBirthday')}
                      </button>
                    </div>
                  </div>
                </div>
                ) : null}

                {automationSegment === 'privilege' ? (
                <div
                  id="banano-automation-vip"
                  className="space-y-2 border-b border-slate-100 dark:border-zinc-800 pb-4 scroll-mt-24"
                >
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                    <input
                      type="checkbox"
                      checked={vipRules.enabled}
                      onChange={(e) =>
                        setVipRules((r) => (r ? { ...r, enabled: e.target.checked } : r))
                      }
                      className="rounded border-slate-300"
                    />
                    <Gem className="w-4 h-4 text-violet-500" />
                    {t('vipLabel')}
                  </label>
                  {!vipRules.enabled ? (
                    <p className="text-[11px] text-amber-800 dark:text-amber-200/90 rounded-lg border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 px-2.5 py-1.5">
                      {t('vipDisabled')}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t('variablesHelp')}
                  </p>
                  <label className="block text-xs text-slate-500">
                    {t('personalTouchLabel')}
                    <AutomationTagBar
                      disabled={!vipRules.enabled}
                      t={t}
                      onInsert={(token) =>
                        insertAtCursor(
                          vipTaRef.current,
                          token,
                          vipRules.message_template,
                          (next) => setVipRules((r) => (r ? { ...r, message_template: next } : r))
                        )
                      }
                    />
                    <textarea
                      ref={vipTaRef}
                      disabled={!vipRules.enabled}
                      value={vipRules.message_template}
                      onChange={(e) =>
                        setVipRules((r) => (r ? { ...r, message_template: e.target.value } : r))
                      }
                      rows={2}
                      className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder={t('placeholderVip')}
                    />
                  </label>
                  <div
                    className={`rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/30 p-3 space-y-2 ${!vipRules.enabled ? 'opacity-50' : ''}`}
                  >
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {t('vipDiscountTitle')}
                    </p>
                    <label className="block text-[11px] text-slate-500">
                      {t('typeLabel')}
                      <select
                        disabled={!vipRules.enabled}
                        value={vipRules.discount_kind}
                        onChange={(e) =>
                          setVipRules((r) =>
                            r ? { ...r, discount_kind: e.target.value as DiscountKind } : r
                          )
                        }
                        className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:cursor-not-allowed"
                      >
                        <option value="none">{t('optNoneTextOnly')}</option>
                        <option value="percent">{t('optPercent')}</option>
                        <option value="fixed">{t('optFixedEur')}</option>
                      </select>
                    </label>
                    {vipRules.discount_kind === 'percent' ? (
                      <label className="block text-[11px] text-slate-500">
                        {t('percentRange')}
                        <input
                          type="number"
                          min={1}
                          max={100}
                          disabled={!vipRules.enabled}
                          value={vipRules.discount_percent}
                          onChange={(e) =>
                            setVipRules((r) =>
                              r ? { ...r, discount_percent: Number(e.target.value) } : r
                            )
                          }
                          className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </label>
                    ) : null}
                    {vipRules.discount_kind === 'fixed' ? (
                      <label className="block text-[11px] text-slate-500">
                        {t('amountEurFixed')}
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          disabled={!vipRules.enabled}
                          value={vipRules.discount_fixed_cents / 100}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setVipRules((r) =>
                              r ? { ...r, discount_fixed_cents: Math.round(v * 100) } : r
                            );
                          }}
                          className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </label>
                    ) : null}
                    <div className="pt-2 border-t border-slate-200/80 dark:border-zinc-700/80 space-y-2">
                      <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {t('previewVipTitle', {
                          prenom: previewFirst,
                          establishmentSuffix: establishmentSuffixStr,
                          period: t('vipPreviewPeriod'),
                          amount: t('vipPreviewAmount'),
                        })}
                      </p>
                      <WhatsAppBubble
                        chatTitle={previewChatTitle}
                        locale={locale}
                        message={composeVipOfMonthWhatsAppBody(
                          vipRules,
                          previewFirst,
                          establishmentName.trim(),
                          t('vipPreviewPeriod'),
                          t('vipPreviewAmount'),
                          t('previewAttentionVip'),
                          tCompose,
                          locale,
                          { dernier_produit: previewDernier }
                        )}
                      />
                      <button
                        type="button"
                        disabled={Boolean(testScenarioSending) || !vipRules.enabled}
                        onClick={() => void sendAutomationTest('vip_of_month')}
                        className="text-[11px] font-semibold text-[#128c7e] dark:text-emerald-400 hover:underline disabled:opacity-40 disabled:no-underline"
                      >
                        {testScenarioSending === 'vip_of_month' ? t('testSending') : t('testSendVip')}
                      </button>
                    </div>
                  </div>
                </div>
                ) : null}

                <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-700 bg-slate-50/40 dark:bg-zinc-900/20 px-3 py-3 space-y-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {t('testModeTitle')}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t('testModeLead')}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={pilotSaving}
                  onClick={() => void savePilotRules()}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50"
                >
                  {pilotSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {t('saveRelances')}
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {t('loadRulesFailed')}
              </p>
            )}
        </div>
      </section>

      <BananoGhostAgentTokensSection />

      <TeamPageClient />

      <BananoStaffSettings onStaffAllowanceSettingsSaved={() => void loadBootstrap()} />

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wide">
          {t('sectionEliteRewardTitle')}
        </h3>
        <BananoEliteRewardSettings onSaved={() => void loadBootstrap()} />
      </section>

    </div>
  );
}
