/** Jour courant UTC au format YYYY-MM-DD — aligné sur la publication légal (`/api/admin/legal/publish`). */
export function legalTodayUtc(): string {
  return new Date().toISOString().split('T')[0];
}

/** Alias doc produit / alignement avec les autres services (« date calculée » = jour UTC courant). */
export const legalTodayCalc = legalTodayUtc;

export function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Préavis minimum (jours calendaires, UTC) si la date d'effet est strictement après aujourd'hui.
 * Ex. aujourd'hui = 30-03 → planifié refusé jusqu'au 28-04, autorisé à partir du 29-04 (30ᵉ jour), ou +72 j, etc.
 * « Aujourd'hui » seul reste accepté pour une activation immédiate (ACTIVE).
 */
export const LEGAL_MIN_NOTICE_DAYS_SCHEDULED = 30;

/**
 * Borne haute (jours après aujourd'hui UTC) pour éviter les dates aberrantes (ex. typo d'année).
 */
export const LEGAL_MAX_EFFECTIVE_DAYS_AHEAD = 730;

/** Heure UTC par défaut (minuit) si non précisée à la publication. */
export const LEGAL_DEFAULT_EFFECTIVE_TIME_UTC = '00:00';

export function parseTimeUtcHm(s: string): { hour: number; minute: number } | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s.trim());
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/** Combine date YYYY-MM-DD et heure HH:mm (UTC) en ISO instant. */
export function buildEffectiveAtIso(
  effectiveDateYmd: string,
  timeUtcHm: string,
  invalidTimeMessage = 'Heure UTC invalide (format HH:mm).'
): string {
  const t = parseTimeUtcHm(timeUtcHm || LEGAL_DEFAULT_EFFECTIVE_TIME_UTC);
  if (!t) {
    throw new Error(invalidTimeMessage);
  }
  const hh = String(t.hour).padStart(2, '0');
  const mm = String(t.minute).padStart(2, '0');
  return `${effectiveDateYmd}T${hh}:${mm}:00.000Z`;
}

/** Affichage FR court pour e-mails / modale (jour + heure UTC). */
export function formatLegalEffectiveUtcDisplay(isoTimestamptz: string): string {
  const d = new Date(isoTimestamptz);
  if (Number.isNaN(d.getTime())) return isoTimestamptz;
  return d.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

export type BroadcastScheduleErrorTexts = {
  invalid: string;
  tooSoon: string;
  tooFar: string;
};

const BROADCAST_SCHEDULE_ERRORS_FR: BroadcastScheduleErrorTexts = {
  invalid: 'Date/heure de planification invalide.',
  tooSoon: 'Choisissez une heure au moins ~30 secondes dans le futur.',
  tooFar: 'Planification trop lointaine (max. ~12 mois).',
};

/** Planification diffusion info : borne basse / haute (sans préavis 30 j). */
export function validateBroadcastScheduleAt(
  scheduledAtIso: string,
  texts: BroadcastScheduleErrorTexts = BROADCAST_SCHEDULE_ERRORS_FR
): { ok: true } | { ok: false; error: string } {
  const t = new Date(scheduledAtIso).getTime();
  if (Number.isNaN(t)) {
    return { ok: false, error: texts.invalid };
  }
  const minT = Date.now() + 25_000;
  const maxT = Date.now() + 366 * 86400_000;
  if (t < minT) {
    return { ok: false, error: texts.tooSoon };
  }
  if (t > maxT) {
    return { ok: false, error: texts.tooFar };
  }
  return { ok: true };
}

export type LegalEffectiveDateValidation =
  | { ok: true }
  | { ok: false; error: string };

/** Textes pour `validateLegalEffectiveDate` — fournis par next-intl côté UI / API. */
export type LegalEffectiveDateTextFns = {
  invalidFormat: () => string;
  pastDate: () => string;
  tooFar: (maxEffective: string) => string;
  noticeNotMet: (earliestScheduled: string, todayYmd: string) => string;
};

const LEGAL_EFFECTIVE_DATE_TEXTS_FR: LegalEffectiveDateTextFns = {
  invalidFormat: () => 'Date invalide (format attendu : YYYY-MM-DD).',
  pastDate: () => "La date d'entrée en vigueur ne peut pas être dans le passé.",
  tooFar: (maxEffective) =>
    `La date d'entrée en vigueur est trop lointaine (maximum : ${maxEffective}, soit J+${LEGAL_MAX_EFFECTIVE_DAYS_AHEAD}).`,
  noticeNotMet: (earliestScheduled, todayYmd) =>
    `Préavis minimum non respecté : pour une date planifiée, choisissez au plus tôt le ${earliestScheduled} (J+${LEGAL_MIN_NOTICE_DAYS_SCHEDULED}), ou ${todayYmd} pour une entrée en vigueur immédiate.`,
};

/**
 * Règles alignées sur POST /api/admin/legal/publish.
 * Passez `texts` depuis `useTranslations('LegalDates')` ou `createServerTranslator('LegalDates', locale)`.
 */
export function validateLegalEffectiveDate(
  effective_date: string,
  todayYmd: string,
  texts: LegalEffectiveDateTextFns = LEGAL_EFFECTIVE_DATE_TEXTS_FR
): LegalEffectiveDateValidation {
  if (!effective_date || !/^\d{4}-\d{2}-\d{2}$/.test(effective_date)) {
    return { ok: false, error: texts.invalidFormat() };
  }
  if (effective_date < todayYmd) {
    return { ok: false, error: texts.pastDate() };
  }
  const maxEffective = addDaysToYmd(todayYmd, LEGAL_MAX_EFFECTIVE_DAYS_AHEAD);
  if (effective_date > maxEffective) {
    return {
      ok: false,
      error: texts.tooFar(maxEffective),
    };
  }
  const earliestScheduled = addDaysToYmd(todayYmd, LEGAL_MIN_NOTICE_DAYS_SCHEDULED);
  if (effective_date > todayYmd && effective_date < earliestScheduled) {
    return {
      ok: false,
      error: texts.noticeNotMet(earliestScheduled, todayYmd),
    };
  }
  return { ok: true };
}
