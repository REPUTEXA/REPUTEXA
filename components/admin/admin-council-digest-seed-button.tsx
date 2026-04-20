'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function AdminCouncilDigestSeedButton() {
  const t = useTranslations('Dashboard.adminCouncilDigestSeed');
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch('/api/admin/council-digest/refresh', { method: 'POST' });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`);
          }
          toast.success(t('toastSuccess'));
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : t('toastError'));
        } finally {
          setBusy(false);
        }
      }}
      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/15 disabled:opacity-50"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden />
      {busy ? t('btnBusy') : t('btnIdle')}
    </button>
  );
}
