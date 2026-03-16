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
import { getLanguageFromPhone } from '@/lib/language-from-phone';
import { toast } from 'sonner';

const GOOGLE_BUSINESS_SCOPE = 'https://www.googleapis.com/auth/business.manage';

const LOCALE_NAMES: Record<string, string> = {
  fr: 'Français',
  en: 'Anglais',
  it: 'Italien',
  es: 'Espagnol',
  de: 'Allemand',
};

export default function SettingsPage() {
  const t = useTranslations('Dashboard.settings');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const [fullName, setFullName] = useState('');
  const [establishmentName, setEstablishmentName] = useState('');
  const [establishmentType, setEstablishmentType] = useState('');
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
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'vision' | 'pulse' | 'zenith'>('zenith');
  const [changePlanLoading, setChangePlanLoading] = useState<'pulse' | 'vision' | 'zenith' | null>(null);
  const [aiTone, setAiTone] = useState<'professional' | 'warm' | 'casual' | 'luxury' | 'humorous'>('professional');
  const [aiLength, setAiLength] = useState<'concise' | 'balanced' | 'detailed'>('balanced');
  const [aiSafeMode, setAiSafeMode] = useState(true);
  const [aiCustomInstructions, setAiCustomInstructions] = useState('');
  const [profileLanguage, setProfileLanguage] = useState<string>('fr');
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [suggestedLocale, setSuggestedLocale] = useState<string | null>(null);
  const pendingProfilePayloadRef = useRef<Record<string, unknown> | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingAiPreferences, setSavingAiPreferences] = useState(false);
  const [googleErrorShown, setGoogleErrorShown] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

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
        if (data.establishmentType !== undefined) setEstablishmentType(data.establishmentType ?? '');
        if (data.address !== undefined) setAddress(data.address ?? '');
        if (data.phone !== undefined) setPhone(data.phone ?? '');
        if (data.email !== undefined) setEmail(data.email ?? '');
        setGoogleLocationId(data.googleLocationId ?? null);
        setGoogleLocationName(data.googleLocationName ?? null);
        setGoogleLocationAddress(data.googleLocationAddress ?? null);
        if (data.whatsappPhone !== undefined) setWhatsappPhone(data.whatsappPhone ?? '');
        if (data.alertThresholdStars !== undefined) setAlertThresholdStars(data.alertThresholdStars ?? 3);
        if (data.selectedPlan) setSelectedPlan(data.selectedPlan);
        if (data.subscriptionStatus !== undefined) setSubscriptionStatus(data.subscriptionStatus ?? null);
        if (data.aiTone) setAiTone(data.aiTone);
        if (data.aiLength) setAiLength(data.aiLength);
        if (typeof data.aiSafeMode === 'boolean') setAiSafeMode(data.aiSafeMode);
        if (typeof data.aiCustomInstructions === 'string') setAiCustomInstructions(data.aiCustomInstructions);
        if (typeof data.language === 'string') setProfileLanguage(data.language);
        if (typeof data.trialEndsAt === 'string' || data.trialEndsAt === null) {
          setTrialEndsAt(data.trialEndsAt);
        }
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

  const doSaveProfile = async (payload: { fullName: string; establishmentName: string; establishmentType: string; address: string; phone: string }, languageOverride: string | null) => {
    setSavingProfile(true);
    try {
      const body: Record<string, string> = {
        fullName: payload.fullName,
        establishmentName: payload.establishmentName,
        establishmentType: payload.establishmentType,
        address: payload.address,
        phone: payload.phone,
      };
      if (languageOverride) body.language = languageOverride;
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error ?? 'Erreur lors de l\'enregistrement';
        toast.error(msg);
        return;
      }
      toast.success('Modifications enregistrées ✅');
      if (languageOverride) {
        router.replace(`/${languageOverride}/dashboard/settings`);
      } else {
        router.refresh();
      }
      if (languageOverride) setProfileLanguage(languageOverride);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement';
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim() && !isValidPhoneNumber(phone)) {
      toast.error('Numéro de téléphone invalide.');
      return;
    }
    const payload = {
      fullName: fullName.trim(),
      establishmentName: establishmentName.trim(),
      establishmentType: establishmentType.trim(),
      address: address.trim(),
      phone: phone.trim(),
    };
    const suggestedFromPhone = phone.trim() ? getLanguageFromPhone(phone.trim()) : null;
    if (suggestedFromPhone && suggestedFromPhone !== profileLanguage) {
      setSuggestedLocale(suggestedFromPhone);
      pendingProfilePayloadRef.current = payload;
      setShowLanguageModal(true);
      return;
    }
    await doSaveProfile(payload, null);
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
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) {
        const { data: oauthData, error: oauthErr } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
            scopes: `${GOOGLE_BUSINESS_SCOPE} email profile`,
            queryParams: { access_type: 'offline', prompt: 'consent' },
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

  const handleFacebookConnect = () => {
    toast.info('Connexion Facebook bientôt disponible.');
  };

  const handleTrustpilotConnect = () => {
    toast.info('Connexion Trustpilot bientôt disponible.');
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
      } catch (err) {
        // Pas de toast agressif automatique : si la connexion échoue,
        // on laisse simplement l'état sur "⚪ Non connecté".
        console.error('[settings] google-business/save failed', err);
      } finally {
        router.replace(pathname ?? '/dashboard/settings');
        router.refresh();
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
  const isFacebookConnected = false;
  const isTrustpilotConnected = false;
  const connectedCount = [isGoogleConnected, isFacebookConnected, isTrustpilotConnected].filter(Boolean).length;
  const connectionScoreLabel = `${connectedCount}/3 plateformes actives`;
  const connectionScorePercent = (connectedCount / 3) * 100;
  const formattedTrialEnd =
    trialEndsAt
      ? new Date(trialEndsAt).toLocaleDateString(
          locale === 'en' ? 'en-US' : 'fr-FR',
          { day: 'numeric', month: 'long', year: 'numeric' }
        )
      : null;

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
            <label htmlFor="settings-establishment-type" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              Type d&apos;établissement <span className="text-red-500">*</span>
            </label>
            <input
              id="settings-establishment-type"
              type="text"
              value={establishmentType}
              onChange={(e) => setEstablishmentType(e.target.value)}
              required
              autoComplete="organization-title"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-indigo-500 transition-all duration-200"
              placeholder="Hôtel, restaurant, bar, salon de coiffure..."
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
      <section id="billing" className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm dark:shadow-none p-6">
        <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-zinc-100 mb-4">
          Abonnement et facturation
        </h2>
        {subscriptionStatus === 'trialing' && (
          <div className="mb-4 p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
            <p className="text-sm font-medium text-slate-700 dark:text-zinc-200 mb-3">
              Changer de plan pendant ton essai
            </p>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-3">
              Choisis ton plan définitif. Tu peux changer d&apos;avis autant de fois que tu veux jusqu&apos;à la fin de tes 14 jours d&apos;essai.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!!changePlanLoading}
                onClick={async () => {
                  setChangePlanLoading('vision');
                  try {
                    const res = await fetch('/api/stripe/upgrade-subscription', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ planSlug: 'vision' }),
                      credentials: 'include',
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error ?? 'Erreur');
                    toast.success(
                      formattedTrialEnd
                        ? `Choix enregistré. Vous profitez de ZÉNITH jusqu'au ${formattedTrialEnd}.`
                        : 'Choix enregistré. Vous profitez de ZÉNITH jusqu’à la fin de votre essai.',
                    );
                    const profileRes = await fetch('/api/profile', { credentials: 'include' });
                    const profileData = await profileRes.json().catch(() => ({}));
                    if (profileData.selectedPlan !== undefined) setSelectedPlan(profileData.selectedPlan);
                    if (profileData.subscriptionStatus !== undefined) setSubscriptionStatus(profileData.subscriptionStatus ?? null);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Impossible de changer de plan');
                  } finally {
                    setChangePlanLoading(null);
                  }
                }}
                className={`inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:pointer-events-none transition-all bg-primary hover:brightness-110 ${
                  selectedPlan === 'vision' ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-zinc-900' : ''
                }`}
              >
                {changePlanLoading === 'vision' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Passer à VISION
                {selectedPlan === 'vision' && !changePlanLoading && <span className="text-blue-200 text-xs font-medium">— Ton futur plan</span>}
              </button>
              <button
                type="button"
                disabled={!!changePlanLoading}
                onClick={async () => {
                  setChangePlanLoading('pulse');
                  try {
                    const res = await fetch('/api/stripe/upgrade-subscription', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ planSlug: 'pulse' }),
                      credentials: 'include',
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error ?? 'Erreur');
                    toast.success(
                      formattedTrialEnd
                        ? `Choix enregistré. Vous profitez de ZÉNITH jusqu'au ${formattedTrialEnd}.`
                        : 'Choix enregistré. Vous profitez de ZÉNITH jusqu’à la fin de votre essai.',
                    );
                    const profileRes = await fetch('/api/profile', { credentials: 'include' });
                    const profileData = await profileRes.json().catch(() => ({}));
                    if (profileData.selectedPlan !== undefined) setSelectedPlan(profileData.selectedPlan);
                    if (profileData.subscriptionStatus !== undefined) setSubscriptionStatus(profileData.subscriptionStatus ?? null);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Impossible de changer de plan');
                  } finally {
                    setChangePlanLoading(null);
                  }
                }}
                className={`inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:pointer-events-none transition-all ${
                  selectedPlan === 'pulse'
                    ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-zinc-900 text-white bg-slate-700 hover:bg-slate-800'
                    : 'text-white bg-slate-700 hover:bg-slate-800'
                }`}
              >
                {changePlanLoading === 'pulse' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Passer à PULSE
                {selectedPlan === 'pulse' && !changePlanLoading && <span className="text-emerald-300 text-xs font-medium">— Ton futur plan</span>}
              </button>
              <button
                type="button"
                disabled={!!changePlanLoading}
                onClick={async () => {
                  setChangePlanLoading('zenith');
                  try {
                    const res = await fetch('/api/stripe/upgrade-subscription', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ planSlug: 'zenith' }),
                      credentials: 'include',
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error ?? 'Erreur');
                    toast.success(
                      formattedTrialEnd
                        ? `Choix enregistré. Vous profitez de ZÉNITH jusqu'au ${formattedTrialEnd}.`
                        : 'Choix enregistré. Vous profitez de ZÉNITH jusqu’à la fin de votre essai.',
                    );
                    const profileRes = await fetch('/api/profile', { credentials: 'include' });
                    const profileData = await profileRes.json().catch(() => ({}));
                    if (profileData.selectedPlan !== undefined) setSelectedPlan(profileData.selectedPlan);
                    if (profileData.subscriptionStatus !== undefined) setSubscriptionStatus(profileData.subscriptionStatus ?? null);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Impossible de changer de plan');
                  } finally {
                    setChangePlanLoading(null);
                  }
                }}
                className={`inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:pointer-events-none transition-all ${
                  selectedPlan === 'zenith'
                    ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-zinc-900 text-white bg-amber-600 hover:bg-amber-700'
                    : 'text-white bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {changePlanLoading === 'zenith' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Rester sur ZENITH
                {selectedPlan === 'zenith' && !changePlanLoading && <span className="text-amber-200 text-xs font-medium">— Ton futur plan</span>}
              </button>
            </div>
          </div>
        )}
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
          Gérez votre abonnement, vos moyens de paiement et consultez vos factures sur Stripe.
        </p>
        <StripePortalButton
          locale={locale}
          onError={(err) => toast.error(err.message || 'Impossible d\'ouvrir le portail de facturation')}
        />
      </section>

      {/* Gestion des Plateformes */}
      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm dark:shadow-none p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-zinc-100">
              Gestion des Plateformes
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Connectez vos comptes pour activer l&apos;IA sur tous vos canaux.
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1">
            <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              Score de connexion&nbsp;: {connectionScoreLabel}
            </p>
            <div className="w-40 h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-500 transition-all"
                style={{ width: `${connectionScorePercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Barre de progression visible aussi sur mobile */}
        <div className="sm:hidden mb-4">
          <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
            Score de connexion&nbsp;: {connectionScoreLabel}
          </p>
          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-500 transition-all"
              style={{ width: `${connectionScorePercent}%` }}
            />
          </div>
        </div>

        <div className="space-y-3">
          {/* Google */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-zinc-800/60 bg-slate-50 dark:bg-zinc-900/80 px-4 py-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-1">
              <svg className="h-full w-full" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-900 dark:text-zinc-100">
                  Google Business Profile
                </p>
              </div>
              {isGoogleConnected ? (
                <>
                  <p className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
                    🟢 Connecté · {googleLocationName ?? establishmentName}
                  </p>
                  {googleLocationAddress && (
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 truncate">
                      {googleLocationAddress}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                  ⚪ Non connecté
                </p>
              )}
            </div>
            <div className="flex shrink-0">
              {isGoogleConnected ? (
                <button
                  type="button"
                  onClick={handleGoogleDisconnect}
                  disabled={googleDisconnecting}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
                >
                  {googleDisconnecting ? '...' : 'Gérer'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleConnect}
                  disabled={googleConnecting}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
                  style={{ backgroundColor: '#2563eb' }}
                >
                  {googleConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Connecter mon compte</span>
                </button>
              )}
            </div>
          </div>

          {/* Facebook */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-zinc-800/60 bg-slate-50 dark:bg-zinc-900/80 px-4 py-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-1">
              <svg viewBox="0 0 24 24" aria-hidden className="h-full w-full">
                <path
                  fill="#1877F2"
                  d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.351C0 23.407.593 24 1.325 24h11.495v-9.294H9.691V11.01h3.129V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.794.143v3.24h-1.918c-1.504 0-1.796.715-1.796 1.763v2.313h3.59l-.467 3.696h-3.123V24h6.116C23.407 24 24 23.407 24 22.676V1.325C24 .593 23.407 0 22.675 0z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-slate-900 dark:text-zinc-100">
                  Facebook
                </p>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                ⚪ Non connecté
              </p>
            </div>
            <div className="flex shrink-0">
              <button
                type="button"
                onClick={handleFacebookConnect}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white"
                style={{ backgroundColor: '#1877F2' }}
              >
                Connecter mon compte
              </button>
            </div>
          </div>

          {/* Trustpilot */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-zinc-800/60 bg-slate-50 dark:bg-zinc-900/80 px-4 py-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-1">
              <svg viewBox="0 0 24 24" aria-hidden className="h-full w-full">
                <path
                  fill="#00B67A"
                  d="M21.852 9.246H14.86L12 2.25l-2.86 6.996H2.148L8.04 13.11 5.18 20.25 12 16.139l6.82 4.111L15.96 13.11l5.892-3.864z"
                />
                <path
                  fill="#005128"
                  d="M17.021 15.22 15.96 13.11 12 15.6z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-slate-900 dark:text-zinc-100">
                  Trustpilot
                </p>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                ⚪ Non connecté
              </p>
            </div>
            <div className="flex shrink-0">
              <button
                type="button"
                onClick={handleTrustpilotConnect}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white"
                style={{ backgroundColor: '#00B67A' }}
              >
                Connecter mon compte
              </button>
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

      {/* Modale changement de pays (indicatif téléphone) */}
      {showLanguageModal && suggestedLocale && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="language-modal-title"
        >
          <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-xl border border-slate-200 dark:border-zinc-700 p-6 max-w-md w-full">
            <h3 id="language-modal-title" className="font-semibold text-lg text-slate-900 dark:text-zinc-100 mb-2">
              Changement de pays détecté
            </h3>
            <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
              Nous avons détecté un changement de pays. Souhaitez-vous également passer l&apos;interface de Reputexa en {LOCALE_NAMES[suggestedLocale] ?? suggestedLocale} ?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowLanguageModal(false);
                  const payload = pendingProfilePayloadRef.current;
                  pendingProfilePayloadRef.current = null;
                  setSuggestedLocale(null);
                  if (payload && typeof payload.fullName === 'string' && typeof payload.establishmentName === 'string' && typeof payload.establishmentType === 'string' && typeof payload.address === 'string' && typeof payload.phone === 'string') {
                    doSaveProfile(payload, null);
                  }
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Non
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLanguageModal(false);
                  const payload = pendingProfilePayloadRef.current;
                  pendingProfilePayloadRef.current = null;
                  const loc = suggestedLocale;
                  setSuggestedLocale(null);
                  if (payload && typeof payload.fullName === 'string' && typeof payload.establishmentName === 'string' && typeof payload.establishmentType === 'string' && typeof payload.address === 'string' && typeof payload.phone === 'string' && loc) {
                    doSaveProfile(payload, loc);
                  }
                }}
                disabled={savingProfile}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-primary hover:brightness-110 disabled:opacity-50 transition-colors"
              >
                Oui
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
