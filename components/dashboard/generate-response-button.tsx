'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Zap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  reviewId: string;
  className?: string;
  label?: string;
};

export function GenerateResponseButton({
  reviewId,
  className = '',
  label,
}: Props) {
  const router = useRouter();
  const t = useTranslations('Dashboard.reviewsPage');
  const resolvedLabel = label ?? t('generateResponse');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/generate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? t('errorGeneric'));
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={loading}
      className={`flex items-center gap-1.5 text-xs font-medium text-primary hover:brightness-110 disabled:opacity-60 ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('generating')}
        </>
      ) : (
        <>
          <Zap className="h-3.5 w-3.5" />
          {resolvedLabel}
        </>
      )}
    </button>
  );
}
