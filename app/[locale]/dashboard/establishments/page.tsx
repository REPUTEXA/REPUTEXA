'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
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
} from 'lucide-react';
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
import { PLAN_DISPLAY, type PlanSlug } from '@/lib/feature-gate';
import { useActiveLocationOptional } from '@/lib/active-location-context';
import { useSubscription, SUBSCRIPTION_QUERY_KEY } from '@/lib/use-subscription';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
  const [switchToAnnualLoading, setSwitchToAnnualLoading] = useState(false);
  const [bulkTargetQuantity, setBulkTargetQuantity] = useState(1);
  const [expansionAddCount, setExpansionAddCount] = useState(1);
  const [expansionPreviewAmount, setExpansionPreviewAmount] = useState<number | null>(null);
  const [expansionPreviewLoading, setExpansionPreviewLoading] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const upgradedWithOpenConfigRef = useRef(false);

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

  const fetchEstablishments = useCallback(async () => {
    try {
      const res = await fetch('/api/establishments');
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Erreur chargement');
      }
      const json: ApiResponse = await res.json();
      setData(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEstablishments();
  }, [fetchEstablishments]);

  // Retour Stripe : revalidation, confetti si upgraded, ouverture config premier slot si openConfig=1
  useEffect(() => {
    const status = searchParams?.get('status');
    const returnFlow = searchParams?.get('return_flow');
    const openConfig = searchParams?.get('openConfig') === '1';
    if (returnFlow === 'reduce') {
      toast.info('La réduction de prix sera effective à la prochaine date de facturation.', {
        duration: 6000,
        className: 'border-slate-300 dark:border-slate-600',
      });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      router.replace('/dashboard/establishments', { scroll: false });
      fetchEstablishments();
      return;
    }
    if (status !== 'upgraded' && status !== 'establishment_added') return;
    if (status === 'upgraded') {
      fireConfetti();
      toast.success('Emplacements débloqués ! Configurez vos nouveaux établissements.', {
        duration: 5000,
        className: 'border-emerald-500/30',
      });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    }
    if (status === 'establishment_added') {
      toast.success('Félicitations ! Votre nouvel établissement a été ajouté avec sa remise dégressive.', {
        duration: 6000,
        className: 'border-emerald-500/30',
      });
    }
    router.refresh();
    fetchEstablishments().then(() => {
      if (status === 'upgraded' && openConfig && !upgradedWithOpenConfigRef.current) {
        upgradedWithOpenConfigRef.current = true;
        setTimeout(() => setModalAddOpen(true), 400);
      }
    });
  }, [searchParams, router, fetchEstablishments]);

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

  const openAddModal = useCallback(() => {
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
    return addName.trim() || 'Nouvel établissement';
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit()) {
      toast.error('Le nom doit faire au moins 2 caractères.');
      return;
    }
    const payload = getPayload();
    if (!payload.name || payload.name.length < 2) {
      toast.error('Le nom doit faire au moins 2 caractères.');
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
        throw new Error(json.error ?? 'Erreur');
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
      toast.success('Établissement activé !');
      setTimeout(() => setAddSuccessId(null), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
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
      if (!res.ok) throw new Error(json.error ?? 'Erreur');
      toast.success(e.id === 'profile' ? 'Profil principal par défaut.' : 'Établissement défini par défaut.');
      await fetchEstablishments();
      window.dispatchEvent(new Event('establishments-updated'));
      if (activeLocation) await activeLocation.refreshLocations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSettingDefaultId(null);
    }
  };

  const openEdit = (e: Establishment) => {
    setEditingItem(e);
    setEditName(e.name);
    setEditEstablishmentType(e.establishmentType ?? '');
    setEditAddress(e.address || '');
    setModalEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editName.trim() || editName.trim().length < 2) {
      toast.error('Le nom doit faire au moins 2 caractères.');
      return;
    }
    setSavingEdit(true);
    try {
      if (editingItem.isPrincipal) {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            establishmentName: editName.trim(),
            establishmentType: editEstablishmentType.trim(),
            address: editAddress.trim() || '',
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? 'Erreur');
      } else {
        const res = await fetch(`/api/establishments/${editingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editName.trim(), address: editAddress.trim() || undefined }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? 'Erreur');
      }
      toast.success('Établissement modifié.');
      setModalEditOpen(false);
      setEditingItem(null);
      await fetchEstablishments();
      window.dispatchEvent(new Event('establishments-updated'));
      if (activeLocation) await activeLocation.refreshLocations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSavingEdit(false);
    }
  };

  const openDeleteModal = (e: Establishment) => {
    if (e.isPrincipal) {
      toast.error('L\'établissement principal ne peut pas être supprimé.');
      return;
    }
    setEstablishmentToDelete(e);
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

  const openBulkCheckout = async (targetQuantity: number) => {
    setPortalLoading(true);
    try {
      const locale = typeof window !== 'undefined' ? (window.navigator.language?.startsWith('en') ? 'en' : 'fr') : 'fr';
      const res = await fetch(`/api/stripe/create-bulk-session?locale=${locale}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetQuantity }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.url) window.location.href = json.url;
      else throw new Error(json.error ?? 'Erreur');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur ouverture du paiement');
    } finally {
      setPortalLoading(false);
    }
  };

  const openBulkExpansion = async () => {
    // On envoie uniquement le nombre à ajouter ; l'API récupère la quantité réelle chez Stripe et calcule le total.
    setPortalLoading(true);
    try {
      const locale = typeof window !== 'undefined' ? (window.navigator.language?.startsWith('en') ? 'en' : 'fr') : 'fr';
      const res = await fetch(`/api/stripe/create-bulk-expansion?locale=${locale}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ expansionAddCount }),
      });
      const json = await res.json().catch(() => ({}));
      // Redirection vers hosted_invoice_url : montant au prorata (paliers dégressifs) déjà calculé par Stripe.
      if (json.url) window.location.href = json.url;
      else throw new Error(json.error ?? 'Erreur');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur ouverture du paiement');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!establishmentToDelete || establishmentToDelete.isPrincipal) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/establishments/${establishmentToDelete.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Erreur');
      toast.success('Établissement supprimé.');
      setDeleteModalOpen(false);
      setEstablishmentToDelete(null);
      await fetchEstablishments();
      window.dispatchEvent(new Event('establishments-updated'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8 max-w-5xl mx-auto space-y-6">
        <div className="h-8 w-48 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
        <div className="h-4 w-64 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const establishmentsRaw = data?.establishments ?? [];
  const allEstablishments = [...establishmentsRaw].sort((a, b) => (b.isPrincipal ? 1 : 0) - (a.isPrincipal ? 1 : 0));
  const subscriptionQuantity = subscription.isError ? 1 : subscription.quantity;
  // Stripe = master : on n'affiche que les N premiers (N = quota payé). Les autres sont archivés.
  const visibleEstablishments = allEstablishments.slice(0, subscriptionQuantity);
  const archivedCount = Math.max(0, allEstablishments.length - subscriptionQuantity);
  const atLimit = visibleEstablishments.length >= subscriptionQuantity;
  const planSlug = (data?.planSlug ?? subscription.planSlug) as PlanSlug;
  const basePrice = data?.basePrice ?? PLAN_PRICES[planSlug];
  const totalSavings = data?.totalSavings ?? 0;
  const totalMonthlyPrice = getTotalMonthlyPrice(planSlug, visibleEstablishments.length);
  const nextIndex = visibleEstablishments.length;
  const nextDiscount = getDiscountForIndex(nextIndex);
  const nextPrice = getPriceAfterDiscount(basePrice, nextIndex);
  const proratedAmount = getProratedAmount(nextPrice);
  const totalNextMonth = getTotalMonthlyPrice(planSlug, visibleEstablishments.length + 1);
  const planDisplayName = PLAN_DISPLAY[planSlug];
  const isAnnualBilling = subscription.interval === 'year';

  const emptySlotsCount = Math.max(0, subscriptionQuantity - visibleEstablishments.length);

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8 max-w-5xl mx-auto space-y-6">
      {/* Message élégant si Stripe indisponible (Apple-style) */}
      {subscription.isError && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Nous n&apos;arrivons pas à charger votre abonnement. Vérifiez votre connexion.
          </p>
          <button
            type="button"
            onClick={() => subscription.refetch()}
            className="text-sm font-semibold text-amber-700 dark:text-amber-300 hover:underline"
          >
            Réessayez
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
                Plan {planDisplayName}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
              {subscription.isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" aria-hidden />
                </span>
              ) : (
                <>
                  Nombre d&apos;établissements : <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{visibleEstablishments.length}</span>
                  <span className="text-slate-400"> / </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{subscriptionQuantity}</span>
                </>
              )}
              {!subscription.isLoading && archivedCount > 0 && (
                <span className="ml-2 text-amber-600 dark:text-amber-400 text-xs">
                  ({archivedCount} au-delà du quota)
                </span>
              )}
              {!subscription.isLoading && totalSavings > 0 && (
                <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  · Économie : {totalSavings}€/mois
                </span>
              )}
            </p>
            {/* Passage Mensuel → Annuel uniquement ; pas de bouton Annuel → Mensuel (voir switch-to-annual). */}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {!subscription.isError && !subscription.isLoading && subscription.interval === 'month' && (
                <button
                  type="button"
                  onClick={async () => {
                    setSwitchToAnnualLoading(true);
                    try {
                      const res = await fetch('/api/stripe/switch-to-annual', { method: 'POST' });
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(json.error ?? 'Erreur');
                      if (json.url) window.location.href = json.url;
                      else {
                        toast.success(json.message ?? 'Mis à jour.');
                        queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
                      }
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Erreur');
                    } finally {
                      setSwitchToAnnualLoading(false);
                    }
                  }}
                  disabled={switchToAnnualLoading}
                  className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline underline-offset-2 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {switchToAnnualLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Passer en annuel (-20%)
                </button>
              )}
              {!subscription.isLoading && (subscriptionQuantity > visibleEstablishments.length || visibleEstablishments.length > 0) && (
                <button
                  type="button"
                  onClick={async () => {
                    setReducePortalLoading(true);
                    try {
                      const locale = window.location.pathname.split('/')[1] || 'fr';
                      const res = await fetch(`/api/stripe/portal?locale=${locale}&flow=reduce-quota`, { method: 'POST' });
                      const json = await res.json().catch(() => ({}));
                      if (json.url) window.location.href = json.url;
                      else toast.error(json.error ?? 'Impossible d\'ouvrir le portail de facturation.');
                    } finally {
                      setReducePortalLoading(false);
                    }
                  }}
                  disabled={reducePortalLoading}
                  className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline underline-offset-2 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {reducePortalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Réduire mon quota payé
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Grille : Configurées (visible) | Emplacement disponible | Upsell */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleEstablishments.map((e) => (
          <motion.div
            key={e.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`group rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 p-5 flex flex-col ${
              addSuccessId === e.id ? 'ring-2 ring-emerald-500/60' : ''
            }`}
          >
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{e.name}</h3>
                {e.isPrincipal && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/40">
                    PRINCIPAL
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
                    Configuré
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <Link2Off className="w-3.5 h-3.5" />
                    En attente
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
                {e.priceAfterDiscount}€/mois{e.discountPercent > 0 && <span className="text-emerald-600 dark:text-emerald-400"> (-{e.discountPercent}%)</span>}
              </p>
              {e.discountPercent > 0 && (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Économie : {(basePrice - e.priceAfterDiscount).toFixed(2)}€/mois
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              {!e.isPrincipal && (
                <button
                  type="button"
                  onClick={() => setAsDefault(e)}
                  disabled={settingDefaultId !== null}
                  className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {settingDefaultId === e.id && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
                  Définir par défaut
                </button>
              )}
              <button
                type="button"
                onClick={() => openEdit(e)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                aria-label="Modifier"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => openDeleteModal(e)}
                disabled={e.isPrincipal}
                className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}

        {/* Slots vides : Configurer */}
        {Array.from({ length: emptySlotsCount }, (_, i) => (
          <motion.button
            key={`empty-${i}`}
            type="button"
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={openAddModal}
            className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:border-emerald-300 dark:hover:border-emerald-500/50 transition-all duration-300 p-6 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 min-h-[180px]"
          >
            <Store className="w-8 h-8 opacity-70" />
            <span className="font-medium text-sm">Emplacement disponible</span>
            <span className="text-xs">Configurer</span>
          </motion.button>
        ))}

        {/* Carte Ajouter un nouvel emplacement (quand limite atteinte) — promo = palier dégressif du prochain */}
        {atLimit && (
          <motion.button
            type="button"
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setLimitReachedModalOpen(true)}
            className="rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-500/10 hover:bg-emerald-100/80 dark:hover:bg-emerald-500/20 transition-all duration-300 p-6 flex flex-col items-center justify-center gap-2 text-emerald-700 dark:text-emerald-300 min-h-[180px] group"
          >
            <Sparkles className="w-8 h-8 group-hover:scale-110 transition-transform" />
            <span className="font-semibold">Ajouter un nouvel emplacement</span>
            <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 border border-emerald-400/50">
              PROMO -{getDiscountForIndex(subscriptionQuantity)}%
            </span>
          </motion.button>
        )}
      </section>

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
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Ajouter un établissement</h2>
              <button
                type="button"
                onClick={closeAddModal}
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
                        Reconnectez Google dans Paramètres pour importer vos lieux Business.
                      </p>
                      <a
                        href="/dashboard/settings"
                        className="inline-flex items-center gap-2 mt-2 text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                      >
                        Paramètres <ExternalLink className="w-3.5 h-3.5" />
                      </a>
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
                      <p className="font-medium text-slate-900 dark:text-slate-100">Depuis Google Business</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        {googleLocationsLoading
                          ? 'Chargement…'
                          : googleLocations.length > 0
                            ? `${googleLocations.length} lieu(x) non importé(s)`
                            : googleNeedsReconnect
                              ? 'Connectez Google dans Paramètres'
                              : 'Aucun lieu disponible à importer'}
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
                      <p className="font-medium text-slate-900 dark:text-slate-100">Ajouter manuellement</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        Protéger un lieu sur un autre compte Google
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={closeAddModal}
                    className="w-full py-2.5 rounded-xl font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                  >
                    Annuler
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
                    ← Retour
                  </button>
                  {googleLocations.length === 0 && !googleLocationsLoading ? (
                    <p className="text-slate-500 text-sm">
                      Aucun lieu Google non importé. Ajoutez-en un manuellement.
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
                        Ajout de <span className="font-semibold text-slate-900 dark:text-slate-100">{displayNameForRecap()}</span>
                        {nextDiscount > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400"> — Remise {nextDiscount}% incluse</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <CreditCard className="w-4 h-4 shrink-0 text-primary" />
                        <span>
                          Débit aujourd&apos;hui : <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{proratedAmount}€</span> (prorata restant du mois)
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">
                        Puis votre abonnement passera à <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{totalNextMonth}€</span>/mois
                      </p>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setAddMode('choice')}
                      className="flex-1 py-2.5 rounded-xl font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-100 transition-colors"
                    >
                      Retour
                    </button>
                    <button
                      type="submit"
                      disabled={adding || !canSubmit()}
                      className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-primary hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                    >
                      {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmer l\'ajout'}
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
                    ← Retour
                  </button>
                  <div className="rounded-xl bg-slate-100/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] p-4 mb-4 space-y-2">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Remise <span className="font-bold text-emerald-600 dark:text-emerald-400">-{nextDiscount}%</span> pour ce nouvel établissement — <span className="tabular-nums text-slate-900 dark:text-slate-100">{nextPrice}€</span>/mois
                    </p>
                  </div>
                  <div>
                    <label htmlFor="add-name" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="add-name"
                      type="text"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      required
                      minLength={2}
                      placeholder="Ex : Restaurant Le Bistro"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="add-address" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                      Adresse
                    </label>
                    <input
                      id="add-address"
                      type="text"
                      value={addAddress}
                      onChange={(e) => setAddAddress(e.target.value)}
                      placeholder="Ex : 12 rue de la Paix, 75001 Paris"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    />
                  </div>
                  {canSubmit() && (
                    <div className="rounded-xl bg-slate-100/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] p-4 space-y-3">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Ajout de <span className="font-semibold text-slate-900 dark:text-slate-100">{displayNameForRecap()}</span>
                        {nextDiscount > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400"> — Remise {nextDiscount}% incluse</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <CreditCard className="w-4 h-4 shrink-0 text-primary" />
                        <span>
                          Débit aujourd&apos;hui : <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{proratedAmount}€</span> (prorata restant du mois)
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">
                        Puis votre abonnement passera à <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{totalNextMonth}€</span>/mois
                      </p>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setAddMode('choice')}
                      className="flex-1 py-2.5 rounded-xl font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-100 transition-colors"
                    >
                      Retour
                    </button>
                    <button
                      type="submit"
                      disabled={adding || !canSubmit()}
                      className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-primary hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                    >
                      {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmer l\'ajout'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sheet Modifier — tiroir latéral droit */}
      <AnimatePresence>
        {modalEditOpen && editingItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => !savingEdit && setModalEditOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Modifier l&apos;établissement</h2>
                <button
                  type="button"
                  onClick={() => !savingEdit && setModalEditOpen(false)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                  aria-label="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEdit} className="p-5 overflow-y-auto flex-1 space-y-5">
                <div>
                  <label htmlFor="edit-name" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    minLength={2}
                    placeholder="Ex : Restaurant Le Bistro"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
                {editingItem.isPrincipal && (
                  <div>
                    <label htmlFor="edit-establishment-type" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                      Type d&apos;établissement
                    </label>
                    <input
                      id="edit-establishment-type"
                      type="text"
                      value={editEstablishmentType}
                      onChange={(e) => setEditEstablishmentType(e.target.value)}
                      placeholder="Hôtel, restaurant, bar..."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="edit-address" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                    Adresse
                  </label>
                  <input
                    id="edit-address"
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Ex : 12 rue de la Paix, 75001 Paris"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Google Business</p>
                  {editingItem.googleStatus === 'connected' ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Connecté{editingItem.googleLocationName ? ` · ${editingItem.googleLocationName}` : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Non connecté. Liez votre fiche dans{' '}
                      <a href="/dashboard/settings" className="text-primary underline underline-offset-2 hover:no-underline">
                        Paramètres
                      </a>
                      .
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Réglages IA</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ton, longueur des réponses et instructions personnalisées dans{' '}
                    <a href="/dashboard/settings" className="text-primary underline underline-offset-2 hover:no-underline">
                      Paramètres
                    </a>
                    .
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => !savingEdit && setModalEditOpen(false)}
                    className="flex-1 py-2.5 rounded-xl font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-100 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit || !editName.trim() || editName.trim().length < 2}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-primary hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                  >
                    {savingEdit ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-4">
                  <Sparkles className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2 text-center">
                  Calculatrice d&apos;expansion
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 text-center">
                  Combien d&apos;établissements voulez-vous ajouter ? Plus vous en prenez, plus le prix unitaire baisse.
                </p>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Nombre à ajouter
                  </label>
                  <div className="flex items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={() => setExpansionAddCount((c) => Math.max(1, c - 1))}
                      disabled={expansionAddCount <= 1 || portalLoading}
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
                      className="flex items-center justify-center w-12 h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:border-emerald-300 dark:hover:border-emerald-500/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-2">
                    Vous avez <span className="font-semibold tabular-nums">{subscriptionQuantity}</span> site{subscriptionQuantity > 1 ? 's' : ''}. Cible : <span className="font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">{subscriptionQuantity + expansionAddCount}</span> établissements
                  </p>
                </div>

                {expansionAddCount >= 1 && (
                  <>
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-3 mb-4 space-y-1">
                      {Array.from({ length: expansionAddCount }, (_, i) => {
                        const idx = subscriptionQuantity + i;
                        const pct = getDiscountForIndex(idx);
                        const label = i === 0 ? '1er supplémentaire' : i === 1 ? '2ème' : `${i + 1}ème`;
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
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Total à payer aujourd&apos;hui (prorata Stripe)</p>
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={expansionPreviewLoading ? 'loading' : expansionPreviewAmount ?? (isAnnualBilling ? getProratedExpansionAmountAnnual(planSlug, subscriptionQuantity, subscriptionQuantity + expansionAddCount) : getProratedExpansionAmount(planSlug, subscriptionQuantity, subscriptionQuantity + expansionAddCount))}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100"
                          >
                            {expansionPreviewLoading
                              ? '…'
                              : typeof expansionPreviewAmount === 'number'
                                ? `${expansionPreviewAmount.toFixed(2)}€`
                                : isAnnualBilling
                                  ? `${getProratedExpansionAmountAnnual(planSlug, subscriptionQuantity, subscriptionQuantity + expansionAddCount).toFixed(2)}€`
                                  : `${getProratedExpansionAmount(planSlug, subscriptionQuantity, subscriptionQuantity + expansionAddCount).toFixed(2)}€`}
                          </motion.p>
                        </AnimatePresence>
                      </div>
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-4">
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">
                          {isAnnualBilling ? 'Nouvel abonnement annuel' : 'Nouvel abonnement mensuel'}
                        </p>
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={isAnnualBilling ? getTotalAnnualPrice(planSlug, subscriptionQuantity + expansionAddCount) : getTotalMonthlyPrice(planSlug, subscriptionQuantity + expansionAddCount)}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="text-xl font-bold tabular-nums text-emerald-800 dark:text-emerald-200"
                          >
                            {isAnnualBilling
                              ? `${getTotalAnnualPrice(planSlug, subscriptionQuantity + expansionAddCount)}€/an`
                              : `${getTotalMonthlyPrice(planSlug, subscriptionQuantity + expansionAddCount)}€/mois`}
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
                        Génération…
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        Valider et payer
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => !portalLoading && setLimitReachedModalOpen(false)}
                    disabled={portalLoading}
                    className="w-full py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    Plus tard
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
                Confirmer la suppression
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 text-center">
                La suppression de <span className="font-semibold text-slate-800 dark:text-slate-200">&laquo;{establishmentToDelete.name}&raquo;</span> est définitive. Tapez <strong className="font-mono text-red-600 dark:text-red-400">SUPPRIMER</strong> pour valider.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 text-center">
                Vous libérez un emplacement ; la carte deviendra &laquo; Emplacement disponible &raquo;.
              </p>
              <div className="mb-6">
                <label htmlFor="delete-confirm" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  Confirmation
                </label>
                <input
                  id="delete-confirm"
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="SUPPRIMER"
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
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting || deleteConfirmText.trim().toUpperCase() !== 'SUPPRIMER'}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Supprimer définitivement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
