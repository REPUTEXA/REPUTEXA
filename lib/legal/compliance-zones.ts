/**
 * Zones de conformité affichées dans l’admin (marchés clés + secondaires + ICO UK).
 * Les codes pays servent à croiser user_consents et les drapeaux Guardian.
 *
 * UK : le cadre d’affichage des documents générés est **UK GDPR + Data Protection Act 2018**
 * et l’autorité de référence est l’**ICO** — pas le libellé « EU GDPR » seul.
 * L’alignement RGPD UE reste la base technique ; le marché GB déclenche les mentions UK.
 */

export type ZoneComplianceStatus = 'ok' | 'watch' | 'action_required' | 'local_specific';

/** Cadre juridique utilisé pour les PDF / affiches / textes générés quand cette zone est ciblée. */
export type ZonePrivacyFramework = 'eu_gdpr' | 'uk_gdpr';

export type ComplianceZoneDef = {
  id: string;
  label: string;
  shortLabel: string;
  /** Pays ISO2 agrégés dans cette carte (ex. Benelux) */
  countries: string[];
  /** Textes compliance (certificat, affiche) : UK ≠ UE. */
  privacyFramework: ZonePrivacyFramework;
};

export const COMPLIANCE_ZONES: ComplianceZoneDef[] = [
  { id: 'edpb_eu', label: 'EDPB / cadre européen fondamental', shortLabel: 'EDPB·UE', countries: [], privacyFramework: 'eu_gdpr' },
  { id: 'fr', label: 'France (CNIL)', shortLabel: 'FR', countries: ['FR'], privacyFramework: 'eu_gdpr' },
  { id: 'de', label: 'Allemagne (BfDI/LfD)', shortLabel: 'DE', countries: ['DE'], privacyFramework: 'eu_gdpr' },
  { id: 'it', label: 'Italie (Garante)', shortLabel: 'IT', countries: ['IT'], privacyFramework: 'eu_gdpr' },
  { id: 'es', label: 'Espagne (AEPD)', shortLabel: 'ES', countries: ['ES'], privacyFramework: 'eu_gdpr' },
  {
    id: 'uk',
    label: 'Royaume-Uni (ICO) — UK GDPR & DPA 2018',
    shortLabel: 'UK',
    countries: ['GB', 'UK'],
    privacyFramework: 'uk_gdpr',
  },
  { id: 'benelux', label: 'Benelux (APD/AP)', shortLabel: 'BE·NL·LU', countries: ['BE', 'NL', 'LU'], privacyFramework: 'eu_gdpr' },
  { id: 'nordics', label: 'Scandinavie (IMY, Datatilsynet, …)', shortLabel: 'Nordics', countries: ['SE', 'NO', 'DK', 'FI', 'IS'], privacyFramework: 'eu_gdpr' },
  { id: 'pl', label: 'Pologne (UODO)', shortLabel: 'PL', countries: ['PL'], privacyFramework: 'eu_gdpr' },
  { id: 'pt', label: 'Portugal (CNPD)', shortLabel: 'PT', countries: ['PT'], privacyFramework: 'eu_gdpr' },
];

/** Pour Guardian / exports : la zone UK déclenche le cadre UK GDPR, pas le seul libellé « EU GDPR ». */
export function getZonePrivacyFramework(zoneId: string): ZonePrivacyFramework {
  const z = COMPLIANCE_ZONES.find((x) => x.id === zoneId);
  return z?.privacyFramework ?? 'eu_gdpr';
}

export type GuardianScope = 'eu_wide' | 'local' | 'none';

export function buildDefaultZoneMap(): Record<string, ZoneComplianceStatus> {
  const m: Record<string, ZoneComplianceStatus> = {};
  for (const z of COMPLIANCE_ZONES) {
    m[z.id] = 'ok';
  }
  return m;
}

/** Interprète la dernière exécution Guardian pour l’UI des cartes. */
export function deriveZoneMapFromGuardian(
  lastStatus: string,
  regionsFlagged: string[] | null | undefined,
  scope: GuardianScope,
  localMarketLabels: string[]
): Record<string, ZoneComplianceStatus> {
  const map = buildDefaultZoneMap();
  const norm = (r: string) => r.trim().toUpperCase();
  const flagged = new Set((regionsFlagged ?? []).map(norm));

  if (lastStatus === 'review_needed') {
    if (scope === 'eu_wide') {
      map.edpb_eu = 'action_required';
      for (const z of COMPLIANCE_ZONES) {
        if (z.id === 'uk') map.uk = 'watch';
        else if (z.id !== 'edpb_eu') map[z.id] = 'watch';
      }
    } else if (scope === 'local') {
      map.edpb_eu = 'watch';
      for (const z of COMPLIANCE_ZONES) {
        const hit = z.countries.some((c) => flagged.has(norm(c)));
        if (hit) {
          map[z.id] = 'local_specific';
        }
      }
      for (const label of localMarketLabels) {
        const l = label.toLowerCase();
        if (l.includes('allem') || l.includes('german')) map.de = 'local_specific';
        if (l.includes('royaume') || l.includes('uk ') || l.includes('ico')) map.uk = 'local_specific';
        if (l.includes('ital')) map.it = 'local_specific';
        if (l.includes('espagn')) map.es = 'local_specific';
        if (l.includes('france') || l.includes('cnil')) map.fr = 'local_specific';
      }
    } else {
      map.edpb_eu = 'watch';
    }
  } else if (lastStatus === 'error') {
    for (const k of Object.keys(map)) {
      map[k] = 'watch';
    }
  }

  return map;
}

export function consentUpliftByZone(
  byCountry: Record<string, { total: number; all: number }>
): Record<string, { total: number; pctAll: number }> {
  const out: Record<string, { total: number; pctAll: number }> = {};
  for (const z of COMPLIANCE_ZONES) {
    if (z.id === 'edpb_eu') continue;
    let total = 0;
    let all = 0;
    for (const c of z.countries) {
      const s = byCountry[c];
      if (s) {
        total += s.total;
        all += s.all;
      }
    }
    out[z.id] = { total, pctAll: total ? Math.round((all / total) * 100) : 0 };
  }
  return out;
}
