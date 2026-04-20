'use client';

export type WhatsAppBubbleProps = {
  message: string;
  chatTitle: string;
  locale: string;
  className?: string;
};

/**
 * Aperçu visuel type bulle WhatsApp (paramètres relances / automatisations).
 */
export function WhatsAppBubble({
  message,
  chatTitle,
  locale,
  className = '',
}: WhatsAppBubbleProps) {
  const intlLocale = locale === 'en' ? 'en-GB' : locale || 'fr';
  const time = new Intl.DateTimeFormat(intlLocale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
  const body = message.trim();

  return (
    <div
      className={`mx-auto w-full max-w-[min(100%,320px)] rounded-2xl border border-slate-200/80 dark:border-zinc-700/90 bg-[#ece5dd] dark:bg-[#0b141a] shadow-md overflow-hidden ${className}`}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-[#075e54] dark:bg-[#202c33] border-b border-black/10">
        <div
          className="h-9 w-9 rounded-full bg-white/20 shrink-0"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{chatTitle}</p>
          <p className="text-[10px] text-white/70">WhatsApp</p>
        </div>
      </div>
      <div className="px-2 py-3 min-h-[100px] bg-[#e5ddd5] dark:bg-[#0b141a]">
        <div className="ml-auto max-w-[92%] rounded-lg rounded-br-sm bg-[#dcf8c6] dark:bg-[#005c4b] px-2.5 py-1.5 shadow-sm border border-black/5 dark:border-white/5">
          <p className="text-[13px] text-zinc-900 dark:text-zinc-50 whitespace-pre-wrap break-words leading-snug">
            {body}
          </p>
          <p className="text-[10px] text-zinc-600 dark:text-emerald-100/75 text-right mt-0.5 tabular-nums">
            {time}
          </p>
        </div>
      </div>
    </div>
  );
}
