'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BookOpen, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';

type ForgeRow = {
  id: string;
  slug: string;
  status: string;
  week_monday: string;
  topic_meta: { domain?: string; angle?: string; sector?: string };
  verification: { verified?: boolean; notes?: string };
  source_fr: { title?: string; excerpt?: string };
};

export function AdminBlogForgePanel({ adminSecret }: { adminSecret: string }) {
  const t = useTranslations('Dashboard.adminBlogForge');
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<ForgeRow | null>(null);
  const [weekMonday, setWeekMonday] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/blog-forge', {
        headers: { 'x-admin-secret': adminSecret },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRow(null);
        return;
      }
      setWeekMonday(data.weekMonday ?? null);
      setRow(data.row ?? null);
    } finally {
      setLoading(false);
    }
  }, [adminSecret]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async () => {
    if (!weekMonday) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/blog-forge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({ action: 'approve', weekMonday }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        toast.error(t('error'));
        return;
      }
      toast.success(t('approved'));
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/35 bg-sky-950/40">
          <BookOpen className="h-5 w-5 text-sky-400/95" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">{t('sectionTitle')}</h2>
          <p className="mt-1 text-xs text-zinc-500 leading-relaxed">{t('sectionLead')}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-zinc-500 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('loading')}
        </p>
      ) : !row ? (
        <p className="text-xs text-zinc-500">{t('empty')}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span>
              {t('statusLabel')} :{' '}
              <span className="font-mono text-zinc-300">{row.status}</span>
            </span>
            <span>·</span>
            <span>
              {t('weekLabel')} : <span className="font-mono text-zinc-300">{row.week_monday}</span>
            </span>
          </div>

          {row.topic_meta?.domain ? (
            <p className="text-xs text-zinc-400 leading-relaxed">
              {t('topicLine', {
                domain: row.topic_meta.domain ?? '—',
                angle: row.topic_meta.angle ?? '—',
                sector: row.topic_meta.sector ?? '—',
              })}
            </p>
          ) : null}

          <div>
            <p className="text-[11px] font-medium text-zinc-500 mb-1">{t('titleLabel')}</p>
            <p className="text-sm text-zinc-200 leading-snug">{row.source_fr?.title ?? '—'}</p>
            {row.source_fr?.excerpt ? (
              <p className="mt-2 text-xs text-zinc-500 leading-relaxed line-clamp-4">{row.source_fr.excerpt}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2 text-xs">
            {row.verification?.verified ? (
              <span className="inline-flex items-center gap-1 text-emerald-400/95">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t('verifyOk')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-400/95">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('verifyWarn')}
              </span>
            )}
          </div>

          {row.status === 'draft_pending' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void approve()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('approve')}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
