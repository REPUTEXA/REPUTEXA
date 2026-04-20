'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useFormatter, useTranslations } from 'next-intl';
import type { DateTimeFormatOptions } from 'use-intl';

export type GuardianDraftListItem = {
  id: string;
  document_type: string;
  summary_of_changes: string;
  created_at: string;
  admin_verified_at: string | null;
};

const DRAFT_DATETIME: DateTimeFormatOptions = {
  dateStyle: 'short',
  timeStyle: 'medium',
};

export function ComplianceGuardianDraftRow({ draft }: { draft: GuardianDraftListItem }) {
  const router = useRouter();
  const t = useTranslations('Admin.codeGuardian');
  const format = useFormatter();
  const [busy, setBusy] = useState(false);

  async function patch(action: 'verify' | 'dismiss') {
    if (action === 'dismiss' && !confirm(t('draftDismissConfirm'))) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/legal/guardian-draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_id: draft.id, action }),
        credentials: 'include',
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          typeof (j as { error?: string }).error === 'string' ? (j as { error: string }).error : t('draftServerError')
        );
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const verifiedDate =
    draft.admin_verified_at != null
      ? format.dateTime(new Date(draft.admin_verified_at), DRAFT_DATETIME)
      : null;

  return (
    <div className="px-5 py-4">
      <p className="text-xs font-mono text-amber-200/90">
        {String(draft.document_type)} — {String(draft.id).slice(0, 8)}…
      </p>
      <p className="text-sm text-zinc-400 mt-1">{String(draft.summary_of_changes ?? '').slice(0, 280)}</p>
      <p className="text-[11px] text-zinc-600 mt-2">
        {format.dateTime(new Date(String(draft.created_at)), DRAFT_DATETIME)}
      </p>
      {draft.admin_verified_at ? (
        <p className="mt-3 text-xs font-medium text-emerald-400/95">
          {t('draftVerifiedLine', { date: verifiedDate ?? '' })}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void patch('verify')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            {t('draftVerifyLabel')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void patch('dismiss')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
            {t('draftDismiss')}
          </button>
        </div>
      )}
    </div>
  );
}
