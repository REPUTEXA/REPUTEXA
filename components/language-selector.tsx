'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { ChevronDown, Globe } from 'lucide-react';

const LOCALES: { code: string; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
];

type Props = { variant?: 'dark' | 'light' };

export function LanguageSelector({ variant = 'dark' }: Props) {
  const locale = useLocale();
  const pathname = usePathname();
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setIsSignedIn(!!data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) =>
      setIsSignedIn(!!session)
    );
    return () => subscription.unsubscribe();
  }, []);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  const handleSelect = async (code: string) => {
    setOpen(false);
    if (code === locale) return;

    // Cookie pour next-intl (1 an)
    document.cookie = `NEXT_LOCALE=${code};path=/;max-age=${60 * 60 * 24 * 365};sameSite=lax`;

    // Mettre à jour User.preferredLanguage si connecté
    if (isSignedIn) {
      try {
        await fetch('/api/user/locale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: code }),
        });
      } catch {
        // ignore
      }
    }

    // Rediriger vers la nouvelle locale
    const path = pathname && pathname !== '/' ? pathname : '';
    window.location.href = `/${code}${path}`;
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          variant === 'light'
            ? 'border-gray-200 bg-white text-zinc-700 hover:border-gray-300 hover:bg-gray-50'
            : 'border-white/20 bg-slate-800 text-zinc-200 hover:border-white/30 hover:text-white'
        }`}
        aria-label="Choisir la langue"
        aria-expanded={open}
      >
        <Globe className="h-4 w-4" aria-hidden />
        <span>{current.flag}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div
          className={`absolute right-0 top-full z-50 mt-2 min-w-[160px] overflow-hidden rounded-xl border py-1 shadow-xl ${
            variant === 'light'
              ? 'border-gray-200 bg-white'
              : 'border-white/20 bg-slate-800'
          }`}
        >
          {LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => handleSelect(l.code)}
              className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition ${
                variant === 'light'
                  ? `hover:bg-gray-100 ${l.code === locale ? 'bg-gray-50 text-indigo-600' : 'text-zinc-700'}`
                  : `hover:bg-slate-700 ${l.code === locale ? 'bg-slate-700 text-indigo-400' : 'text-zinc-300'}`
              }`}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
