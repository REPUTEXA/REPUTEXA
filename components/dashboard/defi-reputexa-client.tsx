'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import {
  Trophy,
  Save,
  Loader2,
  Sparkles,
  Info,
  Archive,
  Users,
  Radio,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Link2,
  ListOrdered,
  X,
  Star,
} from 'lucide-react';
import { useActiveLocationOptional } from '@/lib/active-location-context';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/site-url';

type Campaign = {
  id?: string;
  title: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  competition_message: string;
  reward_description: string;
  tracked_employee_names: string[];
  team_share_token?: string | null;
};

type EnrichedDetail = {
  reviewId: string;
  rating: number;
  teamDelta: number;
  employeeDeltas: Record<string, number>;
  reasons: string[];
  reviewCreatedAt: string | null;
  reviewerDisplayName: string | null;
  commentPreview: string | null;
};

type EmployeeReviewHighlight = {
  reviewId: string;
  rating: number;
  delta: number;
  commentPreview: string | null;
  reviewCreatedAt: string | null;
  reviewerDisplayName: string | null;
  reasons: string[];
};

type ScorePayload = {
  totalPoints: number;
  leaderboard: { name: string; points: number }[];
  details: EnrichedDetail[];
  reviewsByEmployee: Record<string, EmployeeReviewHighlight[]>;
};

