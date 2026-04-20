'use client';

import { useMemo, type ComponentProps } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import PhoneInputLib from 'react-phone-number-input';
import { isValidPhoneNumber, type Country } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { getRegionCodeForSiteLocale } from '@/lib/i18n/locale-region';
import { getPhoneInputLabelsForLocale } from '@/lib/i18n/phone-input-labels';

/** HTML autocomplete value — module const avoids i18next/no-literal-string in JSX prop objects. */
const INPUT_AUTOCOMPLETE_OFF = 'off';

export { isValidPhoneNumber };

function getDefaultCountry(siteLocale: string): Country {
  return getRegionCodeForSiteLocale(siteLocale);
}

type Props = {
  value: string;
  onChange: (value: string | undefined) => void;
  id?: string;
  placeholder?: string;
  defaultCountry?: Country;
  /** Classes sur le conteneur racine (ex. w-full). */
  containerClassName?: string;
  /** Fusionné avec les props du `<input>` du numéro (défaut : pas d’autofill navigateur). */
  numberInputProps?: Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'id'>;
  /**
   * - `default` : bordure + fond adaptés light/dark (dashboard, signup).
   * - `light` : champ toujours « carte claire » (fond blanc, texte foncé).
   * - `onDark` : champ sur fond sombre / verre (ex. formulaire légal) — texte clair, pas de bandeau blanc.
   */
  surface?: 'default' | 'light' | 'onDark';
};

export function PhoneInput({
  value,
  onChange,
  id = 'phone',
  placeholder = '6 12 34 56 78',
  defaultCountry,
  containerClassName,
  numberInputProps,
  surface = 'default',
}: Props) {
  const t = useTranslations('Common.phone');
  const siteLocale = useLocale();
  const detectedCountry = useMemo(
    () => defaultCountry ?? getDefaultCountry(siteLocale),
    [defaultCountry, siteLocale]
  );
  /** Toujours un pays par défaut (locale ou prop) : indicatif + drapeau visibles dès le chargement, pas le mode « International » vide. */
  const labels = useMemo(() => getPhoneInputLabelsForLocale(siteLocale), [siteLocale]);
  const showError = value.trim().length > 0 && !isValidPhoneNumber(value);
  const light = surface === 'light';
  const onDark = surface === 'onDark';

  const shell = onDark
    ? showError
      ? 'border-red-400/55 focus-within:ring-2 focus-within:ring-red-500/35 focus-within:border-red-400/70 bg-white/5'
      : 'border-white/10 focus-within:ring-2 focus-within:ring-white/15 focus-within:border-white/25 bg-white/5'
    : light && showError
      ? 'border-red-300 focus-within:ring-2 focus-within:ring-red-500/30 focus-within:border-red-500 bg-white'
      : light && !showError
        ? 'border-slate-200 focus-within:ring-2 focus-within:ring-[#2563eb]/30 focus-within:border-primary bg-white'
        : showError
          ? 'border-red-300 dark:border-red-900 focus-within:ring-2 focus-within:ring-red-500/30 focus-within:border-red-500 dark:focus-within:border-red-600 bg-white dark:bg-zinc-800/50'
          : 'border-slate-200 dark:border-zinc-700 focus-within:ring-2 focus-within:ring-[#2563eb]/30 dark:focus-within:ring-indigo-500/30 focus-within:border-primary dark:focus-within:border-indigo-500 bg-white dark:bg-zinc-800/50';

  const inputColorClasses = onDark
    ? 'text-zinc-50 placeholder:text-zinc-400'
    : light
      ? 'text-slate-900 placeholder:text-slate-400'
      : 'text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500';

  const wrapperExtra = onDark ? 'rpn-on-dark-surface' : '';

  return (
    <div className={containerClassName ? `space-y-1 ${containerClassName}` : 'space-y-1'}>
      <div
        className={`rpn-phone-wrapper ${wrapperExtra} flex items-center rounded-xl border overflow-hidden transition-all duration-200 ${shell} [&_.PhoneInput]:!border-0 [&_.PhoneInput]:!p-0 [&_.PhoneInputInput]:!border-0 [&_.PhoneInputInput]:focus:!ring-0 [&_.PhoneInputInput]:!rounded-none`}
      >
        <PhoneInputLib
          international
          labels={labels}
          defaultCountry={detectedCountry}
          value={value || undefined}
          onChange={onChange}
          placeholder={placeholder}
          id={id}
          numberInputProps={{
            autoComplete: INPUT_AUTOCOMPLETE_OFF,
            ...numberInputProps,
            className: [
              'flex-1 min-w-0 min-h-[44px] px-4 py-2.5 bg-transparent border-none focus:outline-none focus:ring-0',
              inputColorClasses,
              numberInputProps?.className,
            ]
              .filter(Boolean)
              .join(' '),
          }}
        />
      </div>
      {showError && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {t('invalidForCountry')}
        </p>
      )}
    </div>
  );
}
