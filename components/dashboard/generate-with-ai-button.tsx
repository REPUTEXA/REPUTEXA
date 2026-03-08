'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import { DemoDashboard } from '@/components/demo-dashboard';

type Props = {
  reviewId: string;
  reviewText: string;
  reviewerName: string;
  rating: number;
  className?: string;
  label?: string;
};

export function GenerateWithAIButton({
  reviewId,
  reviewText,
  reviewerName,
  rating,
  className = '',
  label = 'Générer avec l\'IA',
}: Props) {
  const [open, setOpen] = useState(false);
  void [reviewId, reviewText, reviewerName, rating]; // Reserved for future per-review generation

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors ${className}`}
      >
        <Zap className="h-3.5 w-3.5" />
        {label}
      </button>
      {open && <DemoDashboard onClose={() => setOpen(false)} />}
    </>
  );
}
