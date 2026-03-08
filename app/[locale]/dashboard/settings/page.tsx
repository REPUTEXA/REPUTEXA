'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/site-url';
import { Loader2 } from 'lucide-react';
import { PhoneInput, isValidPhoneNumber } from '@/components/phone-input';
import { PasswordField } from '@/components/auth/password-field';
import { SettingsSkeleton } from '@/components/auth/settings-skeleton';
import { getAuthErrorMessage } from '@/lib/auth/errors';
import { toast } from 'sonner';
import { hasFeature, FEATURES } from '@/lib/feature-gate';

const GOOGLE_BUSINESS_SCOPE = 'https://www.googleapis.com/auth/business.manage';

export default function SettingsPage() {
  const t = useTranslations('Dashboard.settings');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const [fullName, setFullName] = useState('');
  const [establishmentName, setEstablishmentName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [googleLocationId, setGoogleLocationId] = useState<string | null>(null);
  const [googleLocationName, setGoogleLocationName] = useState<string | null>(null);
  const [googleLocationAddress, setGoogleLocationAddress] = useState<string | null>(null);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googleDisconnecting, setGoogleDisconnecting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [alertThresholdStars, setAlertThresholdStars] = useState(3);
  const [seoKeywords, setSeoKeywords] = useState<string[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<'vision' | 'pulse' | 'zenith'>('vision');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingSeo, setSavingSeo] = useState(false);

  const hasSeoBoost = hasFeature(selectedPlan, FEATURES.SEO_BOOST);

  useEffect(() => {
    fetch('/api/profile')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok || data.error) {
          throw new Error(data.error ?? 'Impossible de charger le profil');
        }
        return data;
      })
      .then((data) => {
        if (data.fullName !== undefined) setFullName(data.fullName ?? '');
        if (data.establishmentName !== undefined) setEstablishmentName(data.establishmentName ?? '');
        if (data.address !== undefined) setAddress(data.address ?? '');
        if (data.phone !== undefined) setPhone(data.phone ?? '');
        if (data.email !== undefined) setEmail(data.email ?? '');
        setGoogleLocationId(data.googleLocationId ?? null);
        setGoogleLocationName(data.googleLocationName ?? null);
        setGoogleLocationAddress(data.googleLocationAddress ?? null);
        if (data.whatsappPhone !== undefined) setWhatsappPhone(data.whatsappPhone ?? '');
        if (data.alertThresholdStars !== undefined) setAlertThresholdStars(data.alertThresholdStars ?? 3);
        if (Array.isArray(data.seoKeywords)) setSeoKeywords(data.seoKeywords);
        if (data.selectedPlan) setSelectedPlan(data.selectedPlan);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Impossible de charger le profil'))
      .finally(() => setLoadingProfile(false));
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim() && !isValidPhoneNumber(phone)) {
      toast.error('Numéro de téléphone invalide.');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          establishmentName: establishmentName.trim(),
          address: address.trim(),
          phone: phone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error ?? 'Erreur lors de l\'enregistrement';
        toast.error(msg);
        return;
      }
      toast.success('Modifications enregistrées ✅');
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement';
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) return;
    setSavingAccount(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      toast.success('Mot de passe mis à jour ✅');
    } catch (err) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? getAuthErrorMessage(err as { message?: string })
        : 'Erreur lors de la mise à jour';
      toast.error(msg);
    } finally {
      setSavingAccount(false);
    }
  };

  const handleSaveSeo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSeo(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seoKeywords: Array.isArray(seoKeywords) ? seoKeywords : [] }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Erreur lors de l\'enregistrement SEO');
        return;
      }
      toast.success('Mots-clés SEO enregistrés ✅');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setSavingSeo(false);
    }
  };

  const isGoogleConnected = !!googleLocationId;

  const handleGoogleConnect = useCallback(async () => {
    setGoogleConnecting(true);
    try {
      const supabase = createClient();
      const redirectTo = `${getSiteUrl()}/${locale}/dashboard/settings?from=google`;
      const { data, error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo,
          scopes: `${GOOGLE_BUSINESS_SCOPE} email profile`,
        },
      });
      if (error) {
        const { data: oauthData, error: oauthErr } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
            scopes: `${GOOGLE_BUSINESS_SCOPE} email profile`,
            queryParams: { prompt: 'consent' },
          },
        });
        if (oauthErr) throw oauthErr;
        if (oauthData?.url) {
          window.location.href = oauthData.url;
          return;
        }
      } else if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la connexion Google');
    } finally {
      setGoogleConnecting(false);
    }
  }, [locale]);

  const handleGoogleDisconnect = async () => {
    setGoogleDisconnecting(true);
    try {
      const res = await fetch('/api/google-business/disconnect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setGoogleLocationId(null);
      setGoogleLocationName(null);
      setGoogleLocationAddress(null);
      toast.success('Google Business déconnecté');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setGoogleDisconnecting(false);
    }
  };

  useEffect(() => {
    if (searchParams?.get('from') !== 'google') return;
    const run = async () => {
      try {
        const res = await fetch('/api/google-business/save', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Erreur');
        setGoogleLocationId(data.googleLocationId);
        setGoogleLocationName(data.googleLocationName);
        setGoogleLocationAddress(data.googleLocationAddress);
        toast.success('Google Business connecté ✅');
        router.replace(pathname ?? '/dashboard/settings');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
      }
    };
    run();
  }, [searchParams, router, pathname]);

  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    if (whatsappPhone.trim() && !isValidPhoneNumber(whatsappPhone)) {
      toast.error('Numéro WhatsApp invalide.');
      return;
    }
    setSavingNotifications(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsappPhone: whatsappPhone.trim(),
          alertThresholdStars: Number(alertThresholdStars),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Erreur lors de l\'enregistrement des notifications');
        return;
      }
      toast.success('Notifications enregistrées ✅');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setSavingNotifications(false);
    }
  };

  if (loadingProfile) return <SettingsSkeleton />;

  return (
    <div className="px-4 sm:px-6 py-6 space-y-8">
      <header>
        <h1 className="font-display font-bold text-2xl text-slate-900 tracking-tight">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('description')}</p>
      </header>

      {/* Profil établissement */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h2 className="font-display font-semibold text-lg text-slate-900 mb-4">Profil établissement</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
          <div>
            <label htmlFor="settings-fullname" className="block text-sm font-medium text-slate-700 mb-1.5">
              Prénom / Nom
            </label>
            <input
              id="settings-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
              placeholder="Jean Dupont"
            />
          </div>
          <div>
            <label htmlFor="settings-name" className="block text-sm font-medium text-slate-700 mb-1.5">
              Nom de l&apos;établissement
            </label>
            <input
              id="settings-name"
              type="text"
              value={establishmentName}
              onChange={(e) => setEstablishmentName(e.target.value)}
              autoComplete="organization"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
              placeholder="Mon Restaurant"
            />
          </div>
          <div>
            <label htmlFor="settings-address" className="block text-sm font-medium text-slate-700 mb-1.5">
              Adresse
            </label>
            <input
              id="settings-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
              placeholder="12 rue de la Paix, 75001 Paris"
            />
          </div>
          <div>
            <label htmlFor="settings-phone" className="block text-sm font-medium text-slate-700 mb-1.5">
              Téléphone
            </label>
            <PhoneInput
              id="settings-phone"
              value={phone}
              onChange={(v) => setPhone(v ?? '')}
              placeholder="6 12 34 56 78"
            />
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="py-3 px-6 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transition-all duration-300 flex items-center justify-center gap-2"
          >
            {savingProfile ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer'
            )}
          </button>
        </form>
      </section>

      {/* Connexion aux Plateformes */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h2 className="font-display font-semibold text-lg text-slate-900 mb-4">
          Connexion aux Plateformes
        </h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm">
              <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">Google Business Profile</p>
              {isGoogleConnected ? (
                <>
                  <p className="text-sm text-emerald-600 font-medium flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
                    Connecté · {googleLocationName ?? establishmentName}
                  </p>
                  {googleLocationAddress && (
                    <p className="text-xs text-slate-500 mt-1">{googleLocationAddress}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500 mt-0.5">Non connecté</p>
              )}
            </div>
            <div className="flex shrink-0">
              {isGoogleConnected ? (
                <button
                  type="button"
                  onClick={handleGoogleDisconnect}
                  disabled={googleDisconnecting}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200/80 hover:text-slate-800 transition-colors disabled:opacity-50"
                >
                  {googleDisconnecting ? '...' : 'Déconnecter'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleConnect}
                  disabled={googleConnecting}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#4285F4] to-[#34A853] hover:opacity-90 shadow-sm transition-opacity disabled:opacity-50 flex items-center gap-2"
                >
                  {googleConnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  Connecter mon établissement
                </button>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Vos données sont sécurisées. Nous ne publions rien sans votre accord.
        </p>
      </section>

      {/* SEO & Visibilité (Zenith) */}
      {hasSeoBoost && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
          <h2 className="font-display font-semibold text-lg text-slate-900 mb-4">SEO &amp; Visibilité</h2>
          <form onSubmit={handleSaveSeo} className="space-y-4 max-w-xl">
            <div>
              <label htmlFor="settings-seo-keywords" className="block text-sm font-medium text-slate-700 mb-1.5">
                Mots-clés SEO
              </label>
              <textarea
                id="settings-seo-keywords"
                value={seoKeywords.join('\n')}
                onChange={(e) =>
                  setSeoKeywords(
                    e.target.value
                      .split('\n')
                      .map((k) => k.trim())
                      .filter(Boolean)
                  )
                }
                rows={5}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                placeholder={'Meilleure pizza de Nice\nTerrasse ensoleillée\nCuisine faite maison'}
              />
              <p className="text-xs text-slate-500 mt-1">
                Un mot-clé par ligne. L&apos;IA les intégrera naturellement dans vos réponses pour renforcer le référencement local.
              </p>
            </div>
            <button
              type="submit"
              disabled={savingSeo}
              className="py-3 px-6 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transition-all duration-300 flex items-center justify-center gap-2"
            >
              {savingSeo ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </button>
          </form>
        </section>
      )}

      {/* Notifications */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h2 className="font-display font-semibold text-lg text-slate-900 mb-4">Notifications</h2>
        <form onSubmit={handleSaveNotifications} className="space-y-4 max-w-xl">
          <div>
            <label htmlFor="settings-whatsapp" className="block text-sm font-medium text-slate-700 mb-1.5">
              Numéro WhatsApp
            </label>
            <PhoneInput
              id="settings-whatsapp"
              value={whatsappPhone}
              onChange={(v) => setWhatsappPhone(v ?? '')}
              placeholder="6 12 34 56 78"
            />
            <p className="text-xs text-slate-500 mt-1">Pour recevoir les alertes d&apos;avis négatifs (Twilio/Meta à brancher).</p>
          </div>
          <div>
            <label htmlFor="settings-alert-threshold" className="block text-sm font-medium text-slate-700 mb-1.5">
              Seuil d&apos;alerte
            </label>
            <select
              id="settings-alert-threshold"
              value={alertThresholdStars}
              onChange={(e) => setAlertThresholdStars(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              <option value={2}>Alerter si &lt; 2 étoiles (1 étoile)</option>
              <option value={3}>Alerter si &lt; 3 étoiles</option>
              <option value={4}>Alerter si &lt; 4 étoiles</option>
              <option value={5}>Alerter pour tout sauf 5 étoiles</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">Les avis en dessous de ce seuil déclenchent une alerte WhatsApp.</p>
          </div>
          <button
            type="submit"
            disabled={savingNotifications}
            className="py-3 px-6 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transition-all duration-300 flex items-center justify-center gap-2"
          >
            {savingNotifications ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer'
            )}
          </button>
        </form>
      </section>

      {/* Compte */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h2 className="font-display font-semibold text-lg text-slate-900 mb-4">Compte</h2>
        <form onSubmit={handleSaveAccount} className="space-y-4 max-w-xl">
          <div>
            <label htmlFor="settings-email" className="block text-sm font-medium text-slate-700 mb-1.5">
              Email
            </label>
            <input
              id="settings-email"
              type="email"
              value={email}
              readOnly
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 bg-slate-50"
            />
            <p className="text-xs text-slate-500 mt-1">L&apos;email ne peut pas être modifié ici.</p>
          </div>
          <div>
            <label htmlFor="settings-password" className="block text-sm font-medium text-slate-700 mb-1.5">
              Nouveau mot de passe
            </label>
            <PasswordField
              id="settings-password"
              value={newPassword}
              onChange={setNewPassword}
              showPassword={showPassword}
              onToggleVisibility={() => setShowPassword((v) => !v)}
              minLength={6}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <p className="text-xs text-slate-500 mt-1">Minimum 6 caractères. Laissez vide pour ne pas changer.</p>
          </div>
          <button
            type="submit"
            disabled={savingAccount || !newPassword || newPassword.length < 6}
            className="py-3 px-6 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transition-all duration-300 flex items-center justify-center gap-2"
          >
            {savingAccount ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Mise à jour...
              </>
            ) : (
              'Changer le mot de passe'
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
