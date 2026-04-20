'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { useRouter, Link } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';
import { DashboardInlineLoading } from '@/components/dashboard/dashboard-inline-loading';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Plus,
  Minus,
  X,
  Loader2,
  CheckCircle2,
  Link2Off,
  Trash2,
  Pencil,
  Star,
  Building2,
  ExternalLink,
  Store,
  CreditCard,
  Sparkles,
  Cog,
  Mic,
  ShieldCheck,
} from 'lucide-react';
import { PhoneInput, isValidPhoneNumber } from '@/components/phone-input';
import {
  getPriceAfterDiscount,
  getDiscountForIndex,
  getProratedAmount,
  getTotalMonthlyPrice,
  getTotalAnnualPrice,
  getProratedExpansionAmount,
  getProratedExpansionAmountAnnual,
  PLAN_PRICES,
} from '@/lib/establishments';
import { type PlanSlug } from '@/lib/feature-gate';
import { useActiveLocationOptional } from '@/lib/active-location-context';
import { useSubscription, SUBSCRIPTION_QUERY_KEY, fetchSubscription } from '@/lib/use-subscription';
import { SubscriptionSkeleton } from '@/components/dashboard/subscription-skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  isStripeValidationErrorCode,
  stripeValidationErrorToApiStripeKey,
} from '@/lib/validations/stripe-api-error';

const PLAN_DISPLAY_I18N_KEY: Record<PlanSlug, 'planDisplayFree' | 'planDisplayVision' | 'planDisplayPulse' | 'planDisplayZenith'> = {
  free: 'planDisplayFree',
  vision: 'planDisplayVision',
  pulse: 'planDisplayPulse',
  zenith: 'planDisplayZenith',
};

/** Transitions Framer Motion (API), hors JSX pour le linter. */
const FRAMER_SPRING_CARD = { type: 'spring' as const, damping: 24, stiffness: 400 };
const FRAMER_SPRING_PANEL = { type: 'spring' as const, damping: 28, stiffness: 300 };
const FRAMER_SPRING_MODAL = { type: 'spring' as const, damping: 25, stiffness: 300 };

type GoogleLocation = { id: string; fullName: string; name: string; address: string | null };

type Establishment = {
  id: string;
  name: string;
  establishmentType?: string | null;
  address: string | null;
  googleStatus: 'connected' | 'disconnected';
  googleLocationName: string | null;
  avgRating: number | null;
  priceAfterDiscount: number;
  discountPercent: number;
  index: number;
  isPrincipal: boolean;
  needsConfiguration?: boolean;
};

type ApiResponse = {
  establishments: Establishment[];
  planSlug: PlanSlug;
  basePrice: number;
  totalSavings: number;
  subscriptionQuantity: number;
};

