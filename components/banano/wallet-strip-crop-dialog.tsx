'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import type { WalletStripCrop } from '@/lib/wallet/wallet-strip-crop';
import { clampWalletStripCrop } from '@/lib/wallet/wallet-strip-crop';

type WalletStripCropDialogProps = {
  open: boolean;
  onClose: () => void;
  value: WalletStripCrop;
  onApply: (v: WalletStripCrop) => void;
  onResetToArchetype?: () => void;
  canResetArchetype: boolean;
};

export function WalletStripCropDialog({
  open,
  onClose,
  value,
  onApply,
  onResetToArchetype,
  canResetArchetype,
}: WalletStripCropDialogProps) {
  const t = useTranslations('Dashboard.bananoWalletDesigner');
  const [draft, setDraft] = useState<WalletStripCrop>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-strip-crop-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-600 bg-zinc-950 shadow-2xl p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="wallet-strip-crop-title" className="text-base font-bold text-zinc-100">
              {t('stripCropTitle')}
            </h2>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{t('stripCropLead')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
            aria-label={t('stripCropCancel')}
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <label className="block text-xs text-zinc-400">
          <span className="font-medium text-zinc-300">{t('stripCropFocalX')}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(draft.focalX * 100)}
            onChange={(e) =>
              setDraft((d) => clampWalletStripCrop({ ...d, focalX: Number(e.target.value) / 100 }))
            }
            className="mt-2 w-full accent-[#BF174C]"
          />
        </label>

        <label className="block text-xs text-zinc-400">
          <span className="font-medium text-zinc-300">{t('stripCropFocalY')}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(draft.focalY * 100)}
            onChange={(e) =>
              setDraft((d) => clampWalletStripCrop({ ...d, focalY: Number(e.target.value) / 100 }))
            }
            className="mt-2 w-full accent-[#BF174C]"
          />
        </label>

        <label className="block text-xs text-zinc-400">
          <span className="font-medium text-zinc-300">{t('stripCropZoom')}</span>
          <input
            type="range"
            min={100}
            max={200}
            value={Math.round(draft.zoom * 100)}
            onChange={(e) =>
              setDraft((d) => clampWalletStripCrop({ ...d, zoom: Number(e.target.value) / 100 }))
            }
            className="mt-2 w-full accent-[#BF174C]"
          />
        </label>

        {canResetArchetype && onResetToArchetype ? (
          <button
            type="button"
            onClick={() => {
              onResetToArchetype();
              onClose();
            }}
            className="text-xs font-medium text-amber-500/95 hover:text-amber-400 underline underline-offset-2"
          >
            {t('stripCropResetArchetype')}
          </button>
        ) : null}

        <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl border border-zinc-600 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            {t('stripCropCancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(clampWalletStripCrop(draft));
              onClose();
            }}
            className="min-h-[44px] px-4 rounded-xl bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8]"
          >
            {t('stripCropApply')}
          </button>
        </div>
      </div>
    </div>
  );
}
