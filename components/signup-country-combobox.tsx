'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getCountryDisplayName, getSortedSignupCountryOptions } from '@/lib/i18n/locale-region';

export function SignupCountryCombobox({
  id,
  locale,
  value,
  onChange,
  describedById,
}: {
  id: string;
  locale: string;
  value: string;
  onChange: (code: string) => void;
  describedById?: string;
}) {
  const t = useTranslations('Common.signupCountry');
  const options = useMemo(() => getSortedSignupCountryOptions(locale), [locale]);
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  /** Chrome propose sinon un menu d’adresses enregistrées par-dessus la liste personnalisée. */
  const [browserAutofillGuard, setBrowserAutofillGuard] = useState(true);

  const displayLabel = getCountryDisplayName(locale, value);

  useEffect(() => {
    if (!open) {
      setSearch(displayLabel);
    }
  }, [open, displayLabel]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q) ||
        `${o.label} ${o.code}`.toLowerCase().includes(q)
    );
  }, [options, search]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  function pick(code: string) {
    onChange(code);
    setOpen(false);
  }

  function handleFocus() {
    setBrowserAutofillGuard(false);
    setOpen(true);
    setSearch('');
  }

  function handleBlur() {
    window.setTimeout(() => setOpen(false), 120);
  }

  const listId = `${id}-listbox`;

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        name={`reputexa-country-q-${id.replace(/[^a-z0-9-]/gi, '-')}`}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-describedby={describedById}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore
        data-bwignore
        data-form-type="other"
        readOnly={browserAutofillGuard}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={displayLabel}
        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-primary transition-all duration-200 dark:bg-white"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500">{t('noMatch')}</li>
          ) : (
            filtered.map((o) => (
              <li key={o.code} role="option" aria-selected={o.code === value}>
                <button
                  type="button"
                  className="w-full text-left px-4 py-2 text-sm text-slate-900 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(o.code);
                  }}
                >
                  <span className="font-medium">{o.label}</span>
                  <span className="text-slate-400 tabular-nums ml-2">{o.code}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
