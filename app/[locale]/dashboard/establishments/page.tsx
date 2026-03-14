'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  MapPin,
  Plus,
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
} from 'lucide-react';
import {
  getPriceAfterDiscount,
  getDiscountForIndex,
  getProratedAmount,
  getTotalMonthlyPrice,
  PLAN_PRICES,
} from '@/lib/establishments';
import { PLAN_DISPLAY, type PlanSlug } from '@/lib/feature-gate';
import { useActiveLocationOptional } from '@/lib/active-location-context';
import { toast } from 'sonner';

type GoogleLocation = { id: string; fullName: string; name: string; address: string | null };

type Establishment = {
  id: string;
  name: string;
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
};

export default function EstablishmentsPage() {
  const t = useTranslations('Dashboard.establishments');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalAddOpen, setModalAddOpen] = useState(false);
  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Establishment | null>(null);
  const [editName, setEditName] = useState('');
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

  const activeLocation = useActiveLocationOptional();

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
    setAddMode('choice');
    setAddName('');
    setAddAddress('');
    setSelectedGoogleLoc(null);
    setModalAddOpen(true);
    fetchGoogleLocations();
  }, [fetchGoogleLocations]);

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
      if (!res.ok) throw new Error(json.error ?? 'Erreur');

      if (json.needsPaymentRedirect && json.invoiceUrl) {
        window.location.href = json.invoiceUrl;
        return;
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

  const openEdit = (e: Establishment) => {
    setEditingItem(e);
    setEditName(e.name);
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
          body: JSON.stringify({ establishmentName: editName.trim(), address: editAddress.trim() || '' }),
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
      <div className="flex items-center justify-center min-h-[280px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const establishments = data?.establishments ?? [];
  const planSlug = data?.planSlug ?? 'vision';
  const basePrice = data?.basePrice ?? PLAN_PRICES[planSlug];
  const totalSavings = data?.totalSavings ?? 0;
  const totalMonthlyPrice = getTotalMonthlyPrice(planSlug, establishments.length);
  const nextIndex = establishments.length;
  const nextDiscount = getDiscountForIndex(nextIndex);
  const nextPrice = getPriceAfterDiscount(basePrice, nextIndex);
  const proratedAmount = getProratedAmount(nextPrice);
  const totalNextMonth = getTotalMonthlyPrice(planSlug, establishments.length + 1);
  const planDisplayName = PLAN_DISPLAY[planSlug];

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8 max-w-5xl mx-auto space-y-6">
      {/* Header — aligné Statistiques */}
      <header>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-50">
              {t('title')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t('description')} — Plan {planDisplayName}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Total : <span className="tabular-nums">{totalMonthlyPrice}€</span>/mois
              </span>
            </div>
            {totalSavings > 0 && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  Économie : <span className="tabular-nums">{totalSavings}€</span>/mois
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white bg-primary hover:brightness-110 transition-all active:scale-[0.98] border border-primary/50 shadow-lg shadow-primary/10"
            >
              <Plus className="w-4 h-4" />
              Ajouter
            </button>
          </div>
        </div>
      </header>

      {/* Liste des établissements — style Statistiques (blanc, visible) */}
      <section className="space-y-4">
        {establishments.map((e) => (
          <div
            key={e.id}
            className={`group rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 p-5 ${
              addSuccessId === e.id ? 'ring-2 ring-emerald-500/60' : ''
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{e.name}</h3>
                  {e.isPrincipal && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/40">
                      Établissement Principal
                    </span>
                  )}
                </div>
                {e.address && (
                  <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{e.address}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  {e.avgRating != null && (
                    <span className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span className="font-medium">{e.avgRating}</span>
                      <span className="text-slate-400">Google</span>
                    </span>
                  )}
                  {e.googleStatus === 'connected' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Google connecté
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                      <Link2Off className="w-3.5 h-3.5" />
                      Non connecté
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Prix : <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{e.priceAfterDiscount}€</span>/mois
                  {e.discountPercent > 0 && (
                    <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-medium">
                      (-{e.discountPercent}% offert)
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(e)}
                  className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                  aria-label="Modifier"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteModal(e)}
                  disabled={e.isPrincipal}
                  className="p-2.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  aria-label="Supprimer"
                  title={e.isPrincipal ? 'L\'établissement principal ne peut pas être supprimé' : 'Supprimer'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Carte Ajouter — style Statistiques */}
        <button
          type="button"
          onClick={openAddModal}
          className="w-full rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:border-primary/40 transition-all duration-300 p-6 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-primary group"
        >
          <Plus className="w-8 h-8 group-hover:scale-110 transition-transform" />
          <span className="font-medium">Ajouter un établissement</span>
          {nextIndex > 0 && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              Prochaine remise : -{nextDiscount}%
            </span>
          )}
        </button>
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

      {/* Modal Modifier — style light visible */}
      {modalEditOpen && editingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => !savingEdit && setModalEditOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Modifier l&apos;établissement</h2>
              <button
                type="button"
                onClick={() => !savingEdit && setModalEditOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEdit} className="p-5 space-y-4">
              <div>
                <label
                  htmlFor="edit-name"
                  className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  minLength={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-address"
                  className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  Adresse
                </label>
                <input
                  id="edit-address"
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
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
          </div>
        </div>
      )}

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
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 text-center">
                La suppression de <span className="font-semibold text-slate-800 dark:text-slate-200">&laquo;{establishmentToDelete.name}&raquo;</span> est définitive. Tapez <strong className="font-mono text-red-600 dark:text-red-400">SUPPRIMER</strong> pour valider.
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
