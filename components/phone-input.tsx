'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import PhoneInputLib from 'react-phone-number-input';
import { isValidPhoneNumber, type Country } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

export { isValidPhoneNumber };

const LOCALE_TO_COUNTRY: Record<string, Country> = {
  fr: 'FR',
  it: 'IT',
  es: 'ES',
  de: 'DE',
  en: 'GB',
};

function getDefaultCountry(siteLocale: string): Country {
  const fromSite = LOCALE_TO_COUNTRY[siteLocale.toLowerCase()];
  if (fromSite) return fromSite;
  if (typeof navigator !== 'undefined' && navigator.language) {
    const nav = navigator.language;
    const part = nav.split('-')[1]?.toUpperCase();
    if (part && part.length === 2) return part as Country;
  }
  return 'FR';
}

type Props = {
  value: string;
  onChange: (value: string | undefined) => void;
  id?: string;
  placeholder?: string;
  defaultCountry?: Country;
};

export function PhoneInput({
  value,
  onChange,
  id = 'phone',
  placeholder = '6 12 34 56 78',
  defaultCountry,
}: Props) {
  const siteLocale = useLocale();
  const detectedCountry = useMemo(
    () => defaultCountry ?? getDefaultCountry(siteLocale),
    [defaultCountry, siteLocale]
  );
  const showError = value.trim().length > 0 && !isValidPhoneNumber(value);

  return (
    <div className="space-y-1">
      <div
        className={`rpn-phone-wrapper flex items-center rounded-xl border overflow-hidden transition-all duration-200 ${
          showError
            ? 'border-red-300 dark:border-red-900 focus-within:ring-2 focus-within:ring-red-500/30 focus-within:border-red-500 dark:focus-within:border-red-600 bg-white dark:bg-zinc-800/50'
            : 'border-slate-200 dark:border-zinc-700 focus-within:ring-2 focus-within:ring-[#2563eb]/30 dark:focus-within:ring-indigo-500/30 focus-within:border-primary dark:focus-within:border-indigo-500 bg-white dark:bg-zinc-800/50'
        } [&_.PhoneInput]:!border-0 [&_.PhoneInput]:!p-0 [&_.PhoneInputInput]:!border-0 [&_.PhoneInputInput]:focus:!ring-0 [&_.PhoneInputInput]:!rounded-none`}
      >
        <PhoneInputLib
          international
          defaultCountry={detectedCountry}
          value={value || undefined}
          onChange={onChange}
          placeholder={placeholder}
          id={id}
          numberInputProps={{
            className: 'flex-1 min-w-0 px-4 py-2.5 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 bg-transparent border-none focus:outline-none focus:ring-0',
          }}
        />
      </div>
      {showError && (
        <p className="text-xs text-red-600" role="alert">
          Numéro invalide pour ce pays.
        </p>
      )}
    </div>
  );
}
