'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export function StaffMissionCompleteForm() {
  const t = useTranslations('Staff.missions');
  const [taskRef, setTaskRef] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ref = taskRef.trim();
    if (ref.length < 1) {
      toast.error(t('refRequired'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/staff/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskRef: ref, source: 'manual' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : t('completeError'));
        return;
      }
      toast.success(t('completeOk'));
      setTaskRef('');
    } catch {
      toast.error(t('completeError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3 max-w-md">
      <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">{t('refLabel')}</label>
      <input
        value={taskRef}
        onChange={(e) => setTaskRef(e.target.value)}
        className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm"
        placeholder={t('refPlaceholder')}
      />
      <button
        type="submit"
        disabled={loading}
        className="min-h-[44px] px-4 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-60"
      >
        {loading ? t('completeSubmitting') : t('completeCta')}
      </button>
    </form>
  );
}
