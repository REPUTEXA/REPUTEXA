'use client';

import { useTranslations } from 'next-intl';
import { MessageCircle } from 'lucide-react';

type Props = {
  rating: string | number;
  className?: string;
  children?: React.ReactNode;
};

export function WhatsAppShareButton({ rating, className = '', children }: Props) {
  const t = useTranslations('Share');
  const message = t('whatsappMessage', { rating: String(rating) });
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label="Share on WhatsApp"
    >
      {children ?? (
        <span className="inline-flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          {t('shareOnWhatsApp')}
        </span>
      )}
    </a>
  );
}
