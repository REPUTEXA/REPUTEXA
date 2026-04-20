'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/site-url';
import { clientSignOutWithServerSession } from '@/lib/auth/client-sign-out';
import { Loader2, Mic, Mail, Fingerprint, Pencil, Info, ShieldCheck, Download, Trash2, KeyRound } from 'lucide-react';
import { ReputexaReviewBoostCard } from '@/components/dashboard/reputexa-review-boost-card';
import { StripePortalButton } from '@/components/dashboard/stripe-portal-button';
import { PhoneInput, isValidPhoneNumber } from '@/components/phone-input';
import { SecurityKeysPanel } from '@/components/auth/security-keys-panel';
import { SettingsSkeleton } from '@/components/auth/settings-skeleton';
import { getLanguageFromPhone } from '@/lib/language-from-phone';
import {
  SITE_LOCALE_CODES,
  SITE_LOCALE_NATIVE_LABEL,
  siteLocaleToIntlDateTag,
} from '@/lib/i18n/site-locales-catalog';
import { toast } from 'sonner';

const GOOGLE_BUSINESS_SCOPE = 'https://www.googleapis.com/auth/business.manage';

function countInvalidFormControls(form: HTMLFormElement): number {
  const nodes = form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    'input:not([type="hidden"]), select, textarea',
  );
  let n = 0;
  for (const el of Array.from(nodes)) {
    if (!el.willValidate || el.disabled) continue;
    if (!el.validity.valid) n += 1;
  }
  return n;
}

