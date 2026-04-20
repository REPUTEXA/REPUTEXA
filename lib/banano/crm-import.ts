import { sanitizeImportPhoneColumn } from '@/lib/banano/phone';
import { formatTerminalClientName } from '@/lib/banano/terminal-client-name-format';

export type CrmImportColumnMapping = {
  phoneIndex: number;
  firstNameIndex: number | null;
  lastNameIndex: number | null;
  fullNameIndex: number | null;
  pointsBalanceIndex: number | null;
  stampsBalanceIndex: number | null;
};

export type CrmImportCommitRow = {
  phone: string;
  first_name: string;
  last_name: string;
  display_name: string;
  points_balance: number;
  stamps_balance: number;
};

const MAX_IMPORT_ROWS = 10_000;
const MAX_BALANCE = 9_999_999;

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeHeaderLabel(raw: string): string {
  return stripAccents(String(raw ?? '').trim()).toLowerCase();
}

export function parseBalanceCell(raw: unknown): number {
  const s = String(raw ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.');
  if (!s) return 0;
  const n = Math.floor(Number(s));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, MAX_BALANCE);
}

function scorePhoneHeader(n: string): number {
  if (!n) return -1;
  if (/^(tel|phone|mobile|portable|gsm|cell)$/i.test(n)) return 100;
  if (n.includes('telephone') || n.includes('téléphone')) return 95;
  if (n.includes('portable') || n.includes('mobile') || n.includes('gsm')) return 90;
  if (n.includes('tel') && n.length <= 6) return 85;
  if (n.includes('numero') || n.includes('numéro') || n.includes('n°')) return 80;
  if (n === 'portable' || n === 'gsm') return 88;
  return 0;
}

function scoreFirstHeader(n: string): number {
  if (n.includes('prenom') || n.includes('prénom') || n.includes('firstname')) return 100;
  if (n.startsWith('pre ') || n === 'pre') return 70;
  return 0;
}

function scoreLastHeader(n: string): number {
  if (n.includes('nom de famille') || n.includes('lastname') || n.includes('family name'))
    return 100;
  if ((n === 'nom' || n.startsWith('nom ')) && !n.includes('prenom') && !n.includes('prénom'))
    return 85;
  if (n.includes('surname') && !n.includes('prénom')) return 80;
  return 0;
}

function scoreFullNameHeader(n: string): number {
  if (n.includes('nom complet') || n.includes('client') || n.includes('customer')) return 95;
  if (n === 'name' || n === 'nom' || n.includes('contact')) return 50;
  if (n.includes('raison sociale')) return 40;
  return 0;
}

function scorePointsHeader(n: string): number {
  if (n.includes('point') || n.includes('fidélité') || n.includes('fidelite')) return 100;
  if (n.includes('cagnotte') || n.includes('credit') || n.includes('crédit')) return 85;
  if (n.includes('solde') && !n.includes('tampon')) return 75;
  if (n.includes('balance') || n.includes('cumul')) return 70;
  return 0;
}

function scoreStampsHeader(n: string): number {
  if (n.includes('tampon') || n.includes('stamp')) return 100;
  if (n.includes('empreinte') || n.includes('pastille')) return 85;
  if (n.includes('coup') || n.includes('visite') || n.includes('passage')) return 35;
  return 0;
}

function bestIndex(
  headers: string[],
  scorer: (n: string) => number,
  minScore: number
): number | null {
  let bestI: number | null = null;
  let bestS = minScore;
  headers.forEach((h, i) => {
    const n = normalizeHeaderLabel(h);
    const s = scorer(n);
    if (s > bestS) {
      bestS = s;
      bestI = i;
    }
  });
  return bestI;
}

/** Codes internes (pas affichés) — les libellés utilisateur sont dans `Api.errors.crm_import*`. */
export type CrmImportGuessErrorCode = 'no_column_detected' | 'phone_column_missing';

