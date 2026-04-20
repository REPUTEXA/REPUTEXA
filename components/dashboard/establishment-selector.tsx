'use client';

import { useState, useRef, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Building2, ChevronDown, Plus, Check, MapPin } from 'lucide-react';
import { useActiveLocation } from '@/lib/active-location-context';
import type { PlanSlug } from '@/lib/feature-gate';

type Props = {
  establishmentName?: string;
  fullName?: string;
  selectedPlanSlug?: PlanSlug;
  subscriptionQuantity?: number;
  onCloseMobile?: () => void;
};

export function EstablishmentSelector({
  establishmentName = '',
  fullName,
  selectedPlanSlug,
  subscriptionQuantity,
  onCloseMobile,
}: Props) {
  const tSel = useTranslations('Dashboard.establishmentSelector');
  const tShell = useTranslations('Dashboard.shell');
  const { activeLocationId, setActiveLocationId, locations, isLoading } =
    useActiveLocation();
  const quantity = subscriptionQuantity ?? locations.length;
  const visibleLocations = locations.slice(0, quantity);
  const canAddEstablishment =
    selectedPlanSlug === 'zenith' && visibleLocations.length < quantity;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLocation = visibleLocations.find((l) => l.id === activeLocationId) ?? locations.find((l) => l.id === activeLocationId);
  const displayName =
    currentLocation?.name ??
    (establishmentName.trim() ? establishmentName : tShell('defaultEstablishment'));

  useEffect(() => {
    if (visibleLocations.length === 0) return;
    const isActiveVisible = visibleLocations.some((l) => l.id === activeLocationId);
    if (!isActiveVisible) {
      setActiveLocationId(visibleLocations[0].id);
    }
  }, [visibleLocations, activeLocationId, setActiveLocationId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (id: string) => {
    setActiveLocationId(id);
    setOpen(false);
    onCloseMobile?.();
  };

  const handleAddClick = () => {
    setOpen(false);
    onCloseMobile?.();
  };

  const LocationIcon = ({ isPrincipal }: { isPrincipal?: boolean }) => (
    <div
      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
        isPrincipal
          ? 'bg-amber-500/20 text-amber-400'
          : 'bg-white/5 text-white/70'
      }`}
    >
      <MapPin className="w-4 h-4" />
    </div>
  );

  return (
    <div ref={ref} className="relative mx-3 mt-4 mb-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-200 flex items-center gap-3 text-left group"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={tSel('selectAria')}
      >
        <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white/95 truncate">
            {isLoading ? '...' : displayName}
          </p>
          <p className="text-[11px] text-white/40 truncate">
            {fullName || tSel('myAccount')}
          </p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-white/40 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && !isLoading && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl bg-[#0c0c0f]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/40 overflow-hidden">
          <div className="py-1.5 max-h-64 overflow-y-auto">
            {visibleLocations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                role="option"
                aria-selected={loc.id === activeLocationId}
                onClick={() => handleSelect(loc.id)}
                className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors ${
                  loc.id === activeLocationId
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/80 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <LocationIcon isPrincipal={loc.isPrincipal} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{loc.name}</p>
                  {loc.isPrincipal && (
                    <p className="text-[10px] text-amber-400/90">{tSel('principal')}</p>
                  )}
                </div>
                {loc.id === activeLocationId && (
                  <Check className="w-4 h-4 shrink-0 text-blue-500" aria-hidden />
                )}
              </button>
            ))}
            {canAddEstablishment && (
              <div className="border-t border-white/[0.06] mt-1 pt-1">
                <Link
                  href="/dashboard/establishments"
                  onClick={handleAddClick}
                  className="w-full px-3 py-2.5 flex items-center gap-3 text-sm text-primary hover:bg-primary/10 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-medium break-words text-left">{tSel('addEstablishment')}</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
