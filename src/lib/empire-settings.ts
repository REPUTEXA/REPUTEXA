import raw from '../../targets/settings.json';

export type EmpireSettings = typeof raw;

const settings = raw as EmpireSettings;

export function getEmpireSettings(): EmpireSettings {
  return settings;
}

export function getBrandName(): string {
  return settings.brand.name;
}

export function getBrandShortName(): string {
  return settings.brand.shortName;
}

export function getDefaultEstablishmentName(): string {
  return settings.brand.defaultEstablishmentName;
}

export function getSiteUrl(): string {
  return settings.site.url;
}

/** Alias canonique (SEO, JSON-LD, Open Graph). */
export const EMPIRE_SITE_URL = getSiteUrl();

export function getPlanSlugLabel(slug: keyof EmpireSettings['plans']['slugLabels']): string {
  return settings.plans.slugLabels[slug];
}

/** Montants catalogue depuis `billing.plans.*.prices` (source unique). */
export function getPlanBasePricesEur(): { vision: number; pulse: number; zenith: number } {
  const b = settings.billing.plans;
  return {
    vision: b.vision.prices.EUR.amount,
    pulse: b.pulse.prices.EUR.amount,
    zenith: b.zenith.prices.EUR.amount,
  };
}

export function getPlanBasePricesUsd(): { vision: number; pulse: number; zenith: number } {
  const b = settings.billing.plans;
  return {
    vision: b.vision.prices.USD.amount,
    pulse: b.pulse.prices.USD.amount,
    zenith: b.zenith.prices.USD.amount,
  };
}

export function getPlanBasePricesGbp(): { vision: number; pulse: number; zenith: number } {
  const b = settings.billing.plans;
  return {
    vision: b.vision.prices.GBP.amount,
    pulse: b.pulse.prices.GBP.amount,
    zenith: b.zenith.prices.GBP.amount,
  };
}

export function getPlanBasePricesJpy(): { vision: number; pulse: number; zenith: number } {
  const b = settings.billing.plans;
  return {
    vision: b.vision.prices.JPY.amount,
    pulse: b.pulse.prices.JPY.amount,
    zenith: b.zenith.prices.JPY.amount,
  };
}

/** Taux indicatif EUR→CNY si la clé `CNY` manque dans `settings.json` (évite crash au chargement). */
const FALLBACK_CNY_PER_EUR = 7.63;

function cnyAmountOrFallback(
  plan: EmpireSettings['billing']['plans'][keyof EmpireSettings['billing']['plans']],
): number {
  const cny = plan.prices.CNY;
  if (cny && typeof cny.amount === 'number') return cny.amount;
  return Math.round(plan.prices.EUR.amount * FALLBACK_CNY_PER_EUR);
}

export function getPlanBasePricesCny(): { vision: number; pulse: number; zenith: number } {
  const b = settings.billing.plans;
  return {
    vision: cnyAmountOrFallback(b.vision),
    pulse: cnyAmountOrFallback(b.pulse),
    zenith: cnyAmountOrFallback(b.zenith),
  };
}

export function getPlanBasePricesChf(): { vision: number; pulse: number; zenith: number } {
  const b = settings.billing.plans;
  return {
    vision: b.vision.prices.CHF.amount,
    pulse: b.pulse.prices.CHF.amount,
    zenith: b.zenith.prices.CHF.amount,
  };
}

export function getPlanBasePricesCad(): { vision: number; pulse: number; zenith: number } {
  const b = settings.billing.plans;
  return {
    vision: b.vision.prices.CAD.amount,
    pulse: b.pulse.prices.CAD.amount,
    zenith: b.zenith.prices.CAD.amount,
  };
}

export function getPlanBasePricesAud(): { vision: number; pulse: number; zenith: number } {
  const b = settings.billing.plans;
  return {
    vision: b.vision.prices.AUD.amount,
    pulse: b.pulse.prices.AUD.amount,
    zenith: b.zenith.prices.AUD.amount,
  };
}

export type BillingPlanSlug = keyof EmpireSettings['billing']['plans'];

/** True si l’ID ressemble à un Price Stripe réel (exclut les placeholders `price_*_*_ID`). */
export function isConfiguredStripePriceId(id: string | undefined | null): id is string {
  if (!id || typeof id !== 'string') return false;
  if (!id.startsWith('price_')) return false;
  if (/_ID$/i.test(id)) return false;
  return id.length >= 20;
}

/**
 * Price ID mensuel depuis settings (si renseigné et non placeholder). Annuel : uniquement via .env pour l’instant.
 */
export function getStripePriceIdFromBillingSettings(
  slug: BillingPlanSlug,
  currency: 'EUR' | 'USD' | 'GBP' | 'JPY' | 'CNY' | 'CHF' | 'CAD' | 'AUD',
): string | null {
  const prices = settings.billing.plans[slug].prices as Record<
    string,
    { amount: number; stripePriceId: string } | undefined
  >;
  const row = prices[currency];
  if (!row) return null;
  const raw = row.stripePriceId;
  return isConfiguredStripePriceId(raw) ? raw : null;
}

export function getAnnualDiscountRate(): number {
  return settings.billing.annual_discount_rate;
}

/** Multiplicateur facturation annuelle sur le total mensuel (ex. 0.8 pour -20 %). */
export function getAnnualBillingMultiplier(): number {
  return 1 - settings.billing.annual_discount_rate;
}

/**
 * Remise volume multi-établissements : siège 1 = index 0, etc. (aligné Stripe Graduated).
 */
export function getVolumeDiscountPercentForSeatIndex(index: number): number {
  const tiers = settings.billing.volume_discounts_percent_by_seat_index;
  if (index < tiers.length) return tiers[index] ?? 0;
  return settings.billing.volume_discount_max_percent;
}

export function getPartnershipLuxuryBrands(): readonly string[] {
  return settings.partnership.luxury_brands;
}

export function getInterfaceEmailSenderDefault(): string {
  return settings.interface.email_sender_default;
}

export function getInterfaceEmailSenderStrategic(): string {
  return settings.interface.email_sender_strategic;
}

/** Remplace `{brand}` puis les autres `{clés}` fournies (e-mails / sujets depuis `interface.*`). */
export function expandInterfaceTemplate(template: string, extra: Record<string, string> = {}): string {
  let s = template.replace(/\{brand\}/g, getBrandName());
  for (const [key, val] of Object.entries(extra)) {
    s = s.split(`{${key}}`).join(val);
  }
  return s;
}

export function getContactEmailSubjectPrefix(): string {
  return expandInterfaceTemplate(settings.interface.contact_email_subject_prefix);
}

export function getContactInboxEmail(): string {
  return settings.interface.contact_inbox_email;
}

export function getContactHtmlHeading(): string {
  return expandInterfaceTemplate(settings.interface.contact_html_heading_template);
}

export function getContactFallbackSupportEmail(): string {
  return settings.interface.contact_fallback_support_email;
}

export function getResendVerifiedBaseAddress(): string {
  return settings.interface.resend_verified_base_address;
}

export function getInfoBroadcastTestEmailTitle(): string {
  return expandInterfaceTemplate(settings.interface.info_broadcast_test_email_title_template);
}

export function getInfoBroadcastTestCtaLabel(): string {
  return expandInterfaceTemplate(settings.interface.info_broadcast_test_cta_template);
}

export function getManifestStaticFields(): EmpireSettings['site']['manifest'] {
  return settings.site.manifest;
}

export function getOrganizationInstagramUrl(): string {
  return settings.site.organization.instagram;
}

export function getPwaIcons(): EmpireSettings['assets']['pwa_icons'] {
  return settings.assets.pwa_icons;
}
