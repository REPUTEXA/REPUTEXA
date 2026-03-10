'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFormatter, useTranslations } from 'next-intl';

type Suggestion = {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
};

export default function SuggestionsPage() {
  const t = useTranslations('Suggestions');
  const format = useFormatter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/suggestions')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? t('list.loadError'));
        return data;
      })
      .then((data) => setSuggestions(data.suggestions ?? []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, [t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(t('form.titleRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('form.genericError'));
      toast.success(t('form.submitSuccess'));
      setTitle('');
      setDescription('');
      setSuggestions((prev) => [data.suggestion, ...prev]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('form.genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusLabel = (status: string) =>
    t(`list.status.${status}` as Parameters<typeof t>[0]);

  return (
    <div className="px-4 sm:px-6 py-6 space-y-8">
      <header>
        <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-100 tracking-tight">
          {t('page.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('page.intro')}
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 transition-colors duration-200">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
          <div>
            <label
              htmlFor="suggestion-title"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              {t('form.titleLabel')}
            </label>
            <input
              id="suggestion-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('form.placeholderTitle')}
              maxLength={200}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
            />
          </div>
          <div>
            <label
              htmlFor="suggestion-description"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              {t('form.descriptionLabel')}
            </label>
            <textarea
              id="suggestion-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('form.placeholderDescription')}
              rows={5}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none transition-all duration-200"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="py-3 px-6 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:pointer-events-none transition-all duration-300 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('form.submitting')}
              </>
            ) : (
              t('form.submitLabel')
            )}
          </button>
        </form>
      </section>

      {suggestions.length > 0 && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 transition-colors duration-200">
          <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-slate-100 mb-4">
            {t('list.title')}
          </h2>
          <ul className="space-y-3">
            {loading ? (
              <li className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('list.loading')}
              </li>
            ) : (
              suggestions.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {s.title}
                    </p>
                    {s.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {s.description}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {format.dateTime(new Date(s.created_at), {
                        dateStyle: 'long',
                      })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
                      s.status === 'DONE'
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                        : s.status === 'IN_PROGRESS'
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {getStatusLabel(s.status)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
