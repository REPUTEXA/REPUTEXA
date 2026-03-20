'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/site-url';
import { Loader2, Mic, Mail, Lock, Pencil, Info, ShieldCheck } from 'lucide-react';
import { StripePortalButton } from '@/components/dashboard/stripe-portal-button';
import { PhoneInput, isValidPhoneNumber } from '@/components/phone-input';
import { PasswordField } from '@/components/auth/password-field';
import { SettingsSkeleton } from '@/components/auth/settings-skeleton';
import { getAuthErrorMessage } from '@/lib/auth/errors';
import { getLanguageFromPhone } from '@/lib/language-from-phone';
import { toast } from 'sonner';

const GOOGLE_BUSINESS_SCOPE = 'https://www.googleapis.com/auth/business.manage';

// Exemples d'avis variés, définis hors du composant pour stabilité
const EXEMPLES_AVIS = [
  'Je suis très déçu, commande arrivée froide et 45 minutes de retard. Première et dernière fois chez vous.',
  'Incroyable expérience ! Service adorable, plats délicieux, on reviendra souvent !',
  'Le burger était bon mais un peu trop salé, et l\'attente était longue. Vous pouvez faire mieux.',
  'Pouvez-vous me dire si vous avez des options végétariennes disponibles le soir ?',
  'Lieu sympa mais musique trop forte, difficile de discuter avec mes amis.',
  'Le chien est-il admis en terrasse ? On adorerait venir avec notre golden retriever.',
  'Le dessert au chocolat était absolument divin. Bravo au chef !',
];

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
  // Email change
  const [showEmailEdit, setShowEmailEdit] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  // Password (3-field)
  const [currentPassword, setCurrentPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
  const [_googleErrorShown, _setGoogleErrorShown] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  // Vocal-to-style (ADN IA) state
  const [aiVoiceRecording, setAiVoiceRecording] = useState(false);
  const [aiVoiceLoading, setAiVoiceLoading] = useState(false);
  const aiMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const aiStreamRef = useRef<MediaStream | null>(null);
  const aiChunksRef = useRef<Blob[]>([]);

  // Simulation ADN IA en temps réel
  const [avisExempleIndex, setAvisExempleIndex] = useState(0);
  const avisExemple = EXEMPLES_AVIS[avisExempleIndex];
  const [simulationResponse, setSimulationResponse] = useState('');
  const [streamedSimulation, setStreamedSimulation] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const streamingTimeoutsRef = useRef<number[]>([]);
  const simulateDebounceRef = useRef<number | null>(null);
  const avisIndexRef = useRef(0);

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
            toast.success('Préférences IA mises à jour depuis votre voix !');
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
      toast.success('Modifications enregistrées !');
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

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    if (newEmail.trim() !== confirmEmail.trim()) {
      toast.error('Les adresses email ne correspondent pas.');
      return;
    }
    setSavingEmail(true);
    try {
      const res = await fetch('/api/auth/email-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: newEmail.trim(), locale }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === 'string'
            ? json.error
            : 'Erreur lors de la mise à jour de l\'email',
        );
      }
      toast.success('Un email de confirmation sécurisé vous a été envoyé. Veuillez vérifier votre nouvelle boîte mail.');
      setShowEmailEdit(false);
      setNewEmail('');
      setConfirmEmail('');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Erreur lors de la mise à jour de l\'email';
      toast.error(msg);
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || newPassword.length < 6) return;
    if (newPassword !== confirmNewPassword) {
      toast.error('Les nouveaux mots de passe ne correspondent pas.');
      return;
    }
    setSavingAccount(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.email) throw new Error('Session expirée. Reconnectez-vous.');
      // Vérification de l'ancien mot de passe
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) throw new Error('Mot de passe actuel incorrect.');
      // Mise à jour du mot de passe
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      toast.success('Mot de passe mis à jour avec succès !');
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : getAuthErrorMessage(err as { message?: string });
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
        toast.success('Google Business connecté !');
      } catch (err) {
        // Pas de toast agressif automatique : si la connexion échoue,
        // on laisse simplement l'état sur "Non connecté".
        console.error('[settings] google-business/save failed', err);
      } finally {
        router.replace(pathname ?? '/dashboard/settings');
        router.refresh();
      }
    };
    run();
  }, [searchParams, router, pathname]);

  // Fonction de simulation - appelee par debounce et par handleSaveAIConfig
  const runSimulation = useCallback(async (ton: string, longueur: string, instructions: string) => {
    streamingTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    streamingTimeoutsRef.current = [];
    setIsSimulating(true);
    setStreamedSimulation(``);
    setSimulationResponse(``);

    let next = Math.floor(Math.random() * EXEMPLES_AVIS.length);
    if (EXEMPLES_AVIS.length > 1 && next === avisIndexRef.current) {
      next = (next + 1) % EXEMPLES_AVIS.length;
    }
    avisIndexRef.current = next;
    setAvisExempleIndex(next);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ton, longueur, instructions, avis: EXEMPLES_AVIS[next] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Erreur simulation');

      const content = String(data.content ?? '')
        .replace(/\[Consignes\s*:.*?\]/gi, '')
        .replace(/reputexa/gi, "l\u2019\u00e9tablissement")
        // Préserver les sauts de ligne ? ne collapper que les espaces horizontaux
        .replace(/[^\S\n]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      setSimulationResponse(content);
      const chars = Array.from(content);
      let currentText = '';
      chars.forEach((char, index) => {
        const id = window.setTimeout(() => {
          currentText += char;
          setStreamedSimulation(currentText);
          if (index === chars.length - 1) setIsSimulating(false);
        }, index * 15) as unknown as number;
        streamingTimeoutsRef.current.push(id);
      });
    } catch {
      setIsSimulating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce 700ms : se déclenche à chaque changement de Ton / Longueur / Instructions
  useEffect(() => {
    if (simulateDebounceRef.current !== null) window.clearTimeout(simulateDebounceRef.current);
    simulateDebounceRef.current = window.setTimeout(() => {
      runSimulation(aiTone, aiLength, aiCustomInstructions);
    }, 700) as unknown as number;
    return () => {
      if (simulateDebounceRef.current !== null) window.clearTimeout(simulateDebounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiTone, aiLength, aiCustomInstructions]);

  const handleSaveAIConfig = async () => {
    // Annuler le debounce en cours pour éviter un double-appel
    if (simulateDebounceRef.current !== null) {
      window.clearTimeout(simulateDebounceRef.current);
      simulateDebounceRef.current = null;
    }
    setSavingAiPreferences(true);
    try {
      const resSave = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiTone, aiLength, aiSafeMode, aiCustomInstructions: aiCustomInstructions.trim() }),
      });
      if (!resSave.ok) {
        const errData = await resSave.json().catch(() => ({}));
        throw new Error(errData.error ?? 'Erreur sauvegarde');
      }
      toast.success('Configuration enregistrée');
      runSimulation(aiTone, aiLength, aiCustomInstructions);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour');
      setIsSimulating(false);
    } finally {
      setSavingAiPreferences(false);
    }
  };

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
      toast.success('Notifications enregistrées !');
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
                        : "Choix enregistré. Vous profitez de ZÉNITH jusqu'à la fin de votre essai.",
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
                {selectedPlan === 'vision' && !changePlanLoading && <span className="text-blue-200 text-xs font-medium">? Ton futur plan</span>}
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
                        : "Choix enregistré. Vous profitez de ZÉNITH jusqu'à la fin de votre essai.",
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
                {selectedPlan === 'pulse' && !changePlanLoading && <span className="text-emerald-300 text-xs font-medium">? Ton futur plan</span>}
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
                        : "Choix enregistré. Vous profitez de ZÉNITH jusqu'à la fin de votre essai.",
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
                {selectedPlan === 'zenith' && !changePlanLoading && <span className="text-amber-200 text-xs font-medium">? Ton futur plan</span>}
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
                    Connecté à {googleLocationName ?? establishmentName}
                  </p>
                  {googleLocationAddress && (
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 truncate">
                      {googleLocationAddress}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                  Non connecté
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
                Non connecté
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
                Non connecté
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
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveAIConfig();
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

          {/* Aperçu en direct - Simulation ADN IA */}
          <div className="flex-1 lg:sticky lg:top-6 lg:self-start rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-slate-50 dark:bg-zinc-900/50 p-5 space-y-3 shadow-[4px_6px_0_rgba(0,0,0,0.04)] dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-400">
                Aperçu en direct
              </p>
              <span
                className={`inline-flex items-center gap-1 rounded-full border border-emerald-500/30 dark:border-emerald-400/30 bg-emerald-500/10 dark:bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300 transition-all ${
                  isSimulating ? 'animate-pulse scale-105' : ''
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Simulé en temps réel
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-800/50 px-4 py-3 text-xs text-slate-600 dark:text-zinc-300 space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                Exemple d&apos;avis client
              </p>
              <p className="italic">
                « {avisExemple} »
              </p>
            </div>
            <div
              className={`rounded-xl border border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-800/50 px-4 py-3 text-sm text-slate-700 dark:text-zinc-100 shadow-sm dark:shadow-none relative overflow-hidden transition-all ${
                isSimulating ? 'opacity-90 blur-[0.5px]' : ''
              }`}
            >
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Réponse IA simulée
              </p>
              <p className="whitespace-pre-line font-normal">
                {streamedSimulation || simulationResponse || (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    Modifiez le ton, la longueur ou les instructions pour voir la simulation se mettre à jour automatiquement.
                  </span>
                )}
              </p>
              {isSimulating && (
                <span className="absolute bottom-3 right-4 inline-flex items-center gap-1 text-[10px] text-slate-400">
                  <span className="w-1 h-1 bg-slate-400 rounded-full animate-pulse" />
                  Génération de la réponse IA...
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              La simulation se met à jour automatiquement (700ms après chaque modification) et également à chaque clic sur Enregistrer.
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

      {/* ── Identité — Email ── */}
      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm dark:shadow-none p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-zinc-100 leading-tight">
              Identité
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">Adresse email associée à votre compte</p>
          </div>
        </div>

        <div className="space-y-4 max-w-xl">
          {/* Email actuel */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              Adresse email actuelle
            </label>
            <div className="flex items-center gap-3">
              <input
                type="email"
                value={email}
                readOnly
                tabIndex={-1}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700/60 text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/30 cursor-not-allowed select-none"
              />
              {!showEmailEdit && (
                <button
                  type="button"
                  onClick={() => setShowEmailEdit(true)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700/60 active:scale-[0.98] transition-all duration-200"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Modifier
                </button>
              )}
            </div>
          </div>

          {/* Formulaire changement email */}
          {showEmailEdit && (
            <form onSubmit={handleSaveEmail} className="space-y-4 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 p-4">
              {/* Message info */}
              <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/40 px-3.5 py-3">
                <Info className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  Un lien de confirmation sera envoyé à votre{' '}
                  <strong>ancienne ET nouvelle adresse</strong>. Le changement ne sera effectif
                  qu&apos;après validation des deux.
                </p>
              </div>

              <div>
                <label htmlFor="new-email" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                  Nouvel email
                </label>
                <input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="nouvelle@adresse.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-blue-500/30 focus:border-primary transition-all duration-200"
                />
              </div>

              <div>
                <label htmlFor="confirm-email" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                  Confirmer le nouvel email
                </label>
                <input
                  id="confirm-email"
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="nouvelle@adresse.com"
                  className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 transition-all duration-200 ${
                    confirmEmail && confirmEmail !== newEmail
                      ? 'border-red-400 dark:border-red-500 focus:ring-red-300/30'
                      : 'border-slate-200 dark:border-zinc-700 focus:ring-[#2563eb]/30 dark:focus:ring-blue-500/30 focus:border-primary'
                  }`}
                />
                {confirmEmail && confirmEmail !== newEmail && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                    Les adresses ne correspondent pas.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={savingEmail || !newEmail || newEmail !== confirmEmail}
                  className="flex items-center gap-2 py-2.5 px-5 rounded-xl font-semibold text-sm text-white bg-primary hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 dark:focus:ring-offset-zinc-900 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all duration-200"
                >
                  {savingEmail ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  Envoyer les liens de confirmation
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailEdit(false);
                    setNewEmail('');
                    setConfirmEmail('');
                  }}
                  className="py-2.5 px-4 rounded-xl text-sm font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ── Sécurité — Mot de passe ── */}
      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm dark:shadow-none p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center flex-shrink-0">
            <Lock className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-zinc-100 leading-tight">
              Sécurité
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">Changement de mot de passe</p>
          </div>
        </div>

        <form onSubmit={handleSavePassword} className="space-y-4 max-w-xl">
          {/* Mot de passe actuel */}
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              Mot de passe actuel
            </label>
            <PasswordField
              id="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
              showPassword={showCurrentPassword}
              onToggleVisibility={() => setShowCurrentPassword((v) => !v)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {/* Nouveau mot de passe */}
          <div>
            <label htmlFor="settings-new-password" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              Nouveau mot de passe
            </label>
            <PasswordField
              id="settings-new-password"
              value={newPassword}
              onChange={setNewPassword}
              showPassword={showNewPassword}
              onToggleVisibility={() => setShowNewPassword((v) => !v)}
              minLength={6}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">Minimum 6 caractères.</p>
          </div>

          {/* Confirmation */}
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              Confirmer le nouveau mot de passe
            </label>
            <PasswordField
              id="confirm-password"
              value={confirmNewPassword}
              onChange={setConfirmNewPassword}
              showPassword={showConfirmPassword}
              onToggleVisibility={() => setShowConfirmPassword((v) => !v)}
              placeholder="••••••••"
              autoComplete="new-password"
              error={
                confirmNewPassword && confirmNewPassword !== newPassword
                  ? 'Les mots de passe ne correspondent pas.'
                  : undefined
              }
            />
          </div>

          <button
            type="submit"
            disabled={
              savingAccount ||
              !currentPassword ||
              !newPassword ||
              newPassword.length < 6 ||
              newPassword !== confirmNewPassword
            }
            className="flex items-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm text-white bg-primary hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 dark:focus:ring-offset-zinc-900 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all duration-200"
          >
            {savingAccount ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            {savingAccount ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
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
                    doSaveProfile(payload as { fullName: string; establishmentName: string; establishmentType: string; address: string; phone: string }, null);
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
                    doSaveProfile(payload as { fullName: string; establishmentName: string; establishmentType: string; address: string; phone: string }, loc);
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
