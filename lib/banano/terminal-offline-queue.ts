import { shouldRetryTerminalFetch } from '@/lib/banano/loyalty-idempotency';

const STORAGE_KEY = 'banano_terminal_offline_queue_v1';
const MAX_ITEMS = 50;

/** Alerte caisse : entrées non synchronisées depuis plus de ce délai. */
export const OFFLINE_QUEUE_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export type OfflineTransactPayload = {
  memberId: string;
  kind: 'earn_visit' | 'redeem_points';
  note?: string;
  ticketAmountCents?: number;
  ticketItemsCount?: number;
  amount?: number;
  staffId?: string | null;
  /** Même identifiant que l’agent sync / prise de poste pour réconciliation Wallet. */
  terminalId?: string | null;
};

export type OfflineQueueItem =
  | {
      idempotencyKey: string;
      op: 'transact';
      memberId: string;
      memberLabel: string;
      payload: OfflineTransactPayload;
      createdAt: string;
    }
  | {
      idempotencyKey: string;
      op: 'voucher_redeem';
      memberId: string;
      memberLabel: string;
      code: string;
      staffId?: string | null;
      debitEuroCents?: number;
      createdAt: string;
    };

function isOfflineQueueItem(x: unknown): x is OfflineQueueItem {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (typeof o.idempotencyKey !== 'string' || typeof o.op !== 'string') return false;
  if (o.op === 'transact') {
    return (
      typeof o.memberId === 'string' &&
      typeof o.memberLabel === 'string' &&
      o.payload != null &&
      typeof o.payload === 'object' &&
      typeof (o.payload as Record<string, unknown>).memberId === 'string' &&
      typeof (o.payload as Record<string, unknown>).kind === 'string'
    );
  }
  if (o.op === 'voucher_redeem') {
    return typeof o.memberId === 'string' && typeof o.memberLabel === 'string' && typeof o.code === 'string';
  }
  return false;
}

export function loadOfflineQueue(): OfflineQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: OfflineQueueItem[] = [];
    for (const p of parsed) {
      if (isOfflineQueueItem(p)) out.push(p);
    }
    return out.slice(-MAX_ITEMS);
  } catch {
    return [];
  }
}

export function saveOfflineQueue(items: OfflineQueueItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = items.slice(-MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota / private mode */
  }
}

export function enqueueOfflineItem(item: OfflineQueueItem): void {
  const cur = loadOfflineQueue();
  if (cur.some((x) => x.idempotencyKey === item.idempotencyKey)) return;
  saveOfflineQueue([...cur, item]);
}

export function removeOfflineItemByKey(idempotencyKey: string): void {
  const cur = loadOfflineQueue().filter((x) => x.idempotencyKey !== idempotencyKey);
  saveOfflineQueue(cur);
}

/** Erreur réseau ou réponse serveur qui mérite un rejeu plus tard. */
export function shouldEnqueueOfflineRetry(err: unknown, res: Response | null): boolean {
  if (res && shouldRetryTerminalFetch(res.status)) return true;
  if (err instanceof TypeError) {
    const m = String(err.message || '');
    if (/fetch|network|Failed to fetch|Load failed|ECONNRESET/i.test(m)) return true;
  }
  return false;
}

export function offlineQueueItemAgeMs(createdAtIso: string): number {
  const t = Date.parse(createdAtIso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Date.now() - t);
}

export function offlineQueueItemIsStale(item: OfflineQueueItem): boolean {
  return offlineQueueItemAgeMs(item.createdAt) > OFFLINE_QUEUE_STALE_AFTER_MS;
}

export function offlineQueueHasStaleItems(items: OfflineQueueItem[]): boolean {
  return items.some(offlineQueueItemIsStale);
}

/** Libellé court pour l’UI (âge depuis la mise en file). */
export function offlineQueueStaleAgeLabelFr(createdAtIso: string): string {
  const ms = offlineQueueItemAgeMs(createdAtIso);
  const hours = Math.floor(ms / 3600000);
  if (hours < 48) return `${Math.max(1, hours)} h`;
  const days = Math.floor(hours / 24);
  return `${days} j`;
}

export function offlineQueueLabel(item: OfflineQueueItem): string {
  if (item.op === 'transact') {
    const k = item.payload.kind === 'earn_visit' ? 'Visite / points' : 'Débit points';
    return `${k} · ${item.memberLabel}`;
  }
  const debit =
    item.debitEuroCents != null && item.debitEuroCents >= 1
      ? ` · ${(item.debitEuroCents / 100).toFixed(2)} €`
      : '';
  return `Bon ${item.code}${debit} · ${item.memberLabel}`;
}
