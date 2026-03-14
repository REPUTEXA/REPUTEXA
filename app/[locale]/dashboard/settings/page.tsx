'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/site-url';
import { Loader2, Mic } from 'lucide-react';
import { StripePortalButton } from '@/components/dashboard/stripe-portal-button';
import { PhoneInput, isValidPhoneNumber } from '@/components/phone-input';
import { PasswordField } from '@/components/auth/password-field';
import { SettingsSkeleton } from '@/components/auth/settings-skeleton';
import { getAuthErrorMessage } from '@/lib/auth/errors';
import { toast } from 'sonner';
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
  const [, setSelectedPlan] = useState<'vision' | 'pulse' | 'zenith'>('vision');
  const [aiTone, setAiTone] = useState<'professional' | 'warm' | 'casual' | 'luxury' | 'humorous'>('professional');
  const [aiLength, setAiLength] = useState<'concise' | 'balanced' | 'detailed'>('balanced');
  const [aiSafeMode, setAiSafeMode] = useState(true);
  const [aiCustomInstructions, setAiCustomInstructions] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingAiPreferences, setSavingAiPreferences] = useState(false);

  // Vocal-to-style (ADN IA) state
  const [aiVoiceRecording, setAiVoiceRecording] = useState(false);
  const [aiVoiceLoading, setAiVoiceLoading] = useState(false);
  const aiMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const aiStreamRef = useRef<MediaStream | null>(null);
  const aiChunksRef = useRef<Blob[]>([]);

  // Aperçu "Ghostwriter" en direct
  const [previewText, setPreviewText] = useState('');
  const [animatedPreview, setAnimatedPreview] = useState('');

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
        if (data.selectedPlan) setSelectedPlan(data.selectedPlan);
        if (data.aiTone) setAiTone(data.aiTone);
        if (data.aiLength) setAiLength(data.aiLength);
        if (typeof data.aiSafeMode === 'boolean') setAiSafeMode(data.aiSafeMode);
        if (typeof data.aiCustomInstructions === 'string') setAiCustomInstructions(data.aiCustomInstructions);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Impossible de charger le profil'))
      .finally(() => setLoadingProfile(false));
  }, []);

  const handleAiVoiceToggle = () => {
    if (aiMediaRecorderRef.current?.state === 'recording') {
      aiMediaRecorderRef.current.stop();
      aiMediaRecorderRef.current = null;
      aiStreamRef.current?.getTracks().forEach((t) => t.stop());
      aiStreamRef.current = null;
      setAiVoiceRecording(false);
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        aiStreamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        aiChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) aiChunksRef.current.push(e.data);
        };
        recorder.onstop = async () => {
          if (aiChunksRef.current.length === 0) return;
          setAiVoiceLoading(true);
          try {
            const blob = new Blob(aiChunksRef.current, { type: 'audio/webm' });
            const form = new FormData();
            form.append('audio', blob);
            const res = await fetch('/api/suggestions/transcribe', {
              method: 'POST',
              body: form,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Erreur transcription');
            const transcript = String(data.transcript ?? '').trim();
            if (!transcript) {
              toast.error('Aucune transcription détectée.');
              return;
            }

            const prefRes = await fetch('/api/ai/preferences/from-voice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcript,
              aiTone,
              aiLength,
              aiCustomInstructions: aiCustomInstructions,
            }),
            });
            const prefJson = await prefRes.json();
            if (!prefRes.ok) {
              throw new Error(prefJson.error ?? 'Erreur IA');
            }
            if (prefJson.aiTone) setAiTone(prefJson.aiTone);
            if (prefJson.aiLength) setAiLength(prefJson.aiLength);
            if (typeof prefJson.aiCustomInstructions === 'string') {
              setAiCustomInstructions(prefJson.aiCustomInstructions);
            }
            toast.success('Préférences IA mises à jour depuis votre voix ✅');
          } catch (err) {
            toast.error(
              err instanceof Error
                ? err.message
                : "Impossible d'analyser le vocal. Réessayez dans un endroit calme.",
            );
          } finally {
            setAiVoiceLoading(false);
          }
        };
        recorder.start();
        aiMediaRecorderRef.current = recorder;
        setAiVoiceRecording(true);
      })
      .catch(() =>
        toast.error(
          'Micro non accessible. Vérifiez les autorisations du navigateur pour ce site.',
        ),
      );
  };

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

  // Aperçu Ghostwriter: construit le texte et anime la frappe
  const previewExample =
    aiTone === 'warm'
      ? `Merci beaucoup pour votre avis et d'avoir pris le temps de partager votre ressenti. Même si tout n'a pas été parfait cette fois-ci, votre retour nous aide vraiment à nous améliorer.`
      : aiTone === 'casual'
        ? `Merci pour votre message. Nous sommes vraiment désolés que l'expérience n'ait pas été au niveau. Nous allons regarder ça de près pour que votre prochaine visite soit au top.`
        : aiTone === 'luxury'
          ? `Nous vous remercions sincèrement pour votre retour et sommes navrés que votre expérience n’ait pas été à la hauteur de nos standards. Votre commentaire a été partagé avec l’équipe afin de corriger ces points sans délai.`
          : aiTone === 'humorous'
            ? `Ouch, ce service n’était clairement pas digne de notre meilleure soirée ! Merci de nous l’avoir signalé, nous allons corriger le tir pour que votre prochaine visite soit une vraie réussite.`
            : `Merci d’avoir pris le temps de partager votre avis. Nous sommes désolés que votre expérience n’ait pas été pleinement satisfaisante et nous allons analyser votre retour pour nous améliorer.`;

  const enrichedPreviewExample = aiCustomInstructions.trim()
    ? `${previewExample}\n\n[Consignes : ${aiCustomInstructions.trim()}]`
    : previewExample;

  useEffect(() => {
    setPreviewText(enrichedPreviewExample);
  }, [enrichedPreviewExample]);

  useEffect(() => {
    if (!previewText) {
      setAnimatedPreview('');
      return;
    }
    let index = 0;
    setAnimatedPreview('');
    const chars = Array.from(previewText);
    const interval = window.setInterval(() => {
      index += 3;
      setAnimatedPreview(chars.slice(0, index).join(''));
      if (index >= chars.length) {
        window.clearInterval(interval);
      }
    }, 20);
    return () => window.clearInterval(interval);
  }, [previewText]);

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
        <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-zinc-100 tracking-tight">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{t('description')}</p>
      </header>

      {/* Profil établissement */}
      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm dark:shadow-none p-6">
        <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-zinc-100 mb-4">Profil établissement</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
          <div>
            <label htmlFor="settings-fullname" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              Prénom / Nom
            </label>
            <input
              id="settings-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-indigo-500 transition-all duration-200"
              placeholder="Jean Dupont"
            />
          </div>
          <div>
            <label htmlFor="settings-name" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              Nom de l&apos;établissement
            </label>
            <input
              id="settings-name"
              type="text"
              value={establishmentName}
              onChange={(e) => setEstablishmentName(e.target.value)}
              autoComplete="organization"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-indigo-500 transition-all duration-200"
              placeholder="Mon Restaurant"
            />
          </div>
          <div>
            <label htmlFor="settings-address" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              Adresse
            </label>
            <input
              id="settings-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-indigo-500 transition-all duration-200"
              placeholder="12 rue de la Paix, 75001 Paris"
            />
          </div>
          <div>
            <label htmlFor="settings-phone" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
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
            className="py-3 px-6 rounded-xl font-semibold text-white bg-primary hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
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

      {/* Abonnement et facturation */}
      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm dark:shadow-none p-6">
        <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-zinc-100 mb-4">
          Abonnement et facturation
        </h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
          Gérez votre abonnement, vos moyens de paiement et consultez vos factures sur Stripe.
        </p>
        <StripePortalButton
          locale={locale}
          onError={(err) => toast.error(err.message || 'Impossible d\'ouvrir le portail de facturation')}
        />
      </section>

      {/* Connexion aux Plateformes */}
      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm dark:shadow-none p-6">
        <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-zinc-100 mb-4">
          Connexion aux Plateformes
        </h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 rounded-xl border border-slate-200 dark:border-zinc-800/50 bg-slate-50/50 dark:bg-zinc-800/30 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm dark:shadow-none">
              <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 dark:text-zinc-100">Google Business Profile</p>
              {isGoogleConnected ? (
                <>
                  <p className="text-sm text-emerald-600 font-medium flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
                    Connecté · {googleLocationName ?? establishmentName}
                  </p>
                  {googleLocationAddress && (
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{googleLocationAddress}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">Non connecté</p>
              )}
            </div>
            <div className="flex shrink-0">
              {isGoogleConnected ? (
                <button
                  type="button"
                  onClick={handleGoogleDisconnect}
                  disabled={googleDisconnecting}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200 hover:bg-slate-200/80 hover:text-slate-800 transition-colors disabled:opacity-50 active:scale-[0.98]"
                >
                  {googleDisconnecting ? '...' : 'Déconnecter'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleConnect}
                  disabled={googleConnecting}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#4285F4] to-[#34A853] hover:opacity-90 shadow-sm transition-opacity disabled:opacity-50 active:scale-[0.98] flex items-center gap-2"
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
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-4">
          Vos données sont sécurisées. Nous ne publions rien sans votre accord.
        </p>
      </section>

      {/* Personnalisation IA de réponse aux avis */}
      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm dark:shadow-none p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSavingAiPreferences(true);
              try {
                const res = await fetch('/api/profile', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    aiTone,
                    aiLength,
                    aiSafeMode,
                    aiCustomInstructions: aiCustomInstructions.trim(),
                  }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  toast.error(data?.error ?? 'Erreur lors de la sauvegarde des préférences IA');
                  return;
                }
                toast.success('Stratégie de marque mise à jour.');
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Erreur réseau');
              } finally {
                setSavingAiPreferences(false);
              }
            }}
            className="flex-1 space-y-4"
          >
            <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-zinc-100 mb-1">
              ADN de vos réponses IA
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-3">
              Définissez le style de vos réponses pour que l&apos;IA parle comme votre établissement.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                  Ton
                </label>
                <select
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value as typeof aiTone)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-indigo-500"
                >
                  <option value="professional">Professionnel</option>
                  <option value="warm">Chaleureux</option>
                  <option value="casual">Décontracté</option>
                  <option value="luxury">Luxueux</option>
                  <option value="humorous">Humoristique</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                  Longueur des réponses
                </label>
                <select
                  value={aiLength}
                  onChange={(e) => setAiLength(e.target.value as typeof aiLength)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-indigo-500"
                >
                  <option value="concise">Concis</option>
                  <option value="balanced">Équilibré</option>
                  <option value="detailed">Détaillé</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                Instructions spécifiques
              </label>
              <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                <div className="flex-1">
                  <textarea
                    rows={4}
                    value={aiCustomInstructions}
                    onChange={(e) => setAiCustomInstructions(e.target.value)}
                    placeholder={
                      "Ex : Ne jamais s'excuser pour les délais le samedi soir.\nToujours inviter à revenir goûter le nouveau dessert."
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-indigo-500"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    Ces instructions seront ajoutées au prompt système envoyé à l&apos;IA.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAiVoiceToggle}
                  disabled={aiVoiceLoading}
                  className={`shrink-0 inline-flex items-center justify-center px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors active:scale-[0.98] ${
                    aiVoiceRecording
                      ? 'border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400'
                      : 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700/50'
                  }`}
                >
                  {aiVoiceLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Analyse...
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2" />
                      {aiVoiceRecording ? 'Terminer le vocal' : 'Parler à votre IA'}
                    </>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingAiPreferences}
              className="mt-4 inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-white bg-primary hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all duration-300"
            >
              {savingAiPreferences ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </button>
          </form>

          {/* Aperçu en direct - Ghostwriter */}
          <div className="flex-1 rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-slate-50 dark:bg-zinc-900/50 p-5 space-y-3 shadow-[4px_6px_0_rgba(0,0,0,0.04)] dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-400">
                Aperçu en direct
              </p>
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 dark:border-indigo-400/30 bg-indigo-500/10 dark:bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-500 dark:text-indigo-400">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                Simulation
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-800/50 px-4 py-3 text-xs text-slate-600 dark:text-zinc-300">
              <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                Exemple d&apos;avis négatif
              </p>
              <p>
                &quot;Service très lent et plat arrivé tiède. Je suis déçu de mon dîner hier
                soir.&quot;
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-800/50 px-4 py-3 text-sm text-slate-700 dark:text-zinc-100 shadow-sm dark:shadow-none relative overflow-hidden">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Réponse IA (aperçu dynamique)
              </p>
              <p className="whitespace-pre-line font-normal">
                {animatedPreview || enrichedPreviewExample}
              </p>
              {animatedPreview && animatedPreview.length < enrichedPreviewExample.length && (
                <span className="absolute bottom-3 right-4 inline-flex items-center gap-1 text-[10px] text-slate-400">
                  <span className="w-1 h-1 bg-slate-400 rounded-full animate-pulse" />
                  IA en train d&apos;ajuster le ton...
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chaque changement de ton, longueur ou instruction met instantanément à jour cette
              simulation, pour refléter la manière dont l&apos;IA répondra à vos futurs avis.
            </p>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm dark:shadow-none p-6">
        <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-zinc-100 mb-4">Notifications</h2>
        <form onSubmit={handleSaveNotifications} className="space-y-4 max-w-xl">
          <div>
            <label htmlFor="settings-whatsapp" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
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
            <label htmlFor="settings-alert-threshold" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              Seuil d&apos;alerte
            </label>
            <select
              id="settings-alert-threshold"
              value={alertThresholdStars}
              onChange={(e) => setAlertThresholdStars(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-indigo-500"
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
            className="py-3 px-6 rounded-xl font-semibold text-white bg-primary hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
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
      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm dark:shadow-none p-6">
        <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-zinc-100 mb-4">Compte</h2>
        <form onSubmit={handleSaveAccount} className="space-y-4 max-w-xl">
          <div>
            <label htmlFor="settings-email" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              Email
            </label>
            <input
              id="settings-email"
              type="email"
              value={email}
              readOnly
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/50"
            />
            <p className="text-xs text-slate-500 mt-1">L&apos;email ne peut pas être modifié ici.</p>
          </div>
          <div>
            <label htmlFor="settings-password" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
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
            className="py-3 px-6 rounded-xl font-semibold text-white bg-primary hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
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
