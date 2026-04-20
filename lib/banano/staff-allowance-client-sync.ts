/** Synchronise Base clients, Paramètres Équipe et aperçus après changement bons collaborateurs. */

export const BANANO_STAFF_ALLOWANCE_SYNC_EVENT = 'banano:staff-allowance-sync';

export type BananoStaffAllowanceSyncDetail = {
  /** Ex. settings | crm_member | terminal */
  source?: string;
};

export function dispatchBananoStaffAllowanceSync(detail?: BananoStaffAllowanceSyncDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(BANANO_STAFF_ALLOWANCE_SYNC_EVENT, { detail: (detail ?? {}) as BananoStaffAllowanceSyncDetail })
  );
}

export function subscribeBananoStaffAllowanceSync(handler: (d: BananoStaffAllowanceSyncDetail) => void) {
  if (typeof window === 'undefined') return () => {};
  const fn = (ev: Event) => {
    const d = (ev as CustomEvent).detail as BananoStaffAllowanceSyncDetail | undefined;
    handler(d ?? {});
  };
  window.addEventListener(BANANO_STAFF_ALLOWANCE_SYNC_EVENT, fn);
  return () => window.removeEventListener(BANANO_STAFF_ALLOWANCE_SYNC_EVENT, fn);
}
