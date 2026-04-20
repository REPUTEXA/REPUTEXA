'use client';

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
} from 'react';

const SHOW_DELAY_MS = 400;
const HIDE_DELAY_MS = 80;

type Side = 'top' | 'bottom';

type Props = {
  /** Localized string from next-intl (never hardcoded in JSX). */
  label: string;
  children: ReactElement<{ 'aria-describedby'?: string }>;
  side?: Side;
  /** Extra classes on the wrapper (e.g. block width for badges). */
  className?: string;
};

export function HoverTooltip({ label, children, side = 'bottom', className = '' }: Props) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearShow = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    showTimer.current = null;
  }, []);

  const clearHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }, []);

  const scheduleShow = useCallback(() => {
    clearHide();
    clearShow();
    showTimer.current = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
  }, [clearHide, clearShow]);

  const scheduleHide = useCallback(() => {
    clearShow();
    clearHide();
    hideTimer.current = setTimeout(() => setOpen(false), HIDE_DELAY_MS);
  }, [clearShow, clearHide]);

  useEffect(() => {
    return () => {
      clearShow();
      clearHide();
    };
  }, [clearShow, clearHide]);

  const positionClass =
    side === 'bottom'
      ? 'left-1/2 top-full z-[200] mt-2 -translate-x-1/2'
      : 'left-1/2 bottom-full z-[200] mb-2 -translate-x-1/2';

  const describedBy = open ? tooltipId : undefined;
  const child = isValidElement(children)
    ? cloneElement(children, { 'aria-describedby': describedBy })
    : children;

  return (
    <span
      className={`relative inline-flex max-w-full ${className}`.trim()}
      onPointerEnter={scheduleShow}
      onPointerLeave={scheduleHide}
      onFocusCapture={scheduleShow}
      onBlurCapture={scheduleHide}
    >
      {child}
      {open && label.trim().length > 0 && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`pointer-events-none absolute ${positionClass} max-w-[min(20rem,calc(100vw-1.5rem))] rounded-lg bg-zinc-800 px-3 py-2 text-left text-xs font-normal leading-snug text-zinc-50 shadow-xl ring-1 ring-black/20 dark:bg-zinc-700 dark:text-zinc-50`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
