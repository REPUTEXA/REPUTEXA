'use client';

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, Users, MessageCircle, Lightbulb, Flame, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

type Theme = {
  theme: string;
  title: string;
  count: number;
  sentiment: 'Positif' | 'Neutre' | 'Constructif';
  feedbackIds: string[];
  category: 'service' | 'cuisine' | 'lieu' | 'autre';
};

type GrowthStats = {
  sollicitations: number;
  optInCount: number;
  optInRate: number;
  privateFeedbacks: Array<{
    id: string;
    feedback_text: string;
    classification: string | null;
    created_at: string;
  }>;
  byClassification: Record<string, number>;
  themes: Theme[];
  priorityAdvice: string | null;
  hasZenith: boolean;
};

const CLASS_LABELS: Record<string, string> = {
  service: 'Service',
  qualite_nourriture: 'Qualité nourriture',
  ambiance: 'Ambiance',
  rapport_qualite_prix: 'Rapport qualité-prix',
  attente: 'Attente',
  hygiene: 'Hygiène',
  autre: 'Autre',
};

const CATEGORY_STYLES: Record<string, string> = {
  service: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 dark:border-indigo-400/20',
  cuisine: 'bg-orange-500/10 text-orange-400 border-orange-500/30 dark:border-orange-400/20',
  lieu: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 dark:border-emerald-400/20',
  autre: 'bg-slate-500/10 text-slate-400 border-slate-500/30 dark:border-slate-400/20',
};

const SENTIMENT_STYLES: Record<string, string> = {
  Positif: 'bg-emerald-500/10 text-emerald-400',
  Neutre: 'bg-slate-500/10 text-slate-400',
  Constructif: 'bg-amber-500/10 text-amber-400',
};

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function GrowthPage() {
  const t = useTranslations('Growth');
  const [stats, setStats] = useState<GrowthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    fetch('/api/zenith-capture/growth-stats')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? t('error'));
        return data;
      })
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [t]);

  const handleMarkResolved = async (feedbackIds: string[]) => {
    if (feedbackIds.length === 0) return;
    setResolving(feedbackIds[0]);
    try {
      const res = await fetch('/api/suggestions/private-feedback/resolve-bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: feedbackIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erreur');
      toast.success('Marqué comme traité');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setResolving(null);
    }
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 md:px-8 py-6 space-y-8 max-w-[1600px] mx-auto">
        <div className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-skeleton" />
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800/50 animate-skeleton" />
          ))}
        </section>
        <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800/50 animate-skeleton" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <p className="text-slate-500 dark:text-slate-400">{t('error')}</p>
      </div>
    );
  }

  const { sollicitations, optInCount, optInRate, privateFeedbacks, byClassification, themes, priorityAdvice } = stats;

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-50 tracking-tight">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('intro')}
        </p>
      </header>

      {priorityAdvice && (
        <section className="rounded-2xl border border-amber-500/30 dark:border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5 dark:from-amber-500/5 dark:to-orange-500/5 p-6 transition-colors duration-200 shadow-[4px_6px_0_rgba(0,0,0,0.04)] dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400 mb-3">
            <Sparkles className="w-5 h-5" />
            <span className="font-semibold text-sm uppercase tracking-wide">Conseil stratégique IA</span>
          </div>
          <p className="text-slate-800 dark:text-slate-200 font-medium">
            Action prioritaire : {priorityAdvice}
          </p>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] bg-white dark:bg-slate-900/95 p-5 shadow-[4px_6px_0_rgba(0,0,0,0.04)] dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] transition-colors duration-200">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">{t('stats.sollicitations')}</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{sollicitations}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] bg-white dark:bg-slate-900/95 p-5 shadow-[4px_6px_0_rgba(0,0,0,0.04)] dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] transition-colors duration-200">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">{t('stats.optIn')}</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{optInCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] bg-white dark:bg-slate-900/95 p-5 shadow-[4px_6px_0_rgba(0,0,0,0.04)] dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] transition-colors duration-200">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
            <MessageCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{t('stats.optInRate')}</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{optInRate}%</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] bg-white dark:bg-slate-900/95 shadow-[4px_6px_0_rgba(0,0,0,0.04)] dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] overflow-hidden transition-colors duration-200">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <Flame className="w-5 h-5 text-amber-500" />
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Top des retours clients</h2>
        </div>
        <div className="p-6">
          {themes && themes.length > 0 ? (
            <div className="space-y-4">
              {themes.map((theme) => (
                <div
                  key={theme.theme}
                  className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 transition-colors duration-200 hover:border-slate-200 dark:hover:border-slate-700 shadow-[4px_6px_0_rgba(0,0,0,0.04)] dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{theme.title}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Demandé par {theme.count} client{theme.count > 1 ? 's' : ''} ce mois-ci
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${CATEGORY_STYLES[theme.category] ?? CATEGORY_STYLES.autre}`}
                        >
                          {theme.category === 'service' && 'Service'}
                          {theme.category === 'cuisine' && 'Cuisine'}
                          {theme.category === 'lieu' && 'Lieu'}
                          {theme.category === 'autre' && 'Autre'}
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium ${SENTIMENT_STYLES[theme.sentiment] ?? SENTIMENT_STYLES.Neutre}`}
                        >
                          {theme.sentiment}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleMarkResolved(theme.feedbackIds)}
                      disabled={!!resolving}
                      className="shrink-0 inline-flex items-center justify-center min-h-[44px] gap-2 px-4 py-2 rounded-2xl text-sm font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 active:scale-[0.98] transition-transform"
                    >
                      {resolving === theme.feedbackIds[0] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Marquer comme traité
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {Object.keys(byClassification).length > 0 && (
                <div className="mb-6 flex flex-wrap gap-2">
                  {Object.entries(byClassification).map(([k, v]) => (
                    <span
                      key={k}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      {CLASS_LABELS[k] ?? k} : {v}
                    </span>
                  ))}
                </div>
              )}
              {privateFeedbacks.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('suggestions.empty')}</p>
              ) : (
                <ul className="space-y-4">
                  {privateFeedbacks.map((f) => (
                    <li
                      key={f.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                    >
                      <p className="text-sm text-slate-800 dark:text-slate-200">{f.feedback_text}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{formatDate(f.created_at)}</span>
                        {f.classification && (
                          <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700">
                            {CLASS_LABELS[f.classification] ?? f.classification}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