export default function EstablishmentsPage() {
  const t = useTranslations('Dashboard.establishments');
  const tStripeErr = useTranslations('ApiStripe.errors');
  const locale = useLocale();
  const formatMoney = useCallback(
    (value: number) =>
      new Intl.NumberFormat(siteLocaleToIntlDateTag(locale), {
        style: 'currency',
        currency: 'EUR',
      }).format(value),
    [locale]
  );
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalAddOpen, setModalAddOpen] = useState(false);
  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Establishment | null>(null);
  const [editName, setEditName] = useState('');
  const [editEstablishmentType, setEditEstablishmentType] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [addName, setAddName] = useState('');
  const [addAddress, setAddAddress] = useState('');
  const [adding, setAdding] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editSheetMounted, setEditSheetMounted] = useState(false);
  const [profilePrefsLoading, setProfilePrefsLoading] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editAlertThreshold, setEditAlertThreshold] = useState(3);
  const [editAiTone, setEditAiTone] = useState<'professional' | 'warm' | 'casual' | 'luxury' | 'humorous'>('professional');
  const [editAiLength, setEditAiLength] = useState<'concise' | 'balanced' | 'detailed'>('balanced');
  const [editAiSafeMode, setEditAiSafeMode] = useState(true);
  const [editAiCustomInstructions, setEditAiCustomInstructions] = useState('');
  const [editAiVoiceRecording, setEditAiVoiceRecording] = useState(false);
  const [editAiVoiceLoading, setEditAiVoiceLoading] = useState(false);
  const editAiMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const editAiStreamRef = useRef<MediaStream | null>(null);
  const editAiChunksRef = useRef<Blob[]>([]);
  const [addMode, setAddMode] = useState<'choice' | 'google' | 'manual'>('choice');
  const [googleLocations, setGoogleLocations] = useState<GoogleLocation[]>([]);
  const [googleLocationsLoading, setGoogleLocationsLoading] = useState(false);
  const [googleNeedsReconnect, setGoogleNeedsReconnect] = useState(false);
  const [selectedGoogleLoc, setSelectedGoogleLoc] = useState<GoogleLocation | null>(null);
  const [addSuccessId, setAddSuccessId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [establishmentToDelete, setEstablishmentToDelete] = useState<Establishment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [limitReachedModalOpen, setLimitReachedModalOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [reducePortalLoading, setReducePortalLoading] = useState(false);
  const [_switchToAnnualLoading, _setSwitchToAnnualLoading] = useState(false);
  const [singleExpansionLoading, setSingleExpansionLoading] = useState(false);
  const [_bulkTargetQuantity, setBulkTargetQuantity] = useState(1);
  const [expansionAddCount, setExpansionAddCount] = useState(1);
  const [expansionPreviewAmount, setExpansionPreviewAmount] = useState<number | null>(null);
  const [expansionPreviewLoading, setExpansionPreviewLoading] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [slotHealLoading, setSlotHealLoading] = useState(false);
  const [_expansionRedirecting, _setExpansionRedirecting] = useState(false);
  const upgradedWithOpenConfigRef = useRef(false);
  const toastShownRef = useRef<Set<string>>(new Set());
  const TOAST_SUPPRESS_MS = 15000;
  const shouldShowToastOnce = useCallback((key: string) => {
    if (toastShownRef.current.has(key)) return false;
    if (typeof window !== 'undefined') {
      const raw = sessionStorage.getItem(`toast_${key}`);
      const last = raw ? parseInt(raw, 10) : 0;
      if (last && Date.now() - last < TOAST_SUPPRESS_MS) return false;
    }
    toastShownRef.current.add(key);
    if (typeof window !== 'undefined') sessionStorage.setItem(`toast_${key}`, String(Date.now()));
    return true;
  }, []);

  const activeLocation = useActiveLocationOptional();
  const subscription = useSubscription();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  function fireConfetti() {
    void import('canvas-confetti').then((mod) => {
      const confetti = mod.default;
      const duration = 2000;
      const end = Date.now() + duration;
      const colors = ['#10b981', '#059669', '#34d399', '#a7f3d0', '#d1fae5'];
      const interval = setInterval(() => {
        if (Date.now() >= end) {
          clearInterval(interval);
          return;
        }
        confetti({
          particleCount: 4,
          startVelocity: 45,
          spread: 100,
          origin: { x: Math.random(), y: 0.6 },
          colors,
          zIndex: 9999,
        });
      }, 120);
    }).catch(() => {});
  }

  const fetchEstablishments = useCallback(async (): Promise<ApiResponse | null> => {
    try {
      const res = await fetch('/api/establishments');
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? t('errLoad'));
      }
      const json: ApiResponse = await res.json();
      setData(json);
      return json;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errGeneric'));
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void (async () => {
      /** Stripe + établissements en parallèle : navigation plus rapide qu’en série. */
      await Promise.all([
        queryClient
          .fetchQuery({ queryKey: SUBSCRIPTION_QUERY_KEY, queryFn: fetchSubscription })
          .catch(() => {
            /* Stripe indisponible — le GET établissements utilise quand même le profil */
          }),
        fetchEstablishments(),
      ]);
    })();
  }, [fetchEstablishments, queryClient]);

  useEffect(() => {
    setEditSheetMounted(true);
  }, []);

  useEffect(() => {
    if (!modalEditOpen) return;
    let cancelled = false;
    setProfilePrefsLoading(true);
    void fetch('/api/profile')
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok || json.error) return;
        if (cancelled) return;
        if (typeof json.phone === 'string') setEditPhone(json.phone);
        if (typeof json.whatsappPhone === 'string') setEditWhatsapp(json.whatsappPhone);
        if (typeof json.alertThresholdStars === 'number') setEditAlertThreshold(json.alertThresholdStars);
        if (json.aiTone) setEditAiTone(json.aiTone);
        if (json.aiLength) setEditAiLength(json.aiLength);
        if (typeof json.aiSafeMode === 'boolean') setEditAiSafeMode(json.aiSafeMode);
        if (typeof json.aiCustomInstructions === 'string') setEditAiCustomInstructions(json.aiCustomInstructions);
      })
      .finally(() => {
        if (!cancelled) setProfilePrefsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modalEditOpen]);

  const handleEditDrawerAiVoiceToggle = () => {
    if (editAiMediaRecorderRef.current?.state === 'recording') {
      editAiMediaRecorderRef.current.stop();
      editAiMediaRecorderRef.current = null;
      editAiStreamRef.current?.getTracks().forEach((t) => t.stop());
      editAiStreamRef.current = null;
      setEditAiVoiceRecording(false);
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        editAiStreamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        editAiChunksRef.current = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) editAiChunksRef.current.push(ev.data);
        };
        recorder.onstop = async () => {
          if (editAiChunksRef.current.length === 0) return;
          setEditAiVoiceLoading(true);
          try {
            const blob = new Blob(editAiChunksRef.current, { type: 'audio/webm' });
            const form = new FormData();
            form.append('audio', blob);
            const res = await fetch('/api/suggestions/transcribe', { method: 'POST', body: form });
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
                aiTone: editAiTone,
                aiLength: editAiLength,
                aiCustomInstructions: editAiCustomInstructions,
              }),
            });
            const prefJson = await prefRes.json();
            if (!prefRes.ok) throw new Error(prefJson.error ?? t('errAiVoice'));
            if (prefJson.aiTone) setEditAiTone(prefJson.aiTone);
            if (prefJson.aiLength) setEditAiLength(prefJson.aiLength);
            if (typeof prefJson.aiCustomInstructions === 'string') {
              setEditAiCustomInstructions(prefJson.aiCustomInstructions);
            }
            toast.success(t('toastVoicePrefsOk'));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : t('errVoiceAnalyze'));
          } finally {
            setEditAiVoiceLoading(false);
          }
        };
        recorder.start();
        editAiMediaRecorderRef.current = recorder;
        setEditAiVoiceRecording(true);
      })
      .catch(() => toast.error(t('errMicDenied')));
  };

  // Retour Stripe : revalidation, confetti si upgraded, ouverture config premier slot si openConfig=1 (chaque toast une seule fois)
  useEffect(() => {
    const status = searchParams?.get('status');
    const returnFlow = searchParams?.get('return_flow');
    const openConfig = searchParams?.get('openConfig') === '1';
    if (returnFlow === 'reduce') {
      if (shouldShowToastOnce('establishments_reduce')) {
        toast.info(t('toastReduceNextInvoice'), {
          duration: 6000,
          className: 'border-slate-300 dark:border-slate-600',
        });
      }
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      router.replace('/dashboard/establishments', { scroll: false });
      fetchEstablishments();
      return;
    }
    if (status !== 'upgraded' && status !== 'establishment_added') return;
    if (status === 'upgraded') {
      if (shouldShowToastOnce('establishments_upgraded')) {
        fireConfetti();
        toast.success(t('toastSlotsUnlocked'), {
          duration: 5000,
          className: 'border-emerald-500/30',
        });
      }
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    }
    if (status === 'establishment_added' && shouldShowToastOnce('establishments_added')) {
      toast.success(t('toastEstablishmentAdded'), {
        duration: 6000,
        className: 'border-emerald-500/30',
      });
    }
    router.refresh();
    fetchEstablishments().then((json) => {
      if (status === 'upgraded' && openConfig && !upgradedWithOpenConfigRef.current && json?.establishments) {
        upgradedWithOpenConfigRef.current = true;
        const toConfigure = json.establishments.find((e) => e.needsConfiguration);
        if (toConfigure) {
          setTimeout(() => openEdit(toConfigure), 400);
        }
      }
    });
  }, [searchParams, router, fetchEstablishments, queryClient, shouldShowToastOnce, t]);

  // Quand on ouvre la modale expansion, initialiser à +1
  useEffect(() => {
    if (limitReachedModalOpen) {
      const current = subscription.quantity;
      setBulkTargetQuantity(Math.min(15, current + 1));
      setExpansionAddCount(1);
      setExpansionPreviewAmount(null);
    }
  }, [limitReachedModalOpen, subscription.quantity]);

  // Prorata dynamique depuis Stripe (pas de calcul manuel)
  useEffect(() => {
    if (!limitReachedModalOpen || expansionAddCount < 1) return;
    setExpansionPreviewLoading(true);
    fetch(`/api/stripe/preview-expansion?expansionAddCount=${expansionAddCount}`)
      .then((r) => r.json())
      .then((json) => {
        if (typeof json.amountDue === 'number') setExpansionPreviewAmount(json.amountDue);
        else setExpansionPreviewAmount(null);
      })
      .catch(() => setExpansionPreviewAmount(null))
      .finally(() => setExpansionPreviewLoading(false));
  }, [limitReachedModalOpen, expansionAddCount]);

  const fetchGoogleLocations = useCallback(async () => {
    setGoogleLocationsLoading(true);
    setGoogleNeedsReconnect(false);
    setGoogleLocations([]);
    try {
      const res = await fetch('/api/google-business/list-locations');
      const json = await res.json().catch(() => ({}));
      if (json.locations) setGoogleLocations(json.locations);
      if (json.needsReconnect) setGoogleNeedsReconnect(true);
    } catch {
      setGoogleNeedsReconnect(true);
    } finally {
      setGoogleLocationsLoading(false);
    }
  }, []);

  const _openAddModal = useCallback(() => {
    const subsQty = subscription.quantity;
    const visibleCount = Math.min(subsQty, (data?.establishments ?? []).length);
    if (visibleCount >= subsQty) {
      setLimitReachedModalOpen(true);
      return;
    }
    setAddMode('choice');
    setAddName('');
    setAddAddress('');
    setSelectedGoogleLoc(null);
    setModalAddOpen(true);
    fetchGoogleLocations();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- data?.establishments intentionally omitted to avoid unnecessary re-creations
  }, [fetchGoogleLocations, subscription.quantity, data?.establishments?.length]);

  const closeAddModal = useCallback(() => {
    if (!adding) {
      setModalAddOpen(false);
      setAddMode('choice');
      setSelectedGoogleLoc(null);
      setAddName('');
      setAddAddress('');
    }
  }, [adding]);

  const getPayload = (): { name: string; address?: string; googleLocationId?: string; googleLocationName?: string; googleLocationAddress?: string } => {
    if (addMode === 'google' && selectedGoogleLoc) {
      return {
        name: selectedGoogleLoc.name,
        address: selectedGoogleLoc.address ?? undefined,
        googleLocationId: selectedGoogleLoc.fullName,
        googleLocationName: selectedGoogleLoc.name,
        googleLocationAddress: selectedGoogleLoc.address ?? undefined,
      };
    }
    return { name: addName.trim(), address: addAddress.trim() || undefined };
  };

  const canSubmit = (): boolean => {
    if (addMode === 'google') return !!selectedGoogleLoc;
    return addName.trim().length >= 2;
  };

  const displayNameForRecap = (): string => {
    if (addMode === 'google' && selectedGoogleLoc) return selectedGoogleLoc.name;
    return addName.trim() || t('newEstablishmentDefaultName');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit()) {
      toast.error(t('errNameMin'));
      return;
    }
    const payload = getPayload();
    if (!payload.name || payload.name.length < 2) {
      toast.error(t('errNameMin'));
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/establishments/add-with-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403 && json.limitReached) {
          setModalAddOpen(false);
          setLimitReachedModalOpen(true);
          return;
        }
        throw new Error(json.error ?? t('errGeneric'));
      }

      const newId = json.establishment?.id;
      setAddName('');
      setAddAddress('');
      setSelectedGoogleLoc(null);
      setModalAddOpen(false);
      setAddMode('choice');
      await fetchEstablishments();
      window.dispatchEvent(new Event('establishments-updated'));
      if (activeLocation) {
        await activeLocation.refreshLocations();
        if (newId) activeLocation.setActiveLocationId(newId);
      }
      setAddSuccessId(newId ?? null);
      toast.success(t('toastEstablishmentActivated'));
      setTimeout(() => setAddSuccessId(null), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errGeneric'));
    } finally {
      setAdding(false);
    }
  };

  const setAsDefault = async (e: Establishment) => {
    setSettingDefaultId(e.id);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultEstablishmentId: e.id === 'profile' ? null : e.id,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? t('errGeneric'));
      toast.success(e.id === 'profile' ? t('toastDefaultProfile') : t('toastDefaultEstablishment'));
      await fetchEstablishments();
      window.dispatchEvent(new Event('establishments-updated'));
      if (activeLocation) await activeLocation.refreshLocations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errGeneric'));
    } finally {
      setSettingDefaultId(null);
    }
  };

  /** Ouvre la modale d’ÉDITION (PATCH) pour un établissement déjà en base (id réel). Jamais de création. */
  const openEdit = (e: Establishment) => {
    setEditingItem(e);
    setEditName(e.needsConfiguration ? '' : e.name);
    setEditEstablishmentType(e.establishmentType ?? '');
    setEditAddress(e.address || '');
    setModalEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editName.trim() || editName.trim().length < 2) {
      toast.error(t('errNameMin'));
      return;
    }
    const phoneTrim = editPhone.trim();
    if (phoneTrim && !isValidPhoneNumber(phoneTrim)) {
      toast.error(t('errPhoneInvalid'));
      return;
    }
    const waTrim = editWhatsapp.trim();
    if (waTrim && !isValidPhoneNumber(waTrim)) {
      toast.error(t('errWhatsappInvalid'));
      return;
    }
    setSavingEdit(true);
    try {
      const isProfileRow = editingItem.id === 'profile';

      if (!isProfileRow) {
        const res = await fetch(`/api/establishments/${editingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editName.trim(), address: editAddress.trim() || undefined }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? t('errGeneric'));
      }

      const profileBody: Record<string, string | number | boolean> = {
        aiTone: editAiTone,
        aiLength: editAiLength,
        aiSafeMode: editAiSafeMode,
        aiCustomInstructions: editAiCustomInstructions.trim(),
        phone: phoneTrim,
        whatsappPhone: waTrim,
        alertThresholdStars: editAlertThreshold,
      };
      if (isProfileRow) {
        profileBody.establishmentName = editName.trim();
        profileBody.establishmentType = editEstablishmentType.trim();
        profileBody.address = editAddress.trim() || '';
      }

      const resProfile = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileBody),
      });
      const jsonProfile = await resProfile.json().catch(() => ({}));
      if (!resProfile.ok) throw new Error(jsonProfile.error ?? t('errGeneric'));

      toast.success(t('toastPrefsSaved'));
      setModalEditOpen(false);
      setEditingItem(null);
      await fetchEstablishments();
      window.dispatchEvent(new Event('establishments-updated'));
      if (activeLocation) await activeLocation.refreshLocations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errGeneric'));
    } finally {
      setSavingEdit(false);
    }
  };

  const openDeleteModal = (est: Establishment) => {
    if (est.id === 'profile') {
      toast.error(t('errHeadquartersDelete'));
      return;
    }
    setEstablishmentToDelete(est);
    setDeleteConfirmText('');
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (!deleting) {
      setDeleteModalOpen(false);
      setEstablishmentToDelete(null);
      setDeleteConfirmText('');
    }
  };

  const _openBulkCheckout = async (targetQuantity: number) => {
    setPortalLoading(true);
    try {
      const res = await fetch(`/api/stripe/create-bulk-session?locale=${locale}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetQuantity }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.url) window.location.href = json.url;
      else throw new Error(json.error ?? t('errGeneric'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errPaymentOpen'));
    } finally {
      setPortalLoading(false);
    }
  };

  const openBulkExpansion = async () => {
    // On envoie uniquement le nombre à ajouter ; l'API récupère la quantité réelle chez Stripe et calcule le total.
    setPortalLoading(true);
    try {
      const res = await fetch(`/api/stripe/create-bulk-expansion?locale=${locale}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ expansionAddCount }),
      });
      const json = await res.json().catch(() => ({}));
      // Redirection vers hosted_invoice_url : montant au prorata (paliers dégressifs) déjà calculé par Stripe.
      if (json.url) window.location.href = json.url;
      else {
        const msg = isStripeValidationErrorCode(json.error)
          ? tStripeErr(stripeValidationErrorToApiStripeKey(json.error))
          : typeof json.error === 'string' && json.error.trim()
            ? json.error
            : t('errGeneric');
        throw new Error(msg);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errPaymentOpen'));
    } finally {
      setPortalLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!establishmentToDelete || establishmentToDelete.id === 'profile') return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/establishments/${establishmentToDelete.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? t('errGeneric'));
      toast.success(t('toastEstablishmentDeleted'));
      setDeleteModalOpen(false);
      setEstablishmentToDelete(null);
      await fetchEstablishments();
      window.dispatchEvent(new Event('establishments-updated'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errGeneric'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <DashboardInlineLoading />;
  }

  const establishmentsRaw = data?.establishments ?? [];
  const allEstablishments = [...establishmentsRaw].sort((a, b) => (b.isPrincipal ? 1 : 0) - (a.isPrincipal ? 1 : 0));
  const subscriptionQuantity = subscription.isError ? 1 : subscription.quantity;
  // Stripe = master : on n'affiche que les N premiers (N = quota payé). Les autres sont archivés.
  const visibleEstablishments = allEstablishments.slice(0, subscriptionQuantity);
  const archivedCount = Math.max(0, allEstablishments.length - subscriptionQuantity);
  const _atLimit = visibleEstablishments.length >= subscriptionQuantity;
  const planSlug = (data?.planSlug ?? subscription.planSlug) as PlanSlug;
  const basePrice = data?.basePrice ?? PLAN_PRICES[planSlug];
  const totalSavings = data?.totalSavings ?? 0;
  const _totalMonthlyPrice = getTotalMonthlyPrice(planSlug, visibleEstablishments.length);
  const nextIndex = visibleEstablishments.length;
  const nextDiscount = getDiscountForIndex(nextIndex);
  const nextPrice = getPriceAfterDiscount(basePrice, nextIndex);
  const proratedAmount = getProratedAmount(nextPrice);
  const totalNextMonth = getTotalMonthlyPrice(planSlug, visibleEstablishments.length + 1);
  const planDisplayName = t(PLAN_DISPLAY_I18N_KEY[planSlug]);
  const isAnnualBilling = subscription.interval === 'year';

  const emptySlotsCount = Math.max(0, subscriptionQuantity - visibleEstablishments.length);

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8 max-w-5xl mx-auto space-y-6">
      {/* Message élégant si Stripe indisponible (Apple-style) */}
      {subscription.isError && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {t('subscriptionLoadError')}
          </p>
          <button
            type="button"
            onClick={() => subscription.refetch()}
            className="text-sm font-semibold text-amber-700 dark:text-amber-300 hover:underline"
          >
            {t('retryCta')}
          </button>
        </div>
      )}
      {/* Header — X / Y établissements + plan */}
      <header>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-50">
                {t('title')}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t('planBadgePrefix')} {planDisplayName}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 min-h-[1.25rem] flex items-center">
              {subscription.isLoading ? (
                <SubscriptionSkeleton />
              ) : (
                <>
                  {t('establishmentsCountLabel', {
                    current: visibleEstablishments.length,
                    max: subscriptionQuantity,
                  })}
                </>
              )}
              {!subscription.isLoading && archivedCount > 0 && (
                <span className="ml-2 text-amber-600 dark:text-amber-400 text-xs">
                  {t('beyondQuota', { count: archivedCount })}
                </span>
              )}
              {!subscription.isLoading && totalSavings > 0 && (
                <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  {t('savingsPerMonthLine', {
                    amount: formatMoney(totalSavings),
                    perMonth: t('perMonthShort'),
                  })}
                </span>
              )}
            </p>
            {/* Ancien bouton de passage en annuel supprimé */}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {!subscription.isLoading && !subscription.isError && (
                <button
                  type="button"
                  onClick={async () => {
                    setSingleExpansionLoading(true);
                    try {
                      const res = await fetch(`/api/stripe/create-expansion-session?locale=${locale}`, {
                        method: 'POST',
                        credentials: 'include',
                      });
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(json.error ?? t('errGeneric'));
                      if (json.url) {
                        window.location.href = json.url as string;
                      } else {
                        toast.error(json.error ?? t('errStripePage'));
                      }
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : t('errAddSlot'));
                    } finally {
                      setSingleExpansionLoading(false);
                    }
                  }}
                  disabled={singleExpansionLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 disabled:opacity-50"
                >
                  {singleExpansionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {t('addSlotCta')}
                </button>
              )}
              {!subscription.isLoading && (subscriptionQuantity > visibleEstablishments.length || visibleEstablishments.length > 0) && (
                <button
                  type="button"
                  onClick={async () => {
                    setReducePortalLoading(true);
                    try {
                      const res = await fetch(`/api/stripe/portal?locale=${locale}&flow=reduce-quota`, { method: 'POST' });
                      const json = await res.json().catch(() => ({}));
                      if (json.url) window.location.href = json.url;
                      else toast.error(json.error ?? t('errBillingPortal'));
                    } finally {
                      setReducePortalLoading(false);
                    }
                  }}
                  disabled={reducePortalLoading}
                  className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline underline-offset-2 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {reducePortalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {t('reduceQuotaCta')}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Grille : Configurées (visible) | Emplacement disponible | Upsell — AnimatePresence pour transition fluide à l'ajout d'un slot */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout" initial={false}>
          {visibleEstablishments.map((e) => (
            <motion.div
              key={e.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={FRAMER_SPRING_CARD}
              className={`group rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 p-5 flex flex-col ${
                addSuccessId === e.id ? 'ring-2 ring-emerald-500/60' : ''
              } ${e.needsConfiguration ? 'border-amber-300 dark:border-amber-500/50 bg-amber-50/30 dark:bg-amber-500/5' : ''}`}
            >
            <div
              className={`flex flex-col flex-1 min-w-0 ${e.needsConfiguration ? 'cursor-pointer' : 'cursor-default'}`}
              role={e.needsConfiguration ? 'button' : undefined}
              onClick={e.needsConfiguration ? () => openEdit(e) : undefined}
              tabIndex={e.needsConfiguration ? 0 : undefined}
              onKeyDown={e.needsConfiguration ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openEdit(e); } } : undefined}
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{e.name}</h3>
                {e.needsConfiguration && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/40">
                    <Cog className="w-3 h-3" />
                    {t('badgeConfigure')}
                  </span>
                )}
                {e.isPrincipal && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/40">
                    {t('badgePrincipal')}
                  </span>
                )}
                {e.id === 'profile' && !e.isPrincipal && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                    {t('badgeSiege')}
                  </span>
                )}
              </div>
              {e.address && (
                <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 mb-2">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{e.address}</span>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-auto">
                {e.googleStatus === 'connected' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t('statusConfigured')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <Link2Off className="w-3.5 h-3.5" />
                    {t('statusPending')}
                  </span>
                )}
                {e.avgRating != null && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {e.avgRating}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t('pricePerMonthShort', {
                  amount: formatMoney(e.priceAfterDiscount),
                  perMonth: t('perMonthShort'),
                })}
                {e.discountPercent > 0 && <span className="text-emerald-600 dark:text-emerald-400"> (-{e.discountPercent}%)</span>}
              </p>
              {e.discountPercent > 0 && (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {t('savingsVsBase', {
                    amount: formatMoney(basePrice - e.priceAfterDiscount),
                    perMonth: t('perMonthShort'),
                  })}
                </p>
              )}
              {e.needsConfiguration && (
                <button
                  type="button"
                  onClick={(ev) => { ev.stopPropagation(); openEdit(e); }}
                  className="mt-4 w-full py-3 px-4 rounded-xl font-semibold text-sm bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-600 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Cog className="w-4 h-4 shrink-0" aria-hidden />
                  {t('configureSlotButton')}
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              {e.isPrincipal ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/15 border border-amber-200/80 dark:border-amber-500/40">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {t('defaultSlotBadge')}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void setAsDefault(e)}
                  disabled={settingDefaultId !== null}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:border-amber-400 hover:bg-amber-50/80 dark:hover:bg-amber-500/10 dark:hover:border-amber-500/50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                >
                  {settingDefaultId === e.id ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Star className="w-4 h-4 shrink-0 text-amber-500" />}
                  {t('setDefaultCta')}
                </button>
              )}
              <button
                type="button"
                onClick={() => openEdit(e)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                aria-label={t('ariaEdit')}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => openDeleteModal(e)}
                disabled={e.id === 'profile'}
                className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={t('ariaDelete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
          ))}

          {/* Slots sans ligne DB (webhook retardé ou désalignement) — synchro + heal côté API */}
          {Array.from({ length: emptySlotsCount }, (_, i) => (
            <motion.div
              key={`pending-${i}`}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={FRAMER_SPRING_CARD}
              className="rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-500/40 bg-amber-50/40 dark:bg-amber-500/5 p-6 flex flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-400 min-h-[180px]"
            >
              <Cog className="w-8 h-8 text-amber-600 dark:text-amber-400 opacity-90" />
              <span className="font-medium text-sm text-center text-slate-800 dark:text-slate-200">
                {t('emptySlotTitle')}
              </span>
              <span className="text-xs text-center max-w-[220px]">
                {t('emptySlotHint')}
              </span>
              <button
                type="button"
                disabled={slotHealLoading}
                onClick={async () => {
                  setSlotHealLoading(true);
                  try {
                    await queryClient.fetchQuery({ queryKey: SUBSCRIPTION_QUERY_KEY, queryFn: fetchSubscription });
                    await subscription.refetch();
                    await fetchEstablishments();
                    toast.success(t('toastSlotsSynced'));
                  } catch {
                    toast.error(t('toastRetrySoon'));
                  } finally {
                    setSlotHealLoading(false);
                  }
                }}
                className="mt-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 disabled:opacity-50 shadow-sm"
              >
                {slotHealLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {t('emptySlotCta')}
              </button>
            </motion.div>
          ))}

          {/* Carte promotionnelle "Ajouter un nouvel emplacement" désactivée */}
        </AnimatePresence>
      </section>

      {/* Emplacements désactivés (suite à un downgrade) : données conservées, accès limités au quota */}
      {!subscription.isLoading && archivedCount > 0 && (
        <section className="rounded-2xl border border-amber-200 dark:border-amber-500/40 bg-amber-50/50 dark:bg-amber-500/10 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">
            {t('archivedSectionTitle', { count: archivedCount })}
          </h2>
          <p className="text-sm text-amber-800/90 dark:text-amber-100/85 mb-4 leading-relaxed">
            {archivedCount === 1 ? t('archivedBodyOne') : t('archivedBodyMany')}{' '}
            {t('archivedBodyRest')}
          </p>
          <ul className="space-y-3">
            {allEstablishments.slice(subscriptionQuantity).map((e) => (
              <li
                key={e.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-200/70 dark:border-amber-500/30 bg-white/60 dark:bg-slate-900/40 p-3 sm:p-4"
              >
                <div className="flex items-start gap-2 min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-400">
                  <Building2 className="w-4 h-4 shrink-0 text-amber-500 dark:text-amber-400 mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{e.name}</span>
                    {e.address && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{e.address}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      toast.success(t('toastDataKeptQuota'), {
                        duration: 5000,
                      });
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-emerald-300 dark:border-emerald-600/50 text-emerald-800 dark:text-emerald-200 bg-emerald-50/90 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    {t('btnKeepData')}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(e)}
                    className="inline-flex items-center justify-center px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {t('btnEdit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeleteModal(e)}
                    disabled={e.id === 'profile'}
                    className="inline-flex items-center justify-center px-3 py-2 rounded-xl text-xs font-semibold border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 bg-red-50/80 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    {t('btnDelete')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Modal Ajouter — style light visible */}
      {modalAddOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={closeAddModal}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('modalAddTitle')}</h2>
              <button
                type="button"
                onClick={closeAddModal}
                aria-label={t('ariaClose')}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 bg-slate-50/30 dark:bg-transparent">
              {/* Choix de la méthode */}
              {addMode === 'choice' && (
                <div className="space-y-3">
                  {googleNeedsReconnect && (
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4">
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        {t('googleReconnectHint')}
                      </p>
                      <Link
                        href="/dashboard/settings"
                        className="inline-flex items-center gap-2 mt-2 text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                      >
                        {t('googleReconnectLink')} <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setAddMode('google')}
                    disabled={googleLocationsLoading || (googleLocations.length === 0 && !googleNeedsReconnect)}
                    className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 text-left transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                      {googleLocationsLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                      ) : (
                        <Building2 className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{t('fromGoogleTitle')}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        {googleLocationsLoading
                          ? t('loadingEllipsis')
                          : googleLocations.length > 0
                            ? t('googleLocationsCount', { count: googleLocations.length })
                            : googleNeedsReconnect
                              ? t('connectGoogleSettings')
                              : t('noLocationsToImport')}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode('manual')}
                    className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-primary/40 flex items-center gap-3 text-left transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{t('manualAddTitle')}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        {t('manualAddSubtitle')}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={closeAddModal}
                    className="w-full py-2.5 rounded-xl font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                </div>
              )}

              {/* Liste Google */}
              {addMode === 'google' && (
                <form onSubmit={handleAdd} className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setAddMode('choice')}
                    className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 mb-2"
                  >
                    {t('backArrow')}
                  </button>
                  {googleLocations.length === 0 && !googleLocationsLoading ? (
                    <p className="text-slate-500 text-sm">
                      {t('noUnimportedGoogle')}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {googleLocations.map((loc) => (
                        <button
                          key={loc.fullName}
                          type="button"
                          onClick={() => setSelectedGoogleLoc(loc)}
                          className={`w-full p-3 rounded-xl border text-left transition-colors ${
                            selectedGoogleLoc?.fullName === loc.fullName
                              ? 'border-primary bg-primary/10 text-slate-900 dark:text-slate-100'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <p className="font-medium text-slate-900 dark:text-slate-100">{loc.name}</p>
                          {loc.address && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{loc.address}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {canSubmit() && (
                    <div className="rounded-xl bg-slate-100/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] p-4 space-y-3">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {t('recapAdding', { name: displayNameForRecap() })}
                        {nextDiscount > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400">{t('discountIncluded', { discount: nextDiscount })}</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <CreditCard className="w-4 h-4 shrink-0 text-primary" />
                        <span>
                          {t('debitTodayProrata', { amount: formatMoney(proratedAmount) })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">
                        {t('thenSubscriptionWillBe', {
                          amount: formatMoney(totalNextMonth),
                          perMonth: t('perMonthShort'),
                        })}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setAddMode('choice')}
                      className="flex-1 py-2.5 rounded-xl font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-100 transition-colors"
                    >
                      {t('back')}
                    </button>
                    <button
                      type="submit"
                      disabled={adding || !canSubmit()}
                      className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-primary hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                    >
                      {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : t('confirmAdd')}
                    </button>
                  </div>
                </form>
              )}

              {/* Formulaire manuel */}
              {addMode === 'manual' && (
                <form onSubmit={handleAdd} className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setAddMode('choice')}
                    className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 mb-2"
                  >
                    {t('backArrow')}
                  </button>
                  <div className="rounded-xl bg-slate-100/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] p-4 mb-4 space-y-2">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {t('manualDiscountBanner', {
                        discount: nextDiscount,
                        amount: formatMoney(nextPrice),
                        perMonth: t('perMonthShort'),
                      })}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="add-name" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                      {t('labelNameRequired')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="add-name"
                      type="text"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      required
                      minLength={2}
                      placeholder={t('placeholderRestaurant')}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="add-address" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                      {t('labelAddress')}
                    </label>
                    <input
                      id="add-address"
                      type="text"
                      value={addAddress}
                      onChange={(e) => setAddAddress(e.target.value)}
                      placeholder={t('placeholderAddress')}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    />
                  </div>
                  {canSubmit() && (
                    <div className="rounded-xl bg-slate-100/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] p-4 space-y-3">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {t('recapAdding', { name: displayNameForRecap() })}
                        {nextDiscount > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400">{t('discountIncluded', { discount: nextDiscount })}</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <CreditCard className="w-4 h-4 shrink-0 text-primary" />
                        <span>{t('debitTodayProrata', { amount: formatMoney(proratedAmount) })}</span>
                      </div>
                      <p className="text-sm text-slate-500">
                        {t('thenSubscriptionWillBe', {
                          amount: formatMoney(totalNextMonth),
                          perMonth: t('perMonthShort'),
                        })}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setAddMode('choice')}
                      className="flex-1 py-2.5 rounded-xl font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-100 transition-colors"
                    >
                      {t('back')}
                    </button>
                    <button
                      type="submit"
                      disabled={adding || !canSubmit()}
                      className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-primary hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                    >
                      {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : t('confirmAdd')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tiroir config — portail body + sous la barre sticky pour éviter tout chevauchement */}
      {editSheetMounted &&
        createPortal(
          <AnimatePresence>
            {modalEditOpen && editingItem && (
              <>
                <motion.div
                  key="establishment-edit-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm"
                  onClick={() => !savingEdit && setModalEditOpen(false)}
                  aria-hidden
                />
                <motion.div
                  key="establishment-edit-panel"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={FRAMER_SPRING_PANEL}
                  className="fixed z-[130] right-0 top-14 sm:top-16 bottom-0 w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
                  onClick={(ev) => ev.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="establishment-edit-title"
                >
                  <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
                    <h2 id="establishment-edit-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100 pr-2">
                      {editingItem.needsConfiguration ? t('titleConfigureEstablishment') : t('titleEditEstablishment')}
                    </h2>
                    <button
                      type="button"
                      onClick={() => !savingEdit && setModalEditOpen(false)}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors shrink-0"
                      aria-label={t('ariaClose')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleEdit} className="p-5 overflow-y-auto flex-1 space-y-5 min-h-0">
                    {profilePrefsLoading && (
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        {t('loadingAccountPrefs')}
                      </div>
                    )}

                    <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1 leading-relaxed">
                      {t.rich('settingsSameAsRich', {
                        settings: (chunks) => (
                          <Link href="/dashboard/settings" className="text-primary font-medium underline underline-offset-2 hover:no-underline">
                            {chunks}
                          </Link>
                        ),
                      })}
                    </p>

                    <div className="space-y-2">
                      <label htmlFor="edit-name" className="block text-sm font-medium text-slate-600 dark:text-slate-300">
                        {t('labelSlotName')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="edit-name"
                        type="text"
                        value={editName}
                        onChange={(ev) => setEditName(ev.target.value)}
                        required
                        minLength={2}
                        placeholder={t('placeholderRestaurant')}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                      />
                    </div>
                    {editingItem.id === 'profile' && (
                      <div className="space-y-2">
                        <label htmlFor="edit-establishment-type" className="block text-sm font-medium text-slate-600 dark:text-slate-300">
                          {t('labelEstablishmentType')}
                        </label>
                        <input
                          id="edit-establishment-type"
                          type="text"
                          value={editEstablishmentType}
                          onChange={(ev) => setEditEstablishmentType(ev.target.value)}
                          placeholder={t('placeholderEstablishmentType')}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <label htmlFor="edit-address" className="block text-sm font-medium text-slate-600 dark:text-slate-300">
                        {t('labelAddress')}
                      </label>
                      <input
                        id="edit-address"
                        type="text"
                        value={editAddress}
                        onChange={(ev) => setEditAddress(ev.target.value)}
                        placeholder={t('placeholderAddress')}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                      />
                    </div>

                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('googleBusinessCard')}</p>
                      {editingItem.googleStatus === 'connected' ? (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          {t('googleConnected')}
                          {editingItem.googleLocationName ? `${t('googleConnectedDetail')}${editingItem.googleLocationName}` : ''}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {t.rich('googleNotConnectedRich', {
                            settings: (chunks) => (
                              <Link href="/dashboard/settings" className="text-primary font-medium underline underline-offset-2 hover:no-underline">
                                {chunks}
                              </Link>
                            ),
                          })}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2 space-y-2">
                        <label htmlFor="edit-phone" className="block text-sm font-medium text-slate-600 dark:text-slate-300">
                          {t('labelPhone')}
                        </label>
                        <PhoneInput id="edit-phone" value={editPhone} onChange={(v) => setEditPhone(v ?? '')} placeholder={t('phonePlaceholder')} />
                      </div>
                      <div className="sm:col-span-2 space-y-2">
                        <label htmlFor="edit-whatsapp" className="block text-sm font-medium text-slate-600 dark:text-slate-300">
                          {t('labelWhatsapp')}
                        </label>
                        <PhoneInput id="edit-whatsapp" value={editWhatsapp} onChange={(v) => setEditWhatsapp(v ?? '')} placeholder={t('phonePlaceholder')} />
                      </div>
                      <div className="sm:col-span-2 space-y-2">
                        <label htmlFor="edit-alert" className="block text-sm font-medium text-slate-600 dark:text-slate-300">
                          {t('labelAlertStars')}
                        </label>
                        <select
                          id="edit-alert"
                          value={editAlertThreshold}
                          onChange={(ev) => setEditAlertThreshold(Number(ev.target.value))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n > 1 ? t('starPlural', { n }) : t('starSingular', { n })}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-4 space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('aiPersonalizationTitle')}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {t('aiPersonalizationHint')}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="edit-ai-tone" className="block text-sm font-medium text-slate-600 dark:text-slate-300">
                            {t('labelTone')}
                          </label>
                          <select
                            id="edit-ai-tone"
                            value={editAiTone}
                            onChange={(ev) => setEditAiTone(ev.target.value as typeof editAiTone)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                          >
                            <option value="professional">{t('toneProfessional')}</option>
                            <option value="warm">{t('toneWarm')}</option>
                            <option value="casual">{t('toneCasual')}</option>
                            <option value="luxury">{t('toneLuxury')}</option>
                            <option value="humorous">{t('toneHumorous')}</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="edit-ai-length" className="block text-sm font-medium text-slate-600 dark:text-slate-300">
                            {t('labelLength')}
                          </label>
                          <select
                            id="edit-ai-length"
                            value={editAiLength}
                            onChange={(ev) => setEditAiLength(ev.target.value as typeof editAiLength)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                          >
                            <option value="concise">{t('lengthConcise')}</option>
                            <option value="balanced">{t('lengthBalanced')}</option>
                            <option value="detailed">{t('lengthDetailed')}</option>
                          </select>
                        </div>
                      </div>
                      <label className="flex items-start gap-3 cursor-pointer rounded-lg p-2 -m-2 hover:bg-slate-100/80 dark:hover:bg-slate-700/30">
                        <input
                          type="checkbox"
                          checked={editAiSafeMode}
                          onChange={(ev) => setEditAiSafeMode(ev.target.checked)}
                          className="mt-1 rounded border-slate-300 text-primary focus:ring-primary/40"
                        />
                        <span>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            {t('safeModeTitle')}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                            {t('safeModeDesc')}
                          </span>
                        </span>
                      </label>
                      <div className="space-y-2">
                        <label htmlFor="edit-ai-instructions" className="block text-sm font-medium text-slate-600 dark:text-slate-300">
                          {t('labelCustomInstructions')}
                        </label>
                        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                          <textarea
                            id="edit-ai-instructions"
                            rows={4}
                            value={editAiCustomInstructions}
                            onChange={(ev) => setEditAiCustomInstructions(ev.target.value)}
                            placeholder={t('placeholderAiInstructions')}
                            className="flex-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                          />
                          <button
                            type="button"
                            onClick={handleEditDrawerAiVoiceToggle}
                            disabled={editAiVoiceLoading}
                            className={`shrink-0 inline-flex items-center justify-center px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                              editAiVoiceRecording
                                ? 'border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                            } disabled:opacity-50`}
                          >
                            {editAiVoiceLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                {t('voiceAnalyzing')}
                              </>
                            ) : (
                              <>
                                <Mic className="w-4 h-4 mr-2" />
                                {editAiVoiceRecording ? t('voiceFinish') : t('voiceDictate')}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2 pb-6">
                      <button
                        type="button"
                        onClick={() => !savingEdit && setModalEditOpen(false)}
                        className="flex-1 py-2.5 rounded-xl font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-100 transition-colors"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        type="submit"
                        disabled={savingEdit || !editName.trim() || editName.trim().length < 2 || profilePrefsLoading}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-primary hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                      >
                        {savingEdit ? <Loader2 className="w-5 h-5 animate-spin" /> : t('save')}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {/* Modale Calculatrice d'Expansion — +N établissements, dégressif, prorata, emerald */}
      <AnimatePresence>
        {limitReachedModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => !portalLoading && setLimitReachedModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={FRAMER_SPRING_MODAL}
              className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-4">
                  <Sparkles className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2 text-center">
                  {t('expansionCalculatorTitle')}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 text-center">
                  {t('expansionCalculatorBody')}
                </p>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    {t('labelCountToAdd')}
                  </label>
                  <div className="flex items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={() => setExpansionAddCount((c) => Math.max(1, c - 1))}
                      disabled={expansionAddCount <= 1 || portalLoading}
                      aria-label={t('ariaDecrementExpansion')}
                      className="flex items-center justify-center w-12 h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:border-emerald-300 dark:hover:border-emerald-500/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <motion.span
                      key={expansionAddCount}
                      initial={{ scale: 1.2 }}
                      animate={{ scale: 1 }}
                      className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100 w-14 text-center"
                    >
                      +{expansionAddCount}
                    </motion.span>
                    <button
                      type="button"
                      onClick={() => setExpansionAddCount((c) => Math.min(15 - subscriptionQuantity, c + 1))}
                      disabled={expansionAddCount >= 15 - subscriptionQuantity || portalLoading}
                      aria-label={t('ariaIncrementExpansion')}
                      className="flex items-center justify-center w-12 h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:border-emerald-300 dark:hover:border-emerald-500/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-2">
                    {t('expansionSitesLine', {
                      sites: subscriptionQuantity,
                      sitesWord:
                        subscriptionQuantity > 1 ? t('expansionSitePlural') : t('expansionSiteSingular'),
                      target: subscriptionQuantity + expansionAddCount,
                    })}
                  </p>
                </div>

                {expansionAddCount >= 1 && (
                  <>
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-3 mb-4 space-y-1">
                      {Array.from({ length: expansionAddCount }, (_, i) => {
                        const idx = subscriptionQuantity + i;
                        const pct = getDiscountForIndex(idx);
                        const label =
                          i === 0
                            ? t('supplementalFirst')
                            : i === 1
                              ? t('supplementalSecond')
                              : t('supplementalNth', { n: i + 1 });
                        return (
                          <motion.p
                            key={`${idx}-${pct}`}
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-sm text-slate-700 dark:text-slate-200 flex justify-between"
                          >
                            <span>{label}</span>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300">-{pct}%</span>
                          </motion.p>
                        );
                      })}
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('totalDueToday')}</p>
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={expansionPreviewLoading ? 'loading' : expansionPreviewAmount ?? (isAnnualBilling ? getProratedExpansionAmountAnnual(planSlug, subscriptionQuantity, subscriptionQuantity + expansionAddCount) : getProratedExpansionAmount(planSlug, subscriptionQuantity, subscriptionQuantity + expansionAddCount))}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100"
                          >
                            {expansionPreviewLoading
                              ? t('loadingEllipsis')
                              : formatMoney(
                                  typeof expansionPreviewAmount === 'number'
                                    ? expansionPreviewAmount
                                    : isAnnualBilling
                                      ? getProratedExpansionAmountAnnual(
                                          planSlug,
                                          subscriptionQuantity,
                                          subscriptionQuantity + expansionAddCount
                                        )
                                      : getProratedExpansionAmount(
                                          planSlug,
                                          subscriptionQuantity,
                                          subscriptionQuantity + expansionAddCount
                                        )
                                )}
                          </motion.p>
                        </AnimatePresence>
                      </div>
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-4">
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">
                          {isAnnualBilling ? t('newSubscriptionAnnual') : t('newSubscriptionMonthly')}
                        </p>
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={isAnnualBilling ? getTotalAnnualPrice(planSlug, subscriptionQuantity + expansionAddCount) : getTotalMonthlyPrice(planSlug, subscriptionQuantity + expansionAddCount)}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="text-xl font-bold tabular-nums text-emerald-800 dark:text-emerald-200"
                          >
                            {formatMoney(
                              isAnnualBilling
                                ? getTotalAnnualPrice(planSlug, subscriptionQuantity + expansionAddCount)
                                : getTotalMonthlyPrice(planSlug, subscriptionQuantity + expansionAddCount)
                            )}
                            {isAnnualBilling ? t('perYearShort') : t('perMonthShort')}
                          </motion.p>
                        </AnimatePresence>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={openBulkExpansion}
                    disabled={portalLoading || expansionAddCount < 1}
                    className="w-full py-3 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {portalLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('generating')}
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        {t('validateAndPay')}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => !portalLoading && setLimitReachedModalOpen(false)}
                    disabled={portalLoading}
                    className="w-full py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    {t('later')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Confirmation Suppression — champ SUPPRIMER requis */}
      {deleteModalOpen && establishmentToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={closeDeleteModal}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 text-center">
                {t('deleteConfirmTitle')}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 text-center">
                {t('deleteConfirmBody', {
                  name: establishmentToDelete.name,
                  word: t('deleteTypeWord'),
                })}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 text-center">
                {t('deleteConfirmFootnote')}
              </p>
              <div className="mb-6">
                <label htmlFor="delete-confirm" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  {t('labelConfirmation')}
                </label>
                <input
                  id="delete-confirm"
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={t('deleteTypeWord')}
                  autoComplete="off"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={
                    deleting ||
                    deleteConfirmText.trim().toLowerCase() !== t('deleteTypeWord').trim().toLowerCase()
                  }
                  className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : t('deleteForever')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