export function guessCrmImportMapping(
  headers: string[],
  loyaltyMode: 'points' | 'stamps'
): CrmImportColumnMapping | { error: CrmImportGuessErrorCode } {
  if (!headers.length) {
    return { error: 'no_column_detected' };
  }
  const phoneIndex = bestIndex(headers, scorePhoneHeader, 50);
  if (phoneIndex == null) {
    return { error: 'phone_column_missing' };
  }

  const firstI = bestIndex(headers, scoreFirstHeader, 60);
  const lastI = bestIndex(headers, scoreLastHeader, 70);
  const fullI = bestIndex(headers, scoreFullNameHeader, 55);

  let firstNameIndex: number | null = null;
  let lastNameIndex: number | null = null;
  let fullNameIndex: number | null = null;

  if (firstI != null && lastI != null && firstI !== lastI) {
    firstNameIndex = firstI;
    lastNameIndex = lastI;
  } else {
    if (firstI != null) firstNameIndex = firstI;
    if (lastI != null) lastNameIndex = lastI;
    if (fullI != null && fullI !== phoneIndex) fullNameIndex = fullI;
  }

  const pi = bestIndex(headers, scorePointsHeader, 65);
  const si = bestIndex(headers, scoreStampsHeader, 70);

  let pointsBalanceIndex: number | null = pi;
  let stampsBalanceIndex: number | null = si;

  const genericSolde = headers.findIndex((h, idx) => {
    if (idx === phoneIndex) return false;
    const n = normalizeHeaderLabel(h);
    return n.includes('solde') && !n.includes('tampon');
  });

  if (loyaltyMode === 'points') {
    if (pointsBalanceIndex == null && stampsBalanceIndex == null && genericSolde >= 0) {
      pointsBalanceIndex = genericSolde;
    }
    if (pointsBalanceIndex == null && stampsBalanceIndex != null && genericSolde < 0) {
      pointsBalanceIndex = stampsBalanceIndex;
      stampsBalanceIndex = null;
    }
  } else {
    if (stampsBalanceIndex == null && pointsBalanceIndex == null && genericSolde >= 0) {
      stampsBalanceIndex = genericSolde;
    }
    if (stampsBalanceIndex == null && pointsBalanceIndex != null && genericSolde < 0) {
      stampsBalanceIndex = pointsBalanceIndex;
      pointsBalanceIndex = null;
    }
  }

  if (pointsBalanceIndex != null && stampsBalanceIndex === pointsBalanceIndex) {
    stampsBalanceIndex = null;
  }

  return {
    phoneIndex,
    firstNameIndex,
    lastNameIndex,
    fullNameIndex,
    pointsBalanceIndex,
    stampsBalanceIndex,
  };
}

export function mergeMapping(
  base: CrmImportColumnMapping,
  patch: Partial<CrmImportColumnMapping>
): CrmImportColumnMapping {
  return { ...base, ...patch };
}

/**
 * Même règles que {@link formatTerminalClientName} (caisse, terminal, import).
 * Ex. « Léa », « L'école » → « LEA », « L ECOLE ».
 */
export function normalizeTextForCrmImport(raw: string): string {
  return formatTerminalClientName(String(raw ?? ''));
}

/** @deprecated alias de {@link normalizeTextForCrmImport} */
export const formatImportPersonName = normalizeTextForCrmImport;

export function resolveCrmImportRowNames(
  row: string[],
  m: CrmImportColumnMapping
): { first_name: string; last_name: string; display_name: string } {
  const fiRaw =
    m.firstNameIndex != null ? String(row[m.firstNameIndex] ?? '').trim().slice(0, 80) : '';
  const laRaw =
    m.lastNameIndex != null ? String(row[m.lastNameIndex] ?? '').trim().slice(0, 80) : '';
  const displayRaw =
    m.fullNameIndex != null ? String(row[m.fullNameIndex] ?? '').trim().slice(0, 120) : '';

  const fi = fiRaw ? formatTerminalClientName(fiRaw).slice(0, 80) : '';
  const la = laRaw ? formatTerminalClientName(laRaw).slice(0, 80) : '';
  let display = displayRaw ? formatTerminalClientName(displayRaw).slice(0, 120) : '';

  if (fi || la) {
    display = [fi, la].filter(Boolean).join(' ').trim();
  }
  if (!display) display = 'CLIENT';

  let first = fi;
  let last = la;
  if (!first && !last && display && display !== 'CLIENT') {
    const parts = display.split(/\s+/).filter(Boolean);
    first = parts[0] ? formatTerminalClientName(parts[0]).slice(0, 80) : 'CLIENT';
    last = parts.slice(1).join(' ')
      ? formatTerminalClientName(parts.slice(1).join(' ')).slice(0, 80)
      : '';
  }
  if (!first && display === 'CLIENT') first = 'CLIENT';

  display = [first, last].filter(Boolean).join(' ').trim() || display;
  display = formatTerminalClientName(display).slice(0, 120);

  return {
    first_name: first,
    last_name: last,
    display_name: display.slice(0, 120),
  };
}

