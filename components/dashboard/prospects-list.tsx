'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, X, Check, Sparkles } from 'lucide-react';

type Prospect = {
  id: string;
  establishmentName: string;
  city: string;
  category: string;
  rating: number;
  pitch: string | null;
  status: string;
};

export function ProspectsList({ prospects }: { prospects: Prospect[] }) {
  const t = useTranslations('Dashboard.prospects');
  const [selectedPitch, setSelectedPitch] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!selectedPitch) return;
    await navigator.clipboard.writeText(selectedPitch);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="divide-y divide-gray-100">
        {prospects.length === 0 ? (
          <div className="px-6 py-12 text-center text-zinc-500">
            {t('empty')}
          </div>
        ) : (
          prospects.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-zinc-900">{p.establishmentName}</p>
                <p className="text-sm text-zinc-500">
                  {p.category} • {p.city}
                </p>
                <p className="mt-1 text-sm text-blue-600">{p.rating}/5</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPitch(p.pitch ?? '')}
                className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
              >
                <Sparkles className="h-4 w-4" />
                {t('contact')}
              </button>
            </div>
          ))
        )}
      </div>

      {selectedPitch !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">
                {t('pitchTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedPitch(null)}
                className="rounded-lg p-1 text-zinc-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 rounded-lg bg-gray-50 p-4 text-sm text-zinc-700">
              {selectedPitch || t('noPitch')}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2 font-medium text-white transition hover:bg-blue-600"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  {t('copied')}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  {t('copyPitch')}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
