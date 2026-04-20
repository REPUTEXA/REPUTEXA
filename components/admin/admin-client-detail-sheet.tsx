'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Loader2,
  Copy,
  Check,
  UserCircle,
  Search,
  Building2,
  ClipboardList,
  FileCheck,
  Wallet,
  AlertTriangle,
  Trash2,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { DateTimeFormatOptions } from 'use-intl';
import { MERCHANT_ERASURE_CONFIRM } from '@/lib/admin/merchant-hard-erasure';

const COMPLIANCE_PROOF_DATETIME: DateTimeFormatOptions = {
  dateStyle: 'short',
  timeStyle: 'short',
};

const CONSENT_ROW_DATETIME: DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
};

type ConsentRow = {
  id: string;
  created_at: string;
  consent_type: string;
  channel: string;
  message_preview: string | null;
  metadata: Record<string, unknown> | null;
};

type EstablishmentRow = Record<string, unknown>;

type AiBudgetPayload = {
  period_start: string;
  call_count: number;
  daily_soft_limit: number;
  daily_hard_limit: number;
  updated_at: string;
} | null;

type ClientDetailResponse = {
  profile: Record<string, unknown>;
  ai_budget?: AiBudgetPayload;
  auth_user: {
    email?: string;
    email_confirmed_at?: string;
    last_sign_in_at?: string;
    created_at?: string;
    phone?: string;
  } | null;
  consent_logs?: ConsentRow[];
  establishments?: EstablishmentRow[];
  error?: string;
};