type ArchiveRow = {
  id: string;
  archived_at: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  competition_message: string;
  reward_description: string;
  bonus_keywords: string[] | null;
  tracked_employee_names: string[] | null;
  team_points: number;
  score_leaderboard: { name: string; points: number }[] | null;
  score_details: EnrichedDetail[] | null;
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(local: string): string | null {
  if (!local.trim()) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

type RuleTone = 'up' | 'mid' | 'down';

function ruleCardToneStyle(tone: RuleTone) {
  const stripe =
    tone === 'up'
      ? 'from-emerald-500 to-teal-600'
      : tone === 'mid'
        ? 'from-sky-500 to-blue-600'
        : 'from-rose-500 to-red-600';
  const badgeBg =
    tone === 'up'
      ? 'bg-emerald-500/[0.14] text-emerald-900 dark:text-emerald-100 border-emerald-500/35'
      : tone === 'mid'
        ? 'bg-sky-500/[0.14] text-sky-900 dark:text-sky-100 border-sky-500/35'
        : 'bg-rose-500/[0.14] text-rose-900 dark:text-rose-100 border-rose-500/35';
  return { stripe, badgeBg };
}

function ruleStarIconClass(tone: RuleTone, filled: boolean): string {
  if (!filled) {
    return 'fill-slate-200/50 text-slate-300 dark:fill-zinc-700 dark:text-zinc-600';
  }
  if (tone === 'down') {
    return 'fill-rose-500 text-rose-600 dark:fill-rose-400 dark:text-rose-300';
  }
  if (tone === 'mid') {
    return 'fill-sky-500 text-sky-600 dark:fill-sky-400 dark:text-sky-300';
  }
  return 'fill-emerald-500 text-emerald-600 dark:fill-emerald-400 dark:text-emerald-300';
}

function leaderboardMedalBorderClass(i: number): string {
  if (i === 0) return 'from-amber-400/30 to-amber-600/10 border-amber-500/40';
  if (i === 1) return 'from-slate-300/40 to-slate-400/10 border-slate-400/35';
  if (i === 2) return 'from-orange-400/25 to-orange-700/10 border-orange-500/35';
  return '';
}

function highlightEmployeeInText(text: string, employeeName: string) {
  if (!text?.trim() || !employeeName?.trim()) return text;
  const needle = employeeName.trim();
  const safe = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${safe})`, 'gi');
  const parts = text.split(re);
  return parts.map((part, i) =>
    part.toLowerCase() === needle.toLowerCase() ? (
      <mark
        key={i}
        className="rounded px-0.5 bg-amber-200/90 dark:bg-amber-500/35 text-inherit font-medium"
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function DefiReputexaClient() {
  const t = useTranslations('Dashboard.defiReputexa');
  const format = useFormatter();
  const formatArchiveDate = useCallback(
    (iso: string) => {
      try {
        return format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
      } catch {
        return iso;
      }
    },
    [format]
  );
  const defaultEmpty = useCallback((): Campaign => {
    return {
      title: t('defaultCampaignTitle'),
      is_active: false,
      starts_at: null,
      ends_at: null,
      competition_message: '',
      reward_description: '',
      tracked_employee_names: [],
    };
  }, [t]);

  const ruleRows = useMemo(
    () =>
      [
        {
          key: 'r5',
          tone: 'up' as const,
          badge: t('rule5Badge'),
          headline: t('rule5Headline'),
          body: t('rule5Text'),
          starFill: 5,
        },
        {
          key: 'r4',
          tone: 'mid' as const,
          badge: t('rule4Badge'),
          headline: t('rule4Headline'),
          body: t('rule4Text'),
          starFill: 4,
        },
        {
          key: 'rlo',
          tone: 'down' as const,
          badge: t('ruleLowBadge'),
          headline: t('ruleLowHeadline'),
          body: t('ruleLowText'),
          starFill: 2,
        },
      ] as const,
    [t]
  );
  const params = useParams();
  const locale = (params?.locale as string) || 'fr';
  const activeCtx = useActiveLocationOptional();
  const establishmentParam =
    activeCtx?.activeLocationId && activeCtx.activeLocationId !== 'profile'
      ? activeCtx.activeLocationId
      : 'profile';

  const [campaign, setCampaign] = useState<Campaign>(defaultEmpty);
  const [periodActive, setPeriodActive] = useState(false);
  const [score, setScore] = useState<ScorePayload | null>(null);
  const [archives, setArchives] = useState<ArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [namesInput, setNamesInput] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [flashDelta, setFlashDelta] = useState<Record<string, 'up' | 'down'>>({});
  const prevPointsRef = useRef<Map<string, number>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q =
        establishmentParam === 'profile'
          ? 'establishmentId=profile'
          : `establishmentId=${encodeURIComponent(establishmentParam)}`;
      const res = await fetch(`/api/reputexa-challenge?${q}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch');
      const data = (await res.json()) as {
        campaign: Campaign | null;
        periodActive: boolean;
        score: ScorePayload | null;
        archives?: ArchiveRow[];
      };
      const c = data.campaign;
      if (c) {
        const raw = c as Campaign & { bonus_keywords?: string[] | null };
        setCampaign({
          ...defaultEmpty(),
          ...raw,
          tracked_employee_names: raw.tracked_employee_names ?? [],
          team_share_token: raw.team_share_token ?? null,
        });
        setNamesInput((raw.tracked_employee_names ?? []).join(', '));
      } else {
        setCampaign(defaultEmpty());
        setNamesInput('');
      }
      setPeriodActive(data.periodActive);
      setScore(
        data.score
          ? { ...data.score, reviewsByEmployee: data.score.reviewsByEmployee ?? {} }
          : null
      );
      setArchives(Array.isArray(data.archives) ? data.archives : []);

      if (data.score?.leaderboard) {
        const next = new Map(data.score.leaderboard.map((r) => [r.name, r.points]));
        const flashes: Record<string, 'up' | 'down'> = {};
        for (const [name, pts] of Array.from(next.entries())) {
          const old = prevPointsRef.current.has(name) ? prevPointsRef.current.get(name)! : null;
          if (old !== null && pts > old) flashes[name] = 'up';
          if (old !== null && pts < old) flashes[name] = 'down';
        }
        prevPointsRef.current = next;
        if (Object.keys(flashes).length > 0) {
          setFlashDelta(flashes);
          window.setTimeout(() => setFlashDelta({}), 1600);
        }
      } else {
        prevPointsRef.current = new Map();
      }
    } catch {
      setToast(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [establishmentParam, t, defaultEmpty]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!campaign.starts_at || !campaign.ends_at) return;
    const poll = window.setInterval(() => {
      void load();
    }, 45_000);
    return () => clearInterval(poll);
  }, [campaign.starts_at, campaign.ends_at, load]);

  useEffect(() => {
    if (!campaign.starts_at || !campaign.ends_at) return;

    const supabase = createClient();
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      ch = supabase
        .channel(`defi-reputexa-reviews-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reviews',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            load();
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (ch) void supabase.removeChannel(ch);
    };
  }, [campaign.starts_at, campaign.ends_at, load]);

  useEffect(() => {
    if (!selectedEmployee) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedEmployee(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedEmployee]);

  const challengeEnded = useMemo(() => {
    if (!campaign.ends_at) return false;
    const end = new Date(campaign.ends_at).getTime();
    return !Number.isNaN(end) && end <= Date.now();
  }, [campaign.ends_at]);

  const challengeScheduled = useMemo(() => {
    if (!campaign.is_active || !campaign.starts_at || !campaign.ends_at) return false;
    const start = new Date(campaign.starts_at).getTime();
    return !Number.isNaN(start) && start > Date.now();
  }, [campaign.is_active, campaign.starts_at, campaign.ends_at]);

  const activityRows = useMemo(() => {
    if (!score?.details?.length) return [];
    const scored = score.details.filter((d) =>
      Object.values(d.employeeDeltas).some((v) => (v ?? 0) !== 0)
    );
    return [...scored]
      .sort((a, b) => {
        const ta = a.reviewCreatedAt ? new Date(a.reviewCreatedAt).getTime() : 0;
        const tb = b.reviewCreatedAt ? new Date(b.reviewCreatedAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 12);
  }, [score]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setToast(null);
    try {
      const tracked_employee_names = namesInput
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/reputexa-challenge', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: campaign.title,
          is_active: campaign.is_active,
          starts_at: campaign.starts_at,
          ends_at: campaign.ends_at,
          competition_message: campaign.competition_message,
          reward_description: campaign.reward_description,
          tracked_employee_names,
        }),
      });
      if (!res.ok) throw new Error('save');
      setToast(t('saveOk'));
      prevPointsRef.current = new Map();
      await load();
    } catch {
      setToast(t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!challengeEnded || !campaign.starts_at) return;
    setArchiving(true);
    setToast(null);
    try {
      const res = await fetch('/api/reputexa-challenge/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ establishmentId: establishmentParam }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? 'archive');
      }
      setToast(t('archiveOk'));
      prevPointsRef.current = new Map();
      await load();
    } catch {
      setToast(t('archiveError'));
    } finally {
      setArchiving(false);
    }
  }

  const hasTrackedEmployees =
    (campaign.tracked_employee_names?.length ?? 0) > 0 ||
    namesInput
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean).length > 0;

  const teamPublicUrl =
    campaign.team_share_token && typeof campaign.team_share_token === 'string'
      ? `${getSiteUrl().replace(/\/$/, '')}/${locale}/defi-reputexa/equipe/${campaign.team_share_token}`
      : null;

  async function copyTeamLink() {
    if (!teamPublicUrl) return;
    try {
      await navigator.clipboard.writeText(teamPublicUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setToast(t('saveError'));
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8 sm:space-y-10">
      <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950/90 px-5 py-6 sm:px-8 sm:py-8 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.07] via-transparent to-primary/[0.06] pointer-events-none" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200 mb-3">
              <Trophy className="w-3.5 h-3.5" aria-hidden />
              {t('badge')}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex flex-wrap items-center gap-2">
              {t('title')}
              <Sparkles className="w-6 h-6 text-amber-500 shrink-0" aria-hidden />
            </h1>
            <div className="mt-3 space-y-3 text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800/90 dark:text-amber-200/90 mb-1">
                  {t('introObjectiveLabel')}
                </p>
                <p>{t('introObjective')}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  {t('introMechanicsLabel')}
                </p>
                <p>{t('introMechanics')}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
            {periodActive && (
              <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 px-4 py-2 text-sm font-semibold border border-emerald-500/25 shadow-sm">
                <Radio className="w-4 h-4 animate-pulse text-emerald-600" aria-hidden />
                {t('liveBadge')}
              </span>
            )}
            {challengeScheduled && (
              <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500/12 text-amber-900 dark:text-amber-200 px-4 py-2 text-sm font-semibold border border-amber-500/30 shadow-sm">
                <Sparkles className="w-4 h-4" aria-hidden />
                {t('scheduledBadge')}
              </span>
            )}
            {challengeEnded && campaign.is_active && (
              <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-500/12 text-slate-800 dark:text-slate-200 px-4 py-2 text-sm font-semibold border border-slate-400/25 shadow-sm">
                <Trophy className="w-4 h-4 opacity-80" aria-hidden />
                {t('endedBannerTitle')}
              </span>
            )}
          </div>
        </div>
      </header>

      <details className="group rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 shadow-sm open:bg-white dark:open:bg-zinc-950/80 transition-colors">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-5 py-4 sm:px-6 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <span className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-primary shrink-0" aria-hidden />
            {t('journeyToggle')}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-500 transition group-open:rotate-180 shrink-0" aria-hidden />
        </summary>
        <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 space-y-5 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-200/80 dark:border-zinc-800">
          <div className="pt-4 space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-base">{t('journeyCompareTitle')}</p>
            <p className="leading-relaxed">{t('journeyCompareSubtitle')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('topHeroIntro')}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 items-start">
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950/40 p-4 sm:p-5 space-y-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('journeyStandardLabel')}</p>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-primary">{t('journeyStep1Title')}</h4>
                <p className="text-xs leading-relaxed">{t('journeyStep1Delay')}</p>
                <div className="rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/90 dark:bg-zinc-900/60 px-3 py-2.5 text-[13px] leading-relaxed text-slate-800 dark:text-slate-200">
                  {t('journeyStep1MsgStandard')}
                </div>
                <p className="text-xs">{t('journeyStep1BranchYes')}</p>
                <p className="text-xs">{t('journeyStep1BranchNo')}</p>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('journeyStep1Stop')}</p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-primary">{t('journeyStep2Title')}</h4>
                <p className="text-xs">{t('journeyStep2Context')}</p>
                <div className="rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/90 dark:bg-zinc-900/60 px-3 py-2.5 text-[13px] leading-relaxed text-slate-800 dark:text-slate-200">
                  {t('journeyStep2MsgStandard')}
                </div>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-primary">{t('journeyStep3Title')}</h4>
                <p className="text-xs italic">{t('journeyStep3Example')}</p>
                <p className="text-xs leading-relaxed">{t('journeyStep3Ai')}</p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-primary">{t('journeyStep4Title')}</h4>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  <li>{t('journeyStep4a')}</li>
                  <li>{t('journeyStep4b')}</li>
                  <li>{t('journeyStep4c')}</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-primary">{t('journeyStep5Title')}</h4>
                <div className="rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/90 dark:bg-zinc-900/60 px-3 py-2.5 text-[13px] leading-relaxed text-slate-800 dark:text-slate-200">
                  {t('journeyStep5Msg')}
                </div>
              </section>
            </div>

            <div className="rounded-2xl border-2 border-amber-400/35 dark:border-amber-500/30 bg-gradient-to-b from-amber-500/[0.06] to-transparent dark:from-amber-500/10 p-4 sm:p-5 space-y-4 shadow-sm ring-1 ring-amber-500/10">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5" aria-hidden />
                {t('journeyChallengeLabel')}
              </p>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100">{t('journeyStep1Title')}</h4>
                <p className="text-xs leading-relaxed">{t('journeyStep1Delay')}</p>
                <div className="rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-white/90 dark:bg-zinc-900/70 px-3 py-2.5 text-[13px] leading-relaxed text-slate-800 dark:text-slate-200">
                  {t('journeyStep1MsgChallenge')}
                </div>
                <p className="text-xs">{t('journeyStep1BranchYes')}</p>
                <p className="text-xs">{t('journeyStep1BranchNo')}</p>
                <p className="text-xs font-medium text-amber-950/90 dark:text-amber-50/90">{t('journeyStep1Stop')}</p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100">{t('journeyStep2Title')}</h4>
                <p className="text-xs">{t('journeyStep2Context')}</p>
                <div className="rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-white/90 dark:bg-zinc-900/70 px-3 py-2.5 text-[13px] leading-relaxed text-slate-800 dark:text-slate-200">
                  {t('journeyStep2MsgChallenge')}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">{t('journeyStep2Footer')}</p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100">{t('journeyStep3Title')}</h4>
                <p className="text-xs italic">{t('journeyStep3Example')}</p>
                <p className="text-xs leading-relaxed">{t('journeyStep3Ai')}</p>
                <p className="text-xs font-medium text-amber-900/80 dark:text-amber-200/90">{t('journeyStep3ChallengeNote')}</p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100">{t('journeyStep4Title')}</h4>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  <li>{t('journeyStep4a')}</li>
                  <li>{t('journeyStep4b')}</li>
                  <li>{t('journeyStep4c')}</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100">{t('journeyStep5Title')}</h4>
                <div className="rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-white/90 dark:bg-zinc-900/70 px-3 py-2.5 text-[13px] leading-relaxed text-slate-800 dark:text-slate-200">
                  {t('journeyStep5Msg')}
                </div>
              </section>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/80 dark:bg-zinc-900/40 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('journeyRecapTitle')}</p>
            <p className="text-xs sm:text-sm mt-1 leading-relaxed">{t('journeyRecapBody')}</p>
          </div>
        </div>
      </details>

      <section className="rounded-2xl border border-primary/20 dark:border-primary/15 bg-gradient-to-br from-primary/[0.07] to-transparent dark:from-primary/[0.1] p-5 sm:p-6 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary shrink-0" aria-hidden />
          {t('teamLinkTitle')}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{t('teamLinkIntro')}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('teamLinkScope')}</p>
        {teamPublicUrl ? (
          <div className="flex flex-col sm:flex-row sm:items-stretch gap-3">
            <code className="flex-1 min-h-[44px] flex items-center text-xs sm:text-sm break-all rounded-xl border border-white/60 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-slate-800 dark:text-slate-200 shadow-inner">
              {teamPublicUrl}
            </code>
            <button
              type="button"
              onClick={() => void copyTeamLink()}
              className="shrink-0 rounded-xl bg-primary text-white font-semibold px-5 py-2.5 text-sm hover:opacity-90 active:scale-[0.98] transition-transform"
            >
              {linkCopied ? t('teamLinkCopied') : t('teamLinkCopy')}
            </button>
          </div>
        ) : (
          <p className="text-sm rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-amber-900 dark:text-amber-200/95">
            {t('teamLinkPending')}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 p-5 sm:p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
          <Info className="w-5 h-5 text-primary shrink-0" aria-hidden />
          {t('rulesTitle')}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-5 max-w-2xl">
          {t('rulesSubtitle')}
        </p>
        <ul className="space-y-3" aria-label={t('rulesTitle')}>
          {ruleRows.map((row) => {
            const { stripe, badgeBg } = ruleCardToneStyle(row.tone);
            return (
              <li
                key={row.key}
                className="flex overflow-hidden rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 shadow-sm"
              >
                <div
                  className={`w-1.5 shrink-0 bg-gradient-to-b ${stripe}`}
                  aria-hidden
                />
                <div
                  className={`flex w-[5.25rem] shrink-0 flex-col items-center justify-center gap-1 border-r border-slate-200/80 dark:border-zinc-800 py-4 ${badgeBg}`}
                >
                  <span className="text-2xl font-black tabular-nums leading-none tracking-tight">{row.badge}</span>
                  <span className="mt-0.5 flex gap-0.5" aria-hidden>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 shrink-0 ${ruleStarIconClass(row.tone, i < row.starFill)}`}
                        strokeWidth={i < row.starFill ? 0 : 1.5}
                      />
                    ))}
                  </span>
                </div>
                <div className="min-w-0 flex-1 px-4 py-3.5 sm:px-5 sm:py-4">
                  <p className="font-semibold text-slate-900 dark:text-white">{row.headline}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{row.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin" aria-hidden />
          {t('loading')}
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">{t('configTitle')}</h2>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('fieldTitle')}</span>
              <input
                type="text"
                value={campaign.title}
                onChange={(e) => setCampaign((c) => ({ ...c, title: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
            </label>

            <div className="space-y-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={campaign.is_active}
                  onChange={(e) => setCampaign((c) => ({ ...c, is_active: e.target.checked }))}
                  className="rounded border-slate-300 w-4 h-4"
                />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{t('fieldActive')}</span>
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 pl-7 leading-relaxed">{t('fieldActiveHint')}</p>
            </div>

            {challengeScheduled && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
                {t('scheduledHint')}
              </div>
            )}

            {challengeEnded && campaign.is_active && (
              <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-100/80 dark:bg-zinc-900/60 px-4 py-3 space-y-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('endedBannerTitle')}</p>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{t('endedBannerBody')}</p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('fieldStart')}</span>
                <input
                  type="datetime-local"
                  value={toDatetimeLocal(campaign.starts_at)}
                  onChange={(e) =>
                    setCampaign((c) => ({ ...c, starts_at: fromDatetimeLocal(e.target.value) }))
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('fieldEnd')}</span>
                <input
                  type="datetime-local"
                  value={toDatetimeLocal(campaign.ends_at)}
                  onChange={(e) =>
                    setCampaign((c) => ({ ...c, ends_at: fromDatetimeLocal(e.target.value) }))
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('fieldCompetitionMessage')}</span>
              <textarea
                rows={4}
                value={campaign.competition_message}
                onChange={(e) => setCampaign((c) => ({ ...c, competition_message: e.target.value }))}
                placeholder={t('fieldCompetitionPlaceholder')}
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
              <p className="text-xs text-slate-500">{t('fieldCompetitionHint')}</p>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('fieldRewards')}</span>
              <textarea
                rows={3}
                value={campaign.reward_description}
                onChange={(e) => setCampaign((c) => ({ ...c, reward_description: e.target.value }))}
                placeholder={t('fieldRewardsPlaceholder')}
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('fieldNames')}</span>
              <input
                type="text"
                value={namesInput}
                onChange={(e) => setNamesInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                placeholder={t('fieldNamesPlaceholder')}
              />
              <p className="text-xs text-slate-500">{t('fieldNamesHint')}</p>
            </label>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-white font-semibold px-5 py-2.5 text-sm hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Save className="w-4 h-4" aria-hidden />}
              {t('save')}
            </button>

            {campaign.id && challengeEnded && campaign.starts_at && campaign.ends_at && (
              <button
                type="button"
                onClick={() => void handleArchive()}
                disabled={archiving}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900 text-slate-800 dark:text-slate-100 font-semibold px-5 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                {archiving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Archive className="w-4 h-4" aria-hidden />}
                {t('archiveButton')}
              </button>
            )}

            {toast && <span className="text-sm text-slate-600 dark:text-slate-400">{toast}</span>}
          </div>

          {challengeEnded && campaign.starts_at && (
            <p className="text-xs text-slate-500">{t('archiveHint')}</p>
          )}
        </form>
      )}

      {score && campaign.starts_at && campaign.ends_at && (
        <section className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 p-5 sm:p-8 shadow-md space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden />
                {t('leaderboardTitle')}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-lg leading-relaxed">
                {t('leaderboardSubtitle')}
              </p>
              <p className="text-xs text-slate-500 mt-2">{t('liveBoardHint')}</p>
            </div>
            {hasTrackedEmployees && (
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-gradient-to-br from-slate-50 to-white dark:from-zinc-900 dark:to-zinc-950 px-5 py-4 text-right shadow-sm shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('totalPointsLabel')}</p>
                <p className="text-3xl font-bold text-primary tabular-nums leading-tight">{score.totalPoints}</p>
                <p className="text-[11px] text-slate-500 mt-1">{t('totalPointsHint')}</p>
              </div>
            )}
          </div>

          {!hasTrackedEmployees ? (
            <p className="text-sm rounded-xl border border-dashed border-slate-300 dark:border-zinc-600 px-4 py-6 text-center text-slate-500">
              {t('emptyTracked')}
            </p>
          ) : score.leaderboard.length === 0 ? (
            <p className="text-sm text-slate-500">{t('leaderboardEmpty')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {score.leaderboard.map((row, i) => {
                const fl = flashDelta[row.name];
                const medal = leaderboardMedalBorderClass(i);
                return (
                  <button
                    key={row.name}
                    type="button"
                    onClick={() => setSelectedEmployee(row.name)}
                    aria-label={t('employeeReviewsTitle', { name: row.name })}
                    className={`rounded-2xl border px-4 py-3.5 flex items-center justify-between gap-3 transition-all duration-500 text-left w-full cursor-pointer hover:brightness-[0.98] dark:hover:brightness-110 focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 ${
                      fl === 'up'
                        ? 'border-emerald-400 ring-2 ring-emerald-400/20 bg-emerald-500/10 dark:bg-emerald-500/10'
                        : fl === 'down'
                          ? 'border-rose-400 ring-2 ring-rose-400/15 bg-rose-500/10'
                          : medal
                            ? `border bg-gradient-to-br ${medal}`
                            : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900/5 dark:bg-white/10 text-sm font-bold text-slate-800 dark:text-slate-100">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white truncate min-w-0">
                        {row.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {fl === 'up' && <TrendingUp className="w-5 h-5 text-emerald-500" aria-hidden />}
                      {fl === 'down' && <TrendingDown className="w-5 h-5 text-rose-500" aria-hidden />}
                      <span className="text-xl font-bold text-primary tabular-nums">{row.points}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {challengeEnded && hasTrackedEmployees && score.leaderboard.length > 0 && (
            <div className="rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/[0.07] via-transparent to-primary/[0.04] dark:from-amber-500/12 p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden />
                <h3 className="font-semibold text-slate-900 dark:text-white text-base">{t('rewardsAttributionTitle')}</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{t('rewardsAttributionIntro')}</p>
              <ol className="space-y-2 text-sm list-decimal list-inside text-slate-800 dark:text-slate-200">
                {score.leaderboard.map((row, idx) => (
                  <li key={row.name} className="leading-relaxed">
                    <span className="font-semibold tabular-nums text-primary">#{idx + 1}</span>{' '}
                    <span className="font-medium">{row.name}</span>
                    {t('sepDot')}
                    <span className="tabular-nums">
                      {row.points} {t('teamPtsShort')}
                    </span>
                  </li>
                ))}
              </ol>
              {campaign.reward_description?.trim() ? (
                <div className="rounded-xl border border-slate-200/80 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {t('rewardsPatronNoteLabel')}
                  </p>
                  <blockquote className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed border-l-2 border-amber-500/50 pl-3">
                    {campaign.reward_description.trim()}
                  </blockquote>
                </div>
              ) : (
                <p className="text-xs text-slate-500">{t('rewardsMissingNote')}</p>
              )}
              <p className="text-xs text-slate-500 leading-relaxed">{t('rewardsDisclaimer')}</p>
            </div>
          )}

          {activityRows.length > 0 && (
            <div className="rounded-2xl border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">{t('liveActivityTitle')}</p>
              <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {activityRows.map((d) => {
                  const empPart = Object.entries(d.employeeDeltas)
                    .filter(([, v]) => v !== 0)
                    .map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`)
                    .join(t('sepDot'));
                  return (
                    <li
                      key={d.reviewId}
                      className="text-sm rounded-xl border border-white/60 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 px-3 py-2.5 shadow-sm"
                    >
                      <span className="text-slate-500 text-xs">
                        {d.reviewCreatedAt ? formatArchiveDate(d.reviewCreatedAt) : t('dashEmpty')}
                        {t('sepDot')}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {t('reviewRatingLabel', { n: d.rating })}
                        </span>
                        {d.reviewerDisplayName ? (
                          <>
                            {t('sepDot')}
                            {d.reviewerDisplayName}
                          </>
                        ) : null}
                      </span>
                      <p className="text-slate-900 dark:text-slate-100 mt-1 font-medium">
                        {empPart || t('dashEmpty')}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {score.details.length > 0 && (
            <details className="group rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50/30 dark:bg-zinc-900/20 open:bg-white dark:open:bg-zinc-950/50">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-2 px-4 py-3.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
                {t('reviewDetailsTitle')}
                <ChevronDown className="w-4 h-4 shrink-0 transition group-open:rotate-180 text-slate-500" aria-hidden />
              </summary>
              <div className="px-4 pb-4 space-y-3 max-h-[28rem] overflow-y-auto border-t border-slate-200/80 dark:border-zinc-700">
                {[...score.details]
                  .sort((a, b) => {
                    const ta = a.reviewCreatedAt ? new Date(a.reviewCreatedAt).getTime() : 0;
                    const tb = b.reviewCreatedAt ? new Date(b.reviewCreatedAt).getTime() : 0;
                    return tb - ta;
                  })
                  .map((d) => (
                    <div
                      key={d.reviewId}
                      className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-3 text-sm space-y-2"
                    >
                      <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span className="font-mono text-[11px]">
                          {t('reviewIdPrefix', { prefix: d.reviewId.slice(0, 8) })}
                        </span>
                        {d.reviewCreatedAt && <span>{formatArchiveDate(d.reviewCreatedAt)}</span>}
                        <span>{t('reviewRatingLabel', { n: d.rating })}</span>
                        {d.reviewerDisplayName && <span>{d.reviewerDisplayName}</span>}
                      </div>
                      {d.commentPreview && (
                        <p className="text-slate-700 dark:text-slate-300 italic text-[13px] leading-relaxed">
                          &ldquo;{d.commentPreview}&rdquo;
                        </p>
                      )}
                      {Object.entries(d.employeeDeltas).some(([, v]) => v !== 0) && (
                        <p className="text-slate-600 dark:text-slate-400">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{t('reviewIndividualPts')}: </span>
                          {Object.entries(d.employeeDeltas)
                            .filter(([, v]) => v !== 0)
                            .map(([name, pts]) => (
                              <span key={name} className="mr-2 inline-block">
                                {name} {pts > 0 ? '+' : ''}
                                {pts}
                              </span>
                            ))}
                        </p>
                      )}
                      <ul className="text-xs text-slate-500 list-disc list-inside space-y-0.5">
                        {d.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            </details>
          )}
        </section>
      )}

      {archives.length > 0 && (
        <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 p-5 sm:p-6 shadow-sm space-y-3">
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Archive className="w-5 h-5 text-slate-500" aria-hidden />
            {t('archivesTitle')}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('archivesSubtitle')}</p>
          <div className="space-y-2">
            {archives.map((a) => (
              <details key={a.id} className="group rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/30">
                <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="font-medium text-slate-900 dark:text-white">
                    {t('archiveSummaryLine', {
                      title: a.title,
                      date: formatArchiveDate(a.archived_at),
                    })}
                  </span>
                  <span className="text-primary font-bold tabular-nums">
                    {a.team_points} {t('teamPtsShort')} ({t('archiveCumulative')})
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 transition group-open:rotate-180 ml-auto" aria-hidden />
                </summary>
                <div className="px-4 pb-4 pt-2 border-t border-slate-200 dark:border-zinc-700 space-y-3 text-sm">
                  {(a.starts_at || a.ends_at) && (
                    <p className="text-xs text-slate-500">
                      {t('periodFromTo', {
                        start: a.starts_at ? formatArchiveDate(a.starts_at) : t('dashEmpty'),
                        end: a.ends_at ? formatArchiveDate(a.ends_at) : t('dashEmpty'),
                      })}
                    </p>
                  )}
                  {(a.tracked_employee_names?.length ?? 0) > 0 && (
                    <p className="text-xs text-slate-600">
                      <span className="font-medium">{t('archiveEmployees')}:</span>{' '}
                      {(a.tracked_employee_names ?? []).join(', ')}
                    </p>
                  )}
                  <ol className="space-y-1">
                    {(a.score_leaderboard ?? []).map((row, i) => (
                      <li key={`${a.id}-${row.name}`} className="flex justify-between gap-2">
                        <span>
                          {i + 1}. {row.name}
                        </span>
                        <span className="font-semibold tabular-nums">{row.points}</span>
                      </li>
                    ))}
                  </ol>
                  {(a.score_details?.length ?? 0) > 0 && (
                    <details className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/40">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {t('reviewDetailsTitle')}
                      </summary>
                      <div className="px-3 pb-3 max-h-48 overflow-y-auto space-y-2 text-xs">
                        {(a.score_details ?? []).map((d) => (
                          <div key={d.reviewId} className="border-t border-slate-100 dark:border-zinc-800 pt-2 first:border-0 first:pt-0">
                            <p>
                              {d.reviewCreatedAt ? formatArchiveDate(d.reviewCreatedAt) : t('dashEmpty')}
                              {t('sepDot')}
                              {t('reviewRatingLabel', { n: d.rating })}
                            </p>
                            {Object.entries(d.employeeDeltas).some(([, v]) => v !== 0) && (
                              <p className="text-slate-600 mt-1">
                                {Object.entries(d.employeeDeltas)
                                  .filter(([, v]) => v !== 0)
                                  .map(([name, pts]) => `${name} ${pts > 0 ? '+' : ''}${pts}`)
                                  .join(t('sepDot'))}
                              </p>
                            )}
                            {d.commentPreview && <p className="italic text-slate-600">&ldquo;{d.commentPreview}&rdquo;</p>}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {selectedEmployee && score && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="employee-reviews-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
            aria-label={t('employeeReviewsClose')}
            onClick={() => setSelectedEmployee(null)}
          />
          <div className="relative w-full max-w-lg max-h-[min(85vh,36rem)] overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-xl flex flex-col">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-zinc-800 shrink-0">
              <div className="min-w-0">
                <h3 id="employee-reviews-title" className="font-semibold text-slate-900 dark:text-white truncate">
                  {t('employeeReviewsTitle', { name: selectedEmployee })}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{t('employeeReviewsSubtitle')}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 shrink-0"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 space-y-3 flex-1">
              {(score.reviewsByEmployee[selectedEmployee] ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">{t('employeeReviewsEmpty')}</p>
              ) : (
                (score.reviewsByEmployee[selectedEmployee] ?? []).map((r) => (
                  <div
                    key={r.reviewId}
                    className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/50 p-3 text-sm space-y-2"
                  >
                    <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                      {r.reviewCreatedAt && <span>{formatArchiveDate(r.reviewCreatedAt)}</span>}
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {t('reviewRatingLabel', { n: r.rating })}
                        {t('sepDot')}
                        {r.delta > 0 ? '+' : ''}
                        {r.delta} {t('teamPtsShort')}
                      </span>
                      {r.reviewerDisplayName && <span>{r.reviewerDisplayName}</span>}
                    </div>
                    {r.commentPreview && (
                      <p className="text-slate-800 dark:text-slate-200 text-[13px] leading-relaxed">
                        &ldquo;
                        {highlightEmployeeInText(r.commentPreview, selectedEmployee)}
                        &rdquo;
                      </p>
                    )}
                    <ul className="text-xs text-slate-500 list-disc list-inside space-y-0.5">
                      {r.reasons.map((reason, ri) => (
                        <li key={ri}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
