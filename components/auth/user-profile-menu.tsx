'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Link } from '@/i18n/navigation';
import { Settings, LogOut, ChevronDown } from 'lucide-react';

const DEFAULT_AVATAR = 'https://www.gravatar.com/avatar?d=mp&s=96';

type Variant = 'light' | 'dark';

type Props = {
  variant?: Variant;
};

export function UserProfileMenu({ variant = 'light' }: Props) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  const isDark = variant === 'dark';
  const btnBase = isDark
    ? 'text-white/80 hover:text-white hover:bg-white/10'
    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100';
  const avatarRing = isDark ? 'ring-white/20' : 'ring-slate-200';

  if (status === 'loading') {
    return (
      <div className="h-9 w-9 rounded-full bg-slate-200 animate-pulse" aria-hidden />
    );
  }

  if (!session) {
    return (
      <button
        type="button"
        onClick={() => signIn('google')}
        className={`inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium transition-colors ${btnBase}`}
      >
        Connexion
      </button>
    );
  }

  const user = session.user;
  const avatarSrc = user?.image ?? DEFAULT_AVATAR;
  const displayName = user?.name ?? 'Utilisateur';
  const displayEmail = user?.email ?? '';

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 p-1 pr-2 rounded-xl transition-colors ${btnBase}`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Menu profil"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc}
          alt=""
          className={`h-9 w-9 rounded-full object-cover ring-2 ${avatarRing}`}
        />
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className={`absolute right-0 top-full mt-2 w-72 rounded-xl shadow-lg border ${
            isDark
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-slate-200'
          }`}
          role="menu"
        >
          <div className={`p-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
            <p className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {displayName}
            </p>
            {displayEmail && (
              <p className={`text-sm truncate mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {displayEmail}
              </p>
            )}
          </div>
          <div className="p-2">
            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isDark
                  ? 'text-slate-300 hover:bg-slate-700/50'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Settings className="h-4 w-4" />
              Paramètres
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isDark
                  ? 'text-red-300 hover:bg-red-500/20'
                  : 'text-red-600 hover:bg-red-50'
              }`}
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
