'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  id: string;
  value: string;
  onChange: (v: string) => void;
  showPassword: boolean;
  onToggleVisibility: () => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  error?: string;
  disabled?: boolean;
};

/**
 * Champ mot de passe avec bouton œil pour afficher/masquer.
 * Navigation clavier (Tab, Entrée) et accessibilité intégrés.
 */
export function PasswordField({
  id,
  value,
  onChange,
  showPassword,
  onToggleVisibility,
  placeholder = '••••••••',
  autoComplete = 'current-password',
  required,
  minLength,
  error,
  disabled,
}: Props) {
  const t = useTranslations('Auth.password');
  return (
    <div className="relative">
      <input
        id={id}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        disabled={disabled}
        className={`w-full px-4 py-2.5 pr-11 rounded-xl border text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-primary transition-all duration-200 ${
          error ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
        }`}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <button
        type="button"
        onClick={onToggleVisibility}
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        aria-label={showPassword ? t('hide') : t('show')}
      >
        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-600 mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