export default function SettingsPage() {
  const t = useTranslations('Dashboard.settings');
  const tReviewBoost = useTranslations('Dashboard.reviewBoost');
  const reviewExamples = useMemo(
    () => [
      t('reviewEx0'),
      t('reviewEx1'),
      t('reviewEx2'),
      t('reviewEx3'),
      t('reviewEx4'),
      t('reviewEx5'),
      t('reviewEx6'),
    ],
    [t],
  );
  const reviewExamplesRef = useRef(reviewExamples);
  reviewExamplesRef.current = reviewExamples;
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
  // Email change
  const [showEmailEdit, setShowEmailEdit] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [bananoPinConfigured, setBananoPinConfigured] = useState(false);
  const [showBananoPinPanel, setShowBananoPinPanel] = useState(false);
  const [bananoCurrentPin, setBananoCurrentPin] = useState('');
  const [bananoNewPin, setBananoNewPin] = useState('');
  const [bananoNewPin2, setBananoNewPin2] = useState('');
  const [savingBananoPin, setSavingBananoPin] = useState(false);
  const [sendingBananoReset, setSendingBananoReset] = useState(false);
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
  const [country, setCountry] = useState('');
  const [reputexaReviewDone, setReputexaReviewDone] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingAiPreferences, setSavingAiPreferences] = useState(false);
  const [_googleErrorShown, _setGoogleErrorShown] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [gdprExporting, setGdprExporting] = useState(false);
  const [gdprDeleting, setGdprDeleting] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // Vocal-to-style (ADN IA) state
  const [aiVoiceRecording, setAiVoiceRecording] = useState(false);
  const [aiVoiceLoading, setAiVoiceLoading] = useState(false);
  const aiMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const aiStreamRef = useRef<MediaStream | null>(null);
  const aiChunksRef = useRef<Blob[]>([]);

  // Simulation ADN IA en temps réel
  const [avisExempleIndex, setAvisExempleIndex] = useState(0);
  const avisExemple = reviewExamples[avisExempleIndex] ?? reviewExamples[0] ?? '';
  const [simulationResponse, setSimulationResponse] = useState('');
  const [streamedSimulation, setStreamedSimulation] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const streamingTimeoutsRef = useRef<number[]>([]);
  const simulateDebounceRef = useRef<number | null>(null);
  const avisIndexRef = useRef(0);

  const reviewBoostDisplayName = useMemo(() => {
    const fn = fullName.trim();
    if (!fn) return '';
    const parts = fn.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const initial = parts[parts.length - 1]?.charAt(0) ?? '';
      return `${parts[0]} ${initial}.`.trim();
    }
    return parts[0] ?? '';
  }, [fullName]);

  const reviewBoostNameFinal = useMemo(
    () =>
      reviewBoostDisplayName ||
      (establishmentName.trim() ? establishmentName.slice(0, 80) : '') ||
      tReviewBoost('anonymousName'),
    [reviewBoostDisplayName, establishmentName, tReviewBoost],
  );

  useEffect(() => {
    fetch('/api/profile')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok || data.error) {
          throw new Error(data.error ?? t('errLoadProfile'));
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
        if (typeof data.bananoPinConfigured === 'boolean') {
          setBananoPinConfigured(data.bananoPinConfigured);
        }
        if (typeof data.country === 'string') setCountry(data.country);
        setReputexaReviewDone(Boolean(data.reputexaPlatformReviewSubmittedAt));
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : t('errLoadProfile')))
      .finally(() => setLoadingProfile(false));
  }, [t]);

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
            if (!res.ok) throw new Error(data.error ?? t('errTranscription'));
            const transcript = String(data.transcript ?? '').trim();
            if (!transcript) {
              toast.error(t('errNoTranscript'));
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
              throw new Error(prefJson.error ?? t('errGeneric'));
            }
            if (prefJson.aiTone) setAiTone(prefJson.aiTone);
            if (prefJson.aiLength) setAiLength(prefJson.aiLength);
            if (typeof prefJson.aiCustomInstructions === 'string') {
              setAiCustomInstructions(prefJson.aiCustomInstructions);
            }
            toast.success(t('toastVoicePrefsOk'));
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : t('errVoiceAnalyzeFallback'),
            );
          } finally {
            setAiVoiceLoading(false);
          }
        };
        recorder.start();
        aiMediaRecorderRef.current = recorder;
        setAiVoiceRecording(true);
      })
      .catch(() => toast.error(t('errMicDenied')));
  };

  const doSaveProfile = async (payload: { fullName: string; establishmentName: string; establishmentType: string; address: string; phone: string }, languageOverride: string | null) => {
    setSavingProfile(true);
    try {
      const effectiveLang = languageOverride ?? profileLanguage;
      const body: Record<string, string> = {
        fullName: payload.fullName,
        establishmentName: payload.establishmentName,
        establishmentType: payload.establishmentType,
        address: payload.address,
        phone: payload.phone,
        language: effectiveLang,
      };
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error ?? t('errSaveProfile');
        toast.error(msg);
        return;
      }
      toast.success(t('toastProfileSaved'));
      if (languageOverride) {
        router.replace(`/${languageOverride}/dashboard/settings`);
      } else {
        router.refresh();
      }
      setProfileLanguage(effectiveLang);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('errSaveProfile');
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      const n = countInvalidFormControls(form);
      if (n > 0) toast.error(t('errorsCount', { count: n }));
      form.reportValidity();
      return;
    }
    if (phone.trim() && !isValidPhoneNumber(phone)) {
      toast.error(t('errPhoneInvalid'));
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
      toast.error(t('errEmailMismatch'));
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
            : t('errEmailUpdate'),
        );
      }
      toast.success(t('toastEmailConfirmSent'));
      setShowEmailEdit(false);
      setNewEmail('');
      setConfirmEmail('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('errEmailUpdate');
      toast.error(msg);
    } finally {
      setSavingEmail(false);
    }
  };

  const handleBananoPinChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      const n = countInvalidFormControls(form);
      if (n > 0) toast.error(t('errorsCount', { count: n }));
      form.reportValidity();
      return;
    }
    if (bananoNewPin.length < 4 || bananoNewPin !== bananoNewPin2) {
      toast.error(t('errBananoPinRule'));
      return;
    }
    setSavingBananoPin(true);
    try {
      const res = await fetch('/api/banano/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change',
          currentPin: bananoCurrentPin,
          newPin: bananoNewPin,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : t('errBananoPinUpdate'));
      }
      toast.success(t('toastBananoPinOk'));
      setShowBananoPinPanel(false);
      setBananoCurrentPin('');
      setBananoNewPin('');
      setBananoNewPin2('');
      setBananoPinConfigured(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errGeneric'));
    } finally {
      setSavingBananoPin(false);
    }
  };

  const handleBananoPinResetRequest = async () => {
    setSendingBananoReset(true);
    try {
      const res = await fetch('/api/banano/pin/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === 'string' ? json.error : t('errBananoResetEmail'),
        );
      }
      if (json.sent === false && json.reason === 'Email service not configured') {
        toast.info(t('toastDevBananoReset'));
        return;
      }
      toast.success(t('toastBananoResetSent'));
      setShowBananoPinPanel(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errGeneric'));
    } finally {
      setSendingBananoReset(false);
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
      toast.error(err instanceof Error ? err.message : t('errGoogleConnect'));
    } finally {
      setGoogleConnecting(false);
    }
  }, [locale, t]);

  const handleGoogleDisconnect = async () => {
    setGoogleDisconnecting(true);
    try {
      const res = await fetch('/api/google-business/disconnect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      setGoogleLocationId(null);
      setGoogleLocationName(null);
      setGoogleLocationAddress(null);
      toast.success(t('toastGoogleDisconnected'));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errGeneric'));
    } finally {
      setGoogleDisconnecting(false);
    }
  };

  const handleFacebookConnect = () => {
    toast.info(t('infoFacebookSoon'));
  };

  const handleTrustpilotConnect = () => {
    toast.info(t('infoTrustpilotSoon'));
  };

  const handleGdprExport = async () => {
    setGdprExporting(true);
    try {
      const res = await fetch('/api/user/gdpr/export');
      const text = await res.text();
      if (!res.ok) {
        let msg = t('errGdprExportDefault');
        try {
          const j = JSON.parse(text) as { error?: string };
          if (j.error) msg = j.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = t('gdprExportFilename', { timestamp: Date.now() });
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('toastGdprExportOk'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errGdprExportDefault'));
    } finally {
      setGdprExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    const deleteConfirmWord = t('gdprDeleteConfirmWord').trim();
    if (deleteConfirmInput.trim() !== deleteConfirmWord) {
      toast.error(t('errDeleteConfirmToast', { word: deleteConfirmWord }));
      return;
    }
    setGdprDeleting(true);
    try {
      const res = await fetch('/api/user/gdpr/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: deleteConfirmWord }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? t('errGeneric'));
      toast.success(t('toastAccountDeleted'));
      await clientSignOutWithServerSession();
      router.push(`/${locale}/login`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errGeneric'));
    } finally {
      setGdprDeleting(false);
    }
  };

  useEffect(() => {
    if (searchParams?.get('from') !== 'google') return;
    const run = async () => {
      try {
        const res = await fetch('/api/google-business/save', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
        setGoogleLocationId(data.googleLocationId);
        setGoogleLocationName(data.googleLocationName);
        setGoogleLocationAddress(data.googleLocationAddress);
        toast.success(t('toastGoogleConnected'));
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
  }, [searchParams, router, pathname, t]);

  // Fonction de simulation - appelee par debounce et par handleSaveAIConfig
  const runSimulation = useCallback(async (ton: string, longueur: string, instructions: string) => {
    streamingTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    streamingTimeoutsRef.current = [];
    setIsSimulating(true);
    setStreamedSimulation(``);
    setSimulationResponse(``);

    const samples = reviewExamplesRef.current;
    const n = samples.length;
    let next = n > 0 ? Math.floor(Math.random() * n) : 0;
    if (n > 1 && next === avisIndexRef.current) {
      next = (next + 1) % n;
    }
    avisIndexRef.current = next;
    setAvisExempleIndex(next);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ton,
          longueur,
          instructions,
          avis: samples[next] ?? '',
          language: locale,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t('errSimulation'));

      const content = String(data.content ?? '')
        .replace(/\[Consignes\s*:.*?\]/gi, '')
        .replace(/reputexa/gi, t('simulationBrandReplace'))
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
  }, [t, locale]);

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
        body: JSON.stringify({
          aiTone,
          aiLength,
          aiSafeMode,
          aiCustomInstructions: aiCustomInstructions.trim(),
        }),
      });
      if (!resSave.ok) {
        const errData = await resSave.json().catch(() => ({}));
        throw new Error(errData.error ?? t('errAiSave'));
      }
      toast.success(t('toastAiConfigSaved'));
      router.refresh();
      runSimulation(aiTone, aiLength, aiCustomInstructions);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('errAiUpdate'));
      setIsSimulating(false);
    } finally {
      setSavingAiPreferences(false);
    }
  };

  const handleSaveNotifications = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      const n = countInvalidFormControls(form);
      if (n > 0) toast.error(t('errorsCount', { count: n }));
      form.reportValidity();
      return;
    }
    if (whatsappPhone.trim() && !isValidPhoneNumber(whatsappPhone)) {
      toast.error(t('errWhatsappInvalid'));
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
        toast.error(data?.error ?? t('errNotificationsSave'));
        return;
      }
      toast.success(t('toastNotificationsSaved'));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errNetwork'));
    } finally {
      setSavingNotifications(false);
    }
  };

  if (loadingProfile) return <SettingsSkeleton />;
  const isFacebookConnected = false;
  const isTrustpilotConnected = false;
  const connectedCount = [isGoogleConnected, isFacebookConnected, isTrustpilotConnected].filter(Boolean).length;
  const connectionScoreLabel = t('connectionScore', { active: connectedCount, total: 3 });
  const connectionScorePercent = (connectedCount / 3) * 100;
  const formattedTrialEnd =
    trialEndsAt
      ? new Date(trialEndsAt).toLocaleDateString(siteLocaleToIntlDateTag(locale), {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;

  return (
    <div className="px-4 sm:px-6 py-6 space-y-8">
      <header>
        <h1 className="text-[1.65rem] font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
          {t('title')}
        </h1>
        <p className="mt-2 text-[15px] text-slate-500 dark:text-zinc-400 leading-relaxed">{t('description')}</p>
      </header>

      {!loadingProfile && !reputexaReviewDone ? (
        <ReputexaReviewBoostCard
          defaultDisplayName={reviewBoostNameFinal}
          defaultRoleLine={tReviewBoost('defaultRoleLine', {
            establishment: establishmentName.trim() || t('placeholderEstablishmentName'),
          })}
          defaultCountryLabel={country}
          defaultFlagEmoji=""
          onCompleted={() => setReputexaReviewDone(true)}
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04] dark:shadow-none p-6">
        <h2 className="font-semibold text-[17px] tracking-tight text-slate-900 dark:text-zinc-100 mb-5">{t('sectionProfileTitle')}</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl" autoComplete="off">
          <div>
            <label htmlFor="settings-fullname" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              {t('labelFullName')}
            </label>
            <input
              id="settings-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="off"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-indigo-500 transition-all duration-200"
              placeholder={t('placeholderFullName')}
            />
          </div>
          <div>
            <label htmlFor="settings-name" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              {t('labelEstablishmentName')}
            </label>
            <input
              id="settings-name"
              type="text"
              value={establishmentName}
              onChange={(e) => setEstablishmentName(e.target.value)}
              autoComplete="off"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-indigo-500 transition-all duration-200"
              placeholder={t('placeholderEstablishmentName')}
            />
          </div>
          <div>
            <label htmlFor="settings-establishment-type" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              {t('labelEstablishmentType')} <span className="text-red-500">{t('establishmentTypeRequired')}</span>
            </label>
            <input
              id="settings-establishment-type"
              type="text"
              value={establishmentType}
              onChange={(e) => setEstablishmentType(e.target.value)}
              required
              autoComplete="off"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-indigo-500 transition-all duration-200"
              placeholder={t('placeholderEstablishmentType')}
            />
          </div>
          <div>
            <label htmlFor="settings-address" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              {t('labelAddress')}
            </label>
            <input
              id="settings-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="off"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-indigo-500 transition-all duration-200"
              placeholder={t('placeholderAddress')}
            />
          </div>
          <div>
            <label htmlFor="settings-phone" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              {t('labelPhone')}
            </label>
            <PhoneInput
              id="settings-phone"
              value={phone}
              onChange={(v) => setPhone(v ?? '')}
              placeholder={t('placeholderPhone')}
            />
          </div>
          <div>
            <label
              htmlFor="settings-email-language"
              className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5"
            >
              {t('emailLanguageLabel')}
            </label>
            <select
              id="settings-email-language"
              value={profileLanguage}
              onChange={(e) => setProfileLanguage(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-indigo-500 transition-all duration-200"
            >
              {SITE_LOCALE_CODES.map((code) => (
                <option key={code} value={code}>
                  {SITE_LOCALE_NATIVE_LABEL[code]}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              {t('emailLanguageHint')}
            </p>
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="py-3 px-6 rounded-xl font-semibold text-white bg-primary hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
          >
            {savingProfile ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('saving')}
              </>
            ) : (
              t('save')
            )}
          </button>
        </form>
      </section>

      <section id="billing" className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04] dark:shadow-none p-6">
        <h2 className="font-semibold text-[17px] tracking-tight text-slate-900 dark:text-zinc-100 mb-5">
          {t('sectionBillingTitle')}
        </h2>
        {subscriptionStatus === 'trialing' && (
          <div className="mb-4 p-4 rounded-xl bg-slate-50/90 dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-700/80 ring-1 ring-black/[0.02] dark:ring-white/[0.03]">
            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 mb-2 tracking-tight">
              {t('trialPickPlanTitle')}
            </p>
            <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4 leading-relaxed">
              {t('trialPickPlanDescription')}
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
                    if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
                    toast.success(
                      formattedTrialEnd
                        ? t('trialChoiceSavedWithDate', { date: formattedTrialEnd })
                        : t('trialChoiceSavedNoDate'),
                    );
                    const profileRes = await fetch('/api/profile', { credentials: 'include' });
                    const profileData = await profileRes.json().catch(() => ({}));
                    if (profileData.selectedPlan !== undefined) setSelectedPlan(profileData.selectedPlan);
                    if (profileData.subscriptionStatus !== undefined) setSubscriptionStatus(profileData.subscriptionStatus ?? null);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : t('errChangePlan'));
                  } finally {
                    setChangePlanLoading(null);
                  }
                }}
                className={`inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:pointer-events-none transition-all bg-primary hover:brightness-110 ${
                  selectedPlan === 'vision' ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-zinc-900' : ''
                }`}
              >
                {changePlanLoading === 'vision' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('planVision')}
                {selectedPlan === 'vision' && !changePlanLoading && (
                  <span className="ml-2 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
                    {t('planChosenBadge')}
                  </span>
                )}
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
                    if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
                    toast.success(
                      formattedTrialEnd
                        ? t('trialChoiceSavedWithDate', { date: formattedTrialEnd })
                        : t('trialChoiceSavedNoDate'),
                    );
                    const profileRes = await fetch('/api/profile', { credentials: 'include' });
                    const profileData = await profileRes.json().catch(() => ({}));
                    if (profileData.selectedPlan !== undefined) setSelectedPlan(profileData.selectedPlan);
                    if (profileData.subscriptionStatus !== undefined) setSubscriptionStatus(profileData.subscriptionStatus ?? null);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : t('errChangePlan'));
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
                {t('planPulse')}
                {selectedPlan === 'pulse' && !changePlanLoading && (
                  <span className="ml-2 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
                    {t('planChosenBadge')}
                  </span>
                )}
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
                    if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
                    toast.success(
                      formattedTrialEnd
                        ? t('trialChoiceSavedWithDate', { date: formattedTrialEnd })
                        : t('trialChoiceSavedNoDate'),
                    );
                    const profileRes = await fetch('/api/profile', { credentials: 'include' });
                    const profileData = await profileRes.json().catch(() => ({}));
                    if (profileData.selectedPlan !== undefined) setSelectedPlan(profileData.selectedPlan);
                    if (profileData.subscriptionStatus !== undefined) setSubscriptionStatus(profileData.subscriptionStatus ?? null);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : t('errChangePlan'));
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
                {t('planZenith')}
                {selectedPlan === 'zenith' && !changePlanLoading && (
                  <span className="ml-2 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
                    {t('planChosenBadge')}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
          {t('billingStripeHelp')}
        </p>
        <StripePortalButton
          locale={locale}
          onError={(err) => toast.error(err.message || t('errStripePortal'))}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04] dark:shadow-none p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-semibold text-[17px] tracking-tight text-slate-900 dark:text-zinc-100">
              {t('sectionPlatformsTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              {t('sectionPlatformsSubtitle')}
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1">
            <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              {t('scoreConnectionLabel')} {connectionScoreLabel}
            </p>
            <div className="w-40 h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-500 transition-all"
                style={{ width: `${connectionScorePercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="sm:hidden mb-4">
          <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
            {t('scoreConnectionLabel')} {connectionScoreLabel}
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
                  {t('googleBusinessTitle')}
                </p>
              </div>
              {isGoogleConnected ? (
                <>
                  <p className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
                    {t('connectedTo', { name: googleLocationName ?? establishmentName })}
                  </p>
                  {googleLocationAddress && (
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 truncate">
                      {googleLocationAddress}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                  {t('notConnected')}
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
                  {googleDisconnecting ? '...' : t('manage')}
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
                  <span>{t('connectAccount')}</span>
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
                  {t('brandFacebook')}
                </p>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                {t('notConnected')}
              </p>
            </div>
            <div className="flex shrink-0">
              <button
                type="button"
                onClick={handleFacebookConnect}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white"
                style={{ backgroundColor: '#1877F2' }}
              >
                {t('connectAccount')}
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
                  {t('brandTrustpilot')}
                </p>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                {t('notConnected')}
              </p>
            </div>
            <div className="flex shrink-0">
              <button
                type="button"
                onClick={handleTrustpilotConnect}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white"
                style={{ backgroundColor: '#00B67A' }}
              >
                {t('connectAccount')}
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-4">
          {t('platformsFooter')}
        </p>
      </section>

      {/* Personnalisation IA de réponse aux avis */}
      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04] dark:shadow-none p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveAIConfig();
            }}
            className="flex-1 space-y-4"
          >
            <h2 className="font-semibold text-[17px] tracking-tight text-slate-900 dark:text-zinc-100 mb-1">
              {t('aiDnaTitle')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-3">
              {t('aiDnaSubtitle')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                  {t('toneLabel')}
                </label>
                <select
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value as typeof aiTone)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-indigo-500"
                >
                  <option value="professional">{t('toneProfessional')}</option>
                  <option value="warm">{t('toneWarm')}</option>
                  <option value="casual">{t('toneCasual')}</option>
                  <option value="luxury">{t('toneLuxury')}</option>
                  <option value="humorous">{t('toneHumorous')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                  {t('lengthLabel')}
                </label>
                <select
                  value={aiLength}
                  onChange={(e) => setAiLength(e.target.value as typeof aiLength)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-indigo-500"
                >
                  <option value="concise">{t('lengthConcise')}</option>
                  <option value="balanced">{t('lengthBalanced')}</option>
                  <option value="detailed">{t('lengthDetailed')}</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                {t('instructionsLabel')}
              </label>
              <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                <div className="flex-1">
                  <textarea
                    rows={4}
                    value={aiCustomInstructions}
                    onChange={(e) => setAiCustomInstructions(e.target.value)}
                    placeholder={t('instructionsPlaceholder')}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-indigo-500"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    {t('instructionsHint')}
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
                      {t('voiceAnalyzing')}
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2" />
                      {aiVoiceRecording ? t('voiceFinishRecording') : t('voiceSpeakToAi')}
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
                  {t('saving')}
                </>
              ) : (
                t('save')
              )}
            </button>
          </form>

          <div className="flex-1 lg:sticky lg:top-6 lg:self-start rounded-2xl border border-slate-200/90 dark:border-zinc-800/50 bg-slate-50/80 dark:bg-zinc-900/50 p-5 space-y-3 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
                {t('previewLive')}
              </p>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 dark:border-emerald-400/25 bg-emerald-500/[0.08] dark:bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 transition-opacity ${
                  isSimulating ? 'opacity-95' : ''
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${isSimulating ? 'animate-pulse' : ''}`} />
                {t('simulationBadge')}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-800/50 px-4 py-3 text-xs text-slate-600 dark:text-zinc-300 space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {t('exampleReviewTitle')}
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
                {t('simulatedResponseTitle')}
              </p>
              <p className="whitespace-pre-line font-normal">
                {streamedSimulation || simulationResponse || (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {t('simulationEmptyHint')}
                  </span>
                )}
              </p>
              {isSimulating && (
                <span className="absolute bottom-3 right-4 inline-flex items-center gap-1 text-[10px] text-slate-400">
                  <span className="w-1 h-1 bg-slate-400 rounded-full animate-pulse" />
                  {t('simulationGenerating')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('simulationFooter')}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04] dark:shadow-none p-6">
        <h2 className="font-semibold text-[17px] tracking-tight text-slate-900 dark:text-zinc-100 mb-5">{t('sectionNotificationsTitle')}</h2>
        <form onSubmit={handleSaveNotifications} className="space-y-4 max-w-xl">
          <div>
            <label htmlFor="settings-whatsapp" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              {t('labelWhatsapp')}
            </label>
            <PhoneInput
              id="settings-whatsapp"
              value={whatsappPhone}
              onChange={(v) => setWhatsappPhone(v ?? '')}
              placeholder={t('placeholderPhone')}
            />
            <p className="text-xs text-slate-500 mt-1">{t('whatsappHelp')}</p>
          </div>
          <div>
            <label htmlFor="settings-alert-threshold" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              {t('labelAlertThreshold')}
            </label>
            <select
              id="settings-alert-threshold"
              value={alertThresholdStars}
              onChange={(e) => setAlertThresholdStars(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-indigo-500"
            >
              <option value={2}>{t('alertLt2')}</option>
              <option value={3}>{t('alertLt3')}</option>
              <option value={4}>{t('alertLt4')}</option>
              <option value={5}>{t('alertLt5')}</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">{t('alertThresholdHelp')}</p>
          </div>
          <button
            type="submit"
            disabled={savingNotifications}
            className="py-3 px-6 rounded-xl font-semibold text-white bg-primary hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
          >
            {savingNotifications ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('saving')}
              </>
            ) : (
              t('save')
            )}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04] dark:shadow-none p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="font-semibold text-[17px] tracking-tight text-slate-900 dark:text-zinc-100 leading-tight">
              {t('sectionIdentityTitle')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">{t('identityEmailSubtitle')}</p>
          </div>
        </div>

        <div className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              {t('labelCurrentEmail')}
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
                  {t('edit')}
                </button>
              )}
            </div>
          </div>

          {showEmailEdit && (
            <form onSubmit={handleSaveEmail} className="space-y-4 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 p-4">
              <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/40 px-3.5 py-3">
                <Info className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  {t('emailChangePart1')}
                  <strong>{t('emailChangeStrong')}</strong>
                  {t('emailChangePart2')}
                </p>
              </div>

              <div>
                <label htmlFor="new-email" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                  {t('labelNewEmail')}
                </label>
                <input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder={t('placeholderNewEmail')}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-blue-500/30 focus:border-primary transition-all duration-200"
                />
              </div>

              <div>
                <label htmlFor="confirm-email" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                  {t('labelConfirmEmail')}
                </label>
                <input
                  id="confirm-email"
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder={t('placeholderNewEmail')}
                  className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 transition-all duration-200 ${
                    confirmEmail && confirmEmail !== newEmail
                      ? 'border-red-400 dark:border-red-500 focus:ring-red-300/30'
                      : 'border-slate-200 dark:border-zinc-700 focus:ring-[#2563eb]/30 dark:focus:ring-blue-500/30 focus:border-primary'
                  }`}
                />
                {confirmEmail && confirmEmail !== newEmail && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                    {t('emailMismatchHint')}
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
                  {t('sendConfirmationLinks')}
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
                  {t('cancel')}
                </button>
              </div>
            </form>
          )}

          <div className="border-t border-slate-200 dark:border-zinc-800 pt-6 mt-2">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <KeyRound className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[15px] text-slate-900 dark:text-zinc-100">
                  {t('bananoPinTitle')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5 leading-relaxed">
                  {t('bananoPinSubtitle')}
                </p>
              </div>
            </div>

            {!bananoPinConfigured ? (
              <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                {t('bananoPinUnset')}
              </p>
            ) : (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value="••••••••"
                    aria-label={t('ariaPinConfigured')}
                    className="flex-1 min-w-[8rem] max-w-xs px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700/60 text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/30 cursor-default select-none tracking-widest font-mono"
                  />
                  {!showBananoPinPanel && (
                    <button
                      type="button"
                      onClick={() => setShowBananoPinPanel(true)}
                      className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700/60 active:scale-[0.98] transition-all duration-200"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {t('edit')}
                    </button>
                  )}
                </div>

                {showBananoPinPanel && (
                  <div className="mt-4 space-y-4 rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/15 p-4">
                    <div className="flex items-start gap-2.5 rounded-lg border border-slate-200/80 dark:border-zinc-700/60 bg-white/70 dark:bg-zinc-900/40 px-3.5 py-3">
                      <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed space-y-2">
                        <p>{t('bananoChangeLine1')}</p>
                        <p>{t('bananoChangeLine2', { email })}</p>
                      </div>
                    </div>

                    <form onSubmit={handleBananoPinChange} className="space-y-3">
                      <div>
                        <label
                          htmlFor="banano-settings-current"
                          className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5"
                        >
                          {t('labelCurrentPin')}
                        </label>
                        <input
                          id="banano-settings-current"
                          type="password"
                          inputMode="numeric"
                          autoComplete="off"
                          pattern="\d*"
                          maxLength={8}
                          value={bananoCurrentPin}
                          onChange={(e) => setBananoCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30"
                          placeholder={t('pinPlaceholder')}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="banano-settings-new"
                          className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5"
                        >
                          {t('labelNewPin')}
                        </label>
                        <input
                          id="banano-settings-new"
                          type="password"
                          inputMode="numeric"
                          autoComplete="new-password"
                          pattern="\d*"
                          maxLength={8}
                          value={bananoNewPin}
                          onChange={(e) => setBananoNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30"
                          placeholder={t('pinPlaceholder')}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="banano-settings-new2"
                          className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5"
                        >
                          {t('labelConfirmNewPin')}
                        </label>
                        <input
                          id="banano-settings-new2"
                          type="password"
                          inputMode="numeric"
                          autoComplete="new-password"
                          pattern="\d*"
                          maxLength={8}
                          value={bananoNewPin2}
                          onChange={(e) => setBananoNewPin2(e.target.value.replace(/\D/g, '').slice(0, 8))}
                          className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 font-mono tracking-widest focus:outline-none focus:ring-2 transition-all ${
                            bananoNewPin2 && bananoNewPin2 !== bananoNewPin
                              ? 'border-red-400 dark:border-red-500 focus:ring-red-300/30'
                              : 'border-slate-200 dark:border-zinc-700 focus:ring-[#2563eb]/30'
                          }`}
                          placeholder={t('pinPlaceholder')}
                        />
                        {bananoNewPin2 && bananoNewPin2 !== bananoNewPin && (
                          <p className="text-xs text-red-500 dark:text-red-400 mt-1">{t('pinMismatch')}</p>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                        <button
                          type="submit"
                          disabled={
                            savingBananoPin ||
                            bananoCurrentPin.length < 4 ||
                            bananoNewPin.length < 4 ||
                            bananoNewPin !== bananoNewPin2
                          }
                          className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl font-semibold text-sm text-white bg-primary hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 dark:focus:ring-offset-zinc-900 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all duration-200"
                        >
                          {savingBananoPin ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                          {t('saveNewPin')}
                        </button>
                        <button
                          type="button"
                          onClick={handleBananoPinResetRequest}
                          disabled={sendingBananoReset}
                          className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-800/50 hover:bg-slate-50 dark:hover:bg-zinc-700/50 disabled:opacity-50 transition-all"
                        >
                          {sendingBananoReset ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                          {t('forgotPinEmail')}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowBananoPinPanel(false);
                          setBananoCurrentPin('');
                          setBananoNewPin('');
                          setBananoNewPin2('');
                        }}
                        className="text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                      >
                        {t('close')}
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04] dark:shadow-none p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center flex-shrink-0">
            <Fingerprint className="w-4 h-4 text-[#2563eb] dark:text-sky-400" />
          </div>
          <div>
            <h2 className="font-semibold text-[17px] tracking-tight text-slate-900 dark:text-zinc-100 leading-tight">
              {t('sectionSecurityTitle')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">{t('sectionSecuritySubtitle')}</p>
          </div>
        </div>

        <SecurityKeysPanel />
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04] dark:shadow-none p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-slate-600 dark:text-zinc-400" />
          </div>
          <div>
            <h2 className="font-semibold text-[17px] tracking-tight text-slate-900 dark:text-zinc-100">
              {t('sectionGdprTitle')}
            </h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
              {t('sectionGdprSubtitle')}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <button
            type="button"
            onClick={handleGdprExport}
            disabled={gdprExporting}
            className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold text-sm text-white bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
          >
            {gdprExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {t('gdprDownloadJson')}
          </button>
        </div>

        <div className="rounded-xl border border-red-200/80 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-5 space-y-4">
          <p className="text-sm font-semibold text-red-900 dark:text-red-200">
            {t('gdprDeleteTitle')}
          </p>
          <p className="text-xs text-red-800/90 dark:text-red-300/90 leading-relaxed">
            {t('gdprDeleteWarning')}
          </p>
          <div>
            <label htmlFor="delete-confirm" className="block text-xs font-medium text-red-900 dark:text-red-200 mb-1.5">
              {t('gdprDeleteType')}{' '}
              <span className="font-mono font-bold">{t('gdprDeleteConfirmWord')}</span> {t('gdprDeleteToConfirm')}
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              autoComplete="off"
              className="w-full max-w-xs px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-sm"
              placeholder={t('gdprDeleteConfirmWord')}
            />
          </div>
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={gdprDeleting || deleteConfirmInput.trim() !== t('gdprDeleteConfirmWord').trim()}
            className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {gdprDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {t('gdprDeleteConfirm')}
          </button>
        </div>
      </section>

      {showLanguageModal && suggestedLocale && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="language-modal-title"
        >
          <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-xl border border-slate-200 dark:border-zinc-700 p-6 max-w-md w-full">
            <h3 id="language-modal-title" className="font-semibold text-lg text-slate-900 dark:text-zinc-100 mb-2">
              {t('languageModalTitle')}
            </h3>
            <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
              {t('languageModalBody', {
                localeName: t(`localeName.${suggestedLocale}` as 'localeName.fr'),
              })}
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
                {t('no')}
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
                {t('yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
