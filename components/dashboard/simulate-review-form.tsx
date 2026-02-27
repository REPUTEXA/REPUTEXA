'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Send, Loader2 } from 'lucide-react';

export function SimulateReviewForm() {
  const t = useTranslations('Dashboard.form');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    reviewText: '',
    rating: 5,
    establishmentName: '',
    city: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/reviews/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      setForm({ reviewText: '', rating: 5, establishmentName: '', city: '' });
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-5"
    >
      <div className="flex min-w-[200px] flex-1 flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">{t('review')}</label>
        <input
          type="text"
          required
          value={form.reviewText}
          onChange={(e) => setForm({ ...form, reviewText: e.target.value })}
          placeholder={t('placeholder.review')}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="flex w-24 flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">{t('rating')}</label>
        <select
          value={form.rating}
          onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}/5
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[140px] flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">{t('establishment')}</label>
        <input
          type="text"
          required
          value={form.establishmentName}
          onChange={(e) => setForm({ ...form, establishmentName: e.target.value })}
          placeholder={t('placeholder.establishment')}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="flex min-w-[120px] flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">{t('city')}</label>
        <input
          type="text"
          required
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          placeholder={t('placeholder.city')}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {t('simulate')}
      </button>
    </form>
  );
}
