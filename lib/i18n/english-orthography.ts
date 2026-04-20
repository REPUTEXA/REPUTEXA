/**
 * Variante orthographique anglaise (US vs UK) pour les réponses IA,
 * d’après le contexte lieu / fuseau — USA → -ize ; ailleurs → -ise (standard international).
 */

export type EnglishOrthography = 'us' | 'gb';

const US_ICAN_TIMEZONES = new Set([
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Detroit',
  'America/Indiana/Indianapolis',
  'America/Kentucky/Louisville',
  'America/Boise',
  'America/Juneau',
  'America/Anchorage',
  'Pacific/Honolulu',
]);

const AMERICA_NON_US_SUBSTR = [
  'Toronto',
  'Vancouver',
  'Winnipeg',
  'Mexico',
  'Argentina',
  'Sao_Paulo',
  'Lima',
  'Santiago',
];

/**
 * @param city — ex. ville ou chaîne "Chicago, IL, USA" depuis l’avis / l’établissement
 * @param timezone — ex. IANA depuis Establishment.timezone
 */
export function inferEnglishOrthography(input: {
  city: string;
  timezone?: string | null;
}): EnglishOrthography {
  const city = (input.city ?? '').trim();
  const tz = (input.timezone ?? '').trim();
  const combined = `${city} ${tz}`.toLowerCase();

  if (/\b(united states|usa|u\.s\.a\.?|u\.s\.?)\b/i.test(combined)) return 'us';
  if (/\b(us|usa)\s*$/i.test(city)) return 'us';

  for (const tzPart of AMERICA_NON_US_SUBSTR) {
    if (tz.includes(tzPart)) return 'gb';
  }

  if (tz && US_ICAN_TIMEZONES.has(tz)) return 'us';
  if (tz.startsWith('America/') && !AMERICA_NON_US_SUBSTR.some((s) => tz.includes(s))) {
    return 'us';
  }

  return 'gb';
}

/** Ligne à injecter dans le prompt système ou utilisateur. */
export function englishOrthographyInstruction(mode: EnglishOrthography): string {
  if (mode === 'us') {
    return 'Si la réponse est en anglais : utilisez l’orthographe **américaine** (ex. "specialize", "color", "center").';
  }
  return 'Si la réponse est en anglais : utilisez l’orthographe **britannique** (ex. "specialise", "colour", "centre").';
}
