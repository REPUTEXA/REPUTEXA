import { normalizeBananoVoucherCode } from '@/lib/banano/loyalty-voucher-code';
import { parseMemberIdFromWalletScanPayload } from '@/lib/wallet/pass-service';

export type GhostResolvedScan =
  | { kind: 'member_card'; memberId: string; raw: string }
  | { kind: 'voucher'; publicCode: string; raw: string }
  | { kind: 'unknown'; raw: string };

/**
 * Codes scannés en caisse : URL `member-resolve`, `REP-<uuid membre>` (carte Wallet) ou code bon `VCHR-…`.
 */
export function resolveGhostScanInput(raw: string): GhostResolvedScan {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return { kind: 'unknown', raw: '' };

  const memberFromPayload = parseMemberIdFromWalletScanPayload(trimmed);
  if (memberFromPayload) {
    return { kind: 'member_card', memberId: memberFromPayload, raw: trimmed };
  }

  const v = normalizeBananoVoucherCode(trimmed);
  if (v.startsWith('VCHR-') && v.length >= 10) {
    return { kind: 'voucher', publicCode: v, raw: trimmed };
  }

  return { kind: 'unknown', raw: trimmed };
}
