'use client';

import { useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';

/** Normalise le code OTP (6 chiffres uniquement) */
function normalizeOtp(raw: string): string {
  return String(raw)
    .replace(/[\s\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, '')
    .replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10))
    .replace(/\D/g, '')
    .slice(0, 6);
}

const LENGTH = 6;

export interface OtpInputHandle {
  focus: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
}

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  'data-testid'?: string;
  id?: string;
}

/**
 * Saisie OTP à 6 cases — auto-focus entre les cases, support du copier-coller.
 * Production-ready : UX type Stripe/Airbnb.
 */
export const OtpInput = forwardRef<OtpInputHandle, OtpInputProps>(function OtpInput(
  { value, onChange, disabled = false, autoFocus = true, id },
  ref
) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const digits = value.padEnd(LENGTH, ' ').split('').slice(0, LENGTH);

  const setDigits = useCallback(
    (newDigits: string[]) => {
      const joined = newDigits.join('').replace(/\s/g, '').slice(0, LENGTH);
      onChange(joined);
    },
    [onChange]
  );

  useImperativeHandle(ref, () => ({
    focus: () => inputRefs.current[0]?.focus(),
    getValue: () => value,
    setValue: (v: string) => onChange(normalizeOtp(v)),
  }));

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const next = [...digits];
      next[index - 1] = ' ';
      setDigits(next);
      return;
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
      return;
    }
    if (e.key === 'ArrowRight' && index < LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
      return;
    }
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const norm = normalizeOtp(raw);
    if (norm.length === LENGTH) {
      setDigits(norm.split(''));
      inputRefs.current[LENGTH - 1]?.focus();
      return;
    }
    const char = norm.slice(-1) || ' ';
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char !== ' ' && index < LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = normalizeOtp(e.clipboardData.getData('text'));
    if (pasted.length > 0) {
      const chars = pasted.split('').slice(0, LENGTH);
      const next = [' ', ' ', ' ', ' ', ' ', ' '];
      chars.forEach((c, i) => {
        next[i] = c;
      });
      setDigits(next);
      const focusIdx = Math.min(chars.length, LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
    }
  };

  return (
    <div
      className="flex gap-2 justify-center"
      onPaste={handlePaste}
      role="group"
      aria-label="Code de vérification à 6 chiffres"
    >
      {Array.from({ length: LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={digits[i] === ' ' ? '' : digits[i]}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={() => setFocusedIndex(i)}
          onBlur={() => setFocusedIndex(null)}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-mono font-bold rounded-xl border-2 bg-white text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[#2563eb] focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed ${focusedIndex === i ? 'border-[#2563eb]' : 'border-slate-200'}`}
          aria-label={`Chiffre ${i + 1}`}
          id={id ? `${id}-${i}` : undefined}
          data-testid={id ? `otp-${i}` : undefined}
        />
      ))}
    </div>
  );
});