export function buildCommitRowsFromGrid(
  dataRows: string[][],
  m: CrmImportColumnMapping,
  _loyaltyMode: 'points' | 'stamps'
): {
  rows: CrmImportCommitRow[];
  skippedInvalidPhone: number;
  duplicateMerged: number;
} {
  const byPhone = new Map<string, CrmImportCommitRow>();
  let skippedInvalidPhone = 0;
  let duplicateMerged = 0;
  for (const raw of dataRows) {
    const row = raw.map((c) => String(c ?? '').trim());
    if (row.every((c) => !c)) continue;
    const rawPhone = m.phoneIndex < row.length ? row[m.phoneIndex] : '';
    const phone = sanitizeImportPhoneColumn(rawPhone);
    if (!phone) {
      skippedInvalidPhone++;
      continue;
    }
    const { first_name, last_name, display_name } = resolveCrmImportRowNames(row, m);
    let points_balance =
      m.pointsBalanceIndex != null && m.pointsBalanceIndex < row.length
        ? parseBalanceCell(row[m.pointsBalanceIndex])
        : 0;
    let stamps_balance =
      m.stampsBalanceIndex != null && m.stampsBalanceIndex < row.length
        ? parseBalanceCell(row[m.stampsBalanceIndex])
        : 0;
    if (_loyaltyMode === 'points') stamps_balance = 0;
    else points_balance = 0;
    const prev = byPhone.get(phone);
    if (prev) {
      duplicateMerged++;
      byPhone.set(phone, {
        phone,
        first_name,
        last_name,
        display_name,
        points_balance: Math.min(MAX_BALANCE, prev.points_balance + points_balance),
        stamps_balance: Math.min(MAX_BALANCE, prev.stamps_balance + stamps_balance),
      });
    } else {
      byPhone.set(phone, {
        phone,
        first_name,
        last_name,
        display_name,
        points_balance,
        stamps_balance,
      });
    }
  }
  return {
    rows: Array.from(byPhone.values()),
    skippedInvalidPhone,
    duplicateMerged,
  };
}

export function resolveHeaderIndex(headers: string[], label: string | null | undefined): number | null {
  if (!label?.trim()) return null;
  const target = normalizeHeaderLabel(label);
  for (let i = 0; i < headers.length; i++) {
    const n = normalizeHeaderLabel(headers[i] ?? '');
    if (n === target) return i;
  }
  let best: { i: number; d: number } | null = null;
  for (let i = 0; i < headers.length; i++) {
    const n = normalizeHeaderLabel(headers[i] ?? '');
    if (n.includes(target) || target.includes(n)) {
      const d = Math.abs(n.length - target.length);
      if (!best || d < best.d) best = { i, d };
    }
  }
  return best?.i ?? null;
}

export function mappingFromAiHeaders(args: {
  headers: string[];
  phoneHeader: string;
  firstNameHeader?: string | null;
  lastNameHeader?: string | null;
  fullNameHeader?: string | null;
  pointsBalanceHeader?: string | null;
  stampsBalanceHeader?: string | null;
}): Partial<CrmImportColumnMapping> {
  const pi = resolveHeaderIndex(args.headers, args.phoneHeader);
  if (pi == null) return {};
  const patch: Partial<CrmImportColumnMapping> = { phoneIndex: pi };
  const fi = resolveHeaderIndex(args.headers, args.firstNameHeader ?? null);
  const la = resolveHeaderIndex(args.headers, args.lastNameHeader ?? null);
  const fu = resolveHeaderIndex(args.headers, args.fullNameHeader ?? null);
  const pt = resolveHeaderIndex(args.headers, args.pointsBalanceHeader ?? null);
  const st = resolveHeaderIndex(args.headers, args.stampsBalanceHeader ?? null);
  if (fi != null) patch.firstNameIndex = fi;
  if (la != null) patch.lastNameIndex = la;
  if (fu != null) patch.fullNameIndex = fu;
  if (pt != null) patch.pointsBalanceIndex = pt;
  if (st != null) patch.stampsBalanceIndex = st;
  return patch;
}

export { MAX_IMPORT_ROWS };