function formatDetailValue(
  t: (key: string) => string,
  key: string,
  value: unknown,
): ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-zinc-600">{t('dashEmpty')}</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="text-zinc-300">{value ? t('boolYes') : t('boolNo')}</span>;
  }
  if (typeof value === 'number') {
    return <span className="font-mono text-zinc-300 tabular-nums">{String(value)}</span>;
  }
  if (typeof value === 'object') {
    return (
      <pre className="text-[11px] font-mono text-zinc-400 whitespace-pre-wrap break-all max-h-40 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/80 p-2">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  const s = String(value);
  const isSecret =
    /^(api_key|webhook_token|google_access_token|google_refresh_token)$/i.test(key) ||
    key.includes('secret');
  return (
    <span className={`text-xs break-all ${isSecret ? 'font-mono text-amber-200/90' : 'text-zinc-300'}`}>
      {s || t('dashEmpty')}
    </span>
  );
}

function CopyField({ value, copyTitle }: { value: string; copyTitle: string }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
      title={copyTitle}
    >
      {done ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function FieldRows({
  data,
  title,
  query,
  t,
  sortLocale,
}: {
  data: Record<string, unknown>;
  title: string;
  query: string;
  t: (key: string) => string;
  sortLocale: string;
}) {
  const entries = useMemo(() => {
    const base = Object.entries(data).sort(([a], [b]) => a.localeCompare(b, sortLocale));
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(([k, v]) => {
      const sv = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
      return k.toLowerCase().includes(q) || sv.toLowerCase().includes(q);
    });
  }, [data, query, sortLocale]);

  if (entries.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{title}</h3>
        <p className="text-xs text-zinc-600">{t('fieldRowsEmpty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{title}</h3>
      <dl className="space-y-2.5">
        {entries.map(([key, value]) => {
          const str =
            typeof value === 'object' && value !== null
              ? JSON.stringify(value)
              : value === null || value === undefined
                ? ''
                : String(value);
          const showCopy =
            str.length > 0 &&
            (key === 'api_key' ||
              key === 'webhook_token' ||
              key.includes('token') ||
              key.includes('secret') ||
              str.length > 80);
          return (
            <div key={key} className="border-b border-zinc-800/60 pb-2.5 last:border-0 last:pb-0">
              <dt className="text-[10px] font-mono text-zinc-500 mb-1">{key}</dt>
              <dd className="flex items-start gap-2 justify-between">
                <div className="min-w-0 flex-1">{formatDetailValue(t, key, value)}</div>
                {showCopy && str.length > 0 && <CopyField value={str} copyTitle={t('copyTitle')} />}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function matchesQuery(q: string, ...parts: (string | null | undefined)[]) {
  if (!q.trim()) return true;
  const low = q.trim().toLowerCase();
  return parts.some((p) => (p ?? '').toLowerCase().includes(low));
}

export function AdminClientDetailSheet({
  clientId,
  establishmentLabel,
  onClose,
}: {
  clientId: string | null;
  establishmentLabel?: string | null;
  onClose: () => void;
}) {
  const t = useTranslations('Dashboard.adminClientDetail');
  const format = useFormatter();
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ClientDetailResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [softLimitInput, setSoftLimitInput] = useState('400');
  const [hardLimitInput, setHardLimitInput] = useState('7000');
  const [savingBudget, setSavingBudget] = useState(false);
  const [erasePhrase, setErasePhrase] = useState('');
  const [erasing, setErasing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    setPayload(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, { credentials: 'same-origin' });
      const json = (await res.json()) as ClientDetailResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setPayload(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errLoad'));
    } finally {
      setLoading(false);
    }
  }, [clientId, t]);

  useEffect(() => {
    if (clientId) void load();
  }, [clientId, load]);

  const saveBudget = async () => {
    if (!clientId) return;
    const soft = parseInt(softLimitInput, 10);
    const hard = parseInt(hardLimitInput, 10);
    if (!Number.isFinite(soft) || !Number.isFinite(hard) || soft < 1 || hard < soft + 1) {
      toast.error(t('toastBudgetInvalid'));
      return;
    }
    setSavingBudget(true);
    try {
      const r = await fetch(`/api/admin/clients/${clientId}/ai-budget`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daily_soft_limit: soft, daily_hard_limit: hard }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? t('errGeneric'));
      toast.success(t('toastBudgetOk'));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setSavingBudget(false);
    }
  };

  const runHardErase = async () => {
    if (!clientId) return;
    setErasing(true);
    try {
      const r = await fetch(`/api/admin/clients/${clientId}/hard-erasure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: erasePhrase }),
      });
      const j = (await r.json()) as { error?: string; notes?: string[] };
      if (!r.ok) throw new Error(j.error ?? t('errGeneric'));
      toast.success(t('toastEraseOk'));
      setErasePhrase('');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setErasing(false);
    }
  };

  useEffect(() => {
    if (!clientId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [clientId, onClose]);

  useEffect(() => {
    if (!clientId) setSearchQuery('');
  }, [clientId]);

  useEffect(() => {
    const b = payload?.ai_budget;
    if (b && typeof b.daily_soft_limit === 'number' && typeof b.daily_hard_limit === 'number') {
      setSoftLimitInput(String(b.daily_soft_limit));
      setHardLimitInput(String(b.daily_hard_limit));
    }
  }, [payload?.ai_budget, clientId]);

  const q = searchQuery.trim().toLowerCase();

  const filteredEstablishments = useMemo(() => {
    const list = payload?.establishments ?? [];
    if (!q) return list;
    return list.filter((row) => {
      const name = String(row.name ?? '');
      const addr = String(row.address ?? '');
      const gl = String(row.google_location_name ?? '');
      return matchesQuery(searchQuery, name, addr, gl, String(row.id ?? ''));
    });
  }, [payload?.establishments, searchQuery, q]);

  const filteredConsentLogs = useMemo(() => {
    const list = payload?.consent_logs ?? [];
    if (!q) return list;
    return list.filter((row) =>
      matchesQuery(searchQuery, row.consent_type, row.channel, row.message_preview ?? '', row.id)
    );
  }, [payload?.consent_logs, searchQuery, q]);

  if (!clientId || !mounted) return null;

  const overlay = (
    <button
      type="button"
      aria-hidden
      className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    />
  );

  const panel = (
    <aside
      className="fixed inset-y-0 right-0 z-[10001] flex w-full max-w-lg flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl pt-[env(safe-area-inset-top)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-client-sheet-title"
    >
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3 flex-shrink-0">
        <div className="min-w-0 flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900">
            <UserCircle className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <h2 id="admin-client-sheet-title" className="text-sm font-semibold text-zinc-100 truncate pr-2">
              {t('sheetTitle')}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5 truncate">{establishmentLabel || t('dashEmpty')}</p>
            <p className="text-[10px] font-mono text-zinc-600 mt-1 break-all">{clientId}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          aria-label={t('closeAria')}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-4 py-2 border-b border-zinc-800 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('filterPlaceholder')}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-zinc-500">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
            <span className="text-sm">{t('loadingProfile')}</span>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        {!loading && !error && payload?.profile && (
          <div className="space-y-8">
            {(() => {
              const pfl = payload.profile as Record<string, unknown>;
              const full = String(pfl.full_name ?? '').trim();
              const parts = full.split(/\s+/).filter(Boolean);
              const hasSplitName = parts.length >= 2;
              const firstName = hasSplitName ? parts[0] : null;
              const lastName = hasSplitName ? parts.slice(1).join(' ') : null;
              const email =
                (payload.auth_user?.email as string | undefined)?.trim() ||
                (typeof pfl.email === 'string' ? pfl.email.trim() : '') ||
                '';
              const phone =
                (payload.auth_user?.phone as string | undefined)?.trim() ||
                (typeof pfl.phone === 'string' ? pfl.phone.trim() : '') ||
                '';
              const establishment = String(pfl.establishment_name ?? '').trim();
              const address = String(pfl.address ?? '').trim();
              const city = String(pfl.city ?? '').trim();
              const postal = String(pfl.postal_code ?? '').trim();
              const country = String(pfl.country ?? '').trim();
              const cityLine = [postal, city].filter(Boolean).join(' ');
              const addressBlock = [address, [cityLine, country].filter(Boolean).join(', ')].filter(Boolean);

              return (
                <div className="rounded-xl border border-blue-500/25 bg-blue-950/20 px-3 py-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <UserCircle className="w-4 h-4 text-blue-400" />
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-blue-200/90">
                      {t('identityTitle')}
                    </h3>
                  </div>
                  <dl className="space-y-2 text-xs">
                    {establishment ? (
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
                        <dt className="text-zinc-500 shrink-0">{t('establishment')}</dt>
                        <dd className="text-zinc-100 font-medium text-right sm:max-w-[65%] break-words">
                          {establishment}
                        </dd>
                      </div>
                    ) : null}
                    {full ? (
                      hasSplitName ? (
                        <>
                          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
                            <dt className="text-zinc-500">{t('firstName')}</dt>
                            <dd className="text-zinc-200 text-right">{firstName}</dd>
                          </div>
                          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
                            <dt className="text-zinc-500">{t('lastName')}</dt>
                            <dd className="text-zinc-200 text-right">{lastName}</dd>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
                          <dt className="text-zinc-500">{t('displayName')}</dt>
                          <dd className="text-zinc-200 text-right break-words">{full}</dd>
                        </div>
                      )
                    ) : null}
                    <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-start sm:gap-3 pt-1 border-t border-zinc-800/50">
                      <dt className="text-zinc-500 inline-flex items-center gap-1.5 shrink-0">
                        <Mail className="w-3 h-3 opacity-70" aria-hidden />
                        {t('email')}
                      </dt>
                      <dd className="flex items-center gap-1 justify-end min-w-0 sm:max-w-[70%]">
                        {email ? (
                          <>
                            <span className="font-mono text-[11px] text-zinc-200 break-all text-right">{email}</span>
                            <CopyField value={email} copyTitle={t('copyTitle')} />
                          </>
                        ) : (
                          <span className="text-zinc-600">{t('dashEmpty')}</span>
                        )}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-start sm:gap-3">
                      <dt className="text-zinc-500 inline-flex items-center gap-1.5 shrink-0">
                        <Phone className="w-3 h-3 opacity-70" aria-hidden />
                        {t('phone')}
                      </dt>
                      <dd className="flex items-center gap-1 justify-end min-w-0 sm:max-w-[70%]">
                        {phone ? (
                          <>
                            <span className="font-mono text-[11px] text-zinc-200 break-all text-right">{phone}</span>
                            <CopyField value={phone} copyTitle={t('copyTitle')} />
                          </>
                        ) : (
                          <span className="text-zinc-600">{t('dashEmpty')}</span>
                        )}
                      </dd>
                    </div>
                    {addressBlock.length > 0 ? (
                      <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-start sm:gap-3 pt-1 border-t border-zinc-800/50">
                        <dt className="text-zinc-500 inline-flex items-center gap-1.5 shrink-0">
                          <MapPin className="w-3 h-3 opacity-70" aria-hidden />
                          {t('address')}
                        </dt>
                        <dd className="text-zinc-300 text-right text-[11px] leading-relaxed sm:max-w-[70%] break-words">
                          {addressBlock.map((line, i) => (
                            <span key={i} className="block">
                              {line}
                            </span>
                          ))}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  <p className="text-[10px] text-zinc-600 leading-snug">{t('identityFootnote')}</p>
                </div>
              );
            })()}

            {(() => {
              const pfl = payload.profile as Record<string, unknown>;
              const lastVer = pfl.last_legal_agreement_version;
              const acceptedAt = pfl.legal_compliance_accepted_at;
              const acceptedVer = pfl.legal_compliance_accepted_legal_version;
              const complianceFlag = pfl.legal_compliance_accepted;
              const lastNum = typeof lastVer === 'number' ? lastVer : Number(lastVer);
              const accNum = typeof acceptedVer === 'number' ? acceptedVer : Number(acceptedVer);
              const hasAny =
                (Number.isFinite(lastNum) && lastNum > 0) ||
                acceptedAt != null ||
                (Number.isFinite(accNum) && accNum > 0) ||
                complianceFlag === true;
              if (!hasAny) return null;
              const atStr =
                typeof acceptedAt === 'string'
                  ? format.dateTime(new Date(acceptedAt), COMPLIANCE_PROOF_DATETIME)
                  : null;
              return (
                <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-3 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FileCheck className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/90">
                      {t('complianceTitle')}
                    </h3>
                  </div>
                  <dl className="space-y-1.5 text-xs text-zinc-300">
                    <div className="flex justify-between gap-2">
                      <dt className="text-zinc-500">{t('legalVersionKey')}</dt>
                      <dd className="font-mono tabular-nums">{String(lastVer ?? t('dashEmpty'))}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-zinc-500">{t('legalProofAt')}</dt>
                      <dd className="text-right">{atStr ?? t('dashEmpty')}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-zinc-500">{t('legalVersionAtProof')}</dt>
                      <dd className="font-mono tabular-nums">{String(acceptedVer ?? t('dashEmpty'))}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-zinc-500">{t('merchantFlag')}</dt>
                      <dd>
                        {complianceFlag === true ? (
                          <span className="text-emerald-400">{t('boolYes')}</span>
                        ) : complianceFlag === false ? (
                          <span className="text-zinc-500">{t('boolNo')}</span>
                        ) : (
                          t('dashEmpty')
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              );
            })()}

            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-3 py-3 space-y-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-400" />
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-200/90">
                  {t('aiBudgetTitle')}
                </h3>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                {t.rich('aiBudgetBody', {
                  soft: (chunks) => <code className="text-zinc-400">{chunks}</code>,
                  hard: (chunks) => <code className="text-zinc-400">{chunks}</code>,
                })}
              </p>
              {payload.ai_budget ? (
                <p className="text-[10px] font-mono text-zinc-500">
                  {t('aiBudgetLine', {
                    period: format.dateTime(new Date(payload.ai_budget.period_start), {
                      timeZone: 'UTC',
                      dateStyle: 'short',
                    }),
                    calls: payload.ai_budget.call_count,
                    soft: payload.ai_budget.daily_soft_limit,
                    hard: payload.ai_budget.daily_hard_limit,
                  })}
                </p>
              ) : (
                <p className="text-[10px] text-zinc-600">{t('aiBudgetNone')}</p>
              )}
              <div className="flex flex-wrap gap-2 items-end">
                <label className="flex flex-col gap-1 text-[10px] text-zinc-500">
                  {t('softPerDay')}
                  <input
                    type="number"
                    min={1}
                    value={softLimitInput}
                    onChange={(e) => setSoftLimitInput(e.target.value)}
                    className="w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] text-zinc-500">
                  {t('hardPerDay')}
                  <input
                    type="number"
                    min={2}
                    value={hardLimitInput}
                    onChange={(e) => setHardLimitInput(e.target.value)}
                    className="w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
                  />
                </label>
                <button
                  type="button"
                  disabled={savingBudget}
                  onClick={() => void saveBudget()}
                  className="rounded-lg bg-amber-600/80 hover:bg-amber-500/90 text-white text-[11px] font-semibold px-3 py-2 disabled:opacity-40"
                >
                  {savingBudget ? t('saving') : t('save')}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-red-500/35 bg-red-950/15 px-3 py-3 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-red-200/90">
                  {t('gdprTitle')}
                </h3>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">{t('gdprBody')}</p>
              <label className="flex flex-col gap-1 text-[10px] text-zinc-500">
                <span>
                  {t('erasePrompt')}{' '}
                  <span className="font-mono text-red-300/90">{MERCHANT_ERASURE_CONFIRM}</span>
                </span>
                <input
                  type="text"
                  value={erasePhrase}
                  onChange={(e) => setErasePhrase(e.target.value)}
                  placeholder={MERCHANT_ERASURE_CONFIRM}
                  autoComplete="off"
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 font-mono"
                />
              </label>
              <button
                type="button"
                disabled={
                  erasing ||
                  erasePhrase.trim().toUpperCase() !== MERCHANT_ERASURE_CONFIRM ||
                  (payload.profile as { role?: string }).role === 'admin'
                }
                onClick={() => void runHardErase()}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600/85 hover:bg-red-500 text-white text-[11px] font-semibold px-3 py-2 disabled:opacity-40"
              >
                {erasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {t('hardReset')}
              </button>
            </div>

            {(payload.establishments?.length ?? 0) > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-zinc-500" />
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    {t('establishmentsTitle', { count: payload.establishments!.length })}
                  </h3>
                </div>
                {filteredEstablishments.length === 0 ? (
                  <p className="text-xs text-zinc-600">{t('estEmptyFilter')}</p>
                ) : (
                  <ul className="space-y-2">
                    {filteredEstablishments.map((est) => (
                      <li
                        key={String(est.id)}
                        className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs"
                      >
                        <p className="font-medium text-zinc-200">{String(est.name || t('dashEmpty'))}</p>
                        {est.address ? (
                          <p className="text-zinc-500 mt-0.5 break-words">{String(est.address)}</p>
                        ) : null}
                        {est.google_location_name ? (
                          <p className="text-zinc-600 mt-0.5 truncate">{String(est.google_location_name)}</p>
                        ) : null}
                        <p className="text-[10px] font-mono text-zinc-600 mt-1">{String(est.id)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {(payload.consent_logs?.length ?? 0) > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList className="w-4 h-4 text-zinc-500" />
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    {t('consentTitle')}
                  </h3>
                </div>
                {filteredConsentLogs.length === 0 ? (
                  <p className="text-xs text-zinc-600">{t('consentEmptyFilter')}</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-zinc-800">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-500">
                          <th className="px-2 py-1.5 font-medium">{t('consentColDate')}</th>
                          <th className="px-2 py-1.5 font-medium">{t('consentColType')}</th>
                          <th className="px-2 py-1.5 font-medium">{t('consentColPreview')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredConsentLogs.map((row) => (
                          <tr key={row.id} className="border-b border-zinc-800/60 last:border-0">
                            <td className="px-2 py-1.5 text-zinc-400 whitespace-nowrap font-mono">
                              {format.dateTime(new Date(row.created_at), CONSENT_ROW_DATETIME)}
                            </td>
                            <td className="px-2 py-1.5 text-zinc-300">
                              {row.consent_type}
                              <span className="text-zinc-600"> · {row.channel}</span>
                            </td>
                            <td className="px-2 py-1.5 text-zinc-500 max-w-[140px] truncate" title={row.message_preview ?? ''}>
                              {row.message_preview || t('dashEmpty')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {payload.auth_user &&
              Object.values(payload.auth_user).some((v) => v != null && v !== '') && (
                <FieldRows
                  title={t('authBlockTitle')}
                  data={payload.auth_user as Record<string, unknown>}
                  query={searchQuery}
                  t={t}
                  sortLocale={locale}
                />
              )}

            <FieldRows
              title={t('profilesBlockTitle')}
              data={payload.profile}
              query={searchQuery}
              t={t}
              sortLocale={locale}
            />
          </div>
        )}
      </div>
    </aside>
  );

  return createPortal(
    <>
      {overlay}
      {panel}
    </>,
    document.body
  );
}
