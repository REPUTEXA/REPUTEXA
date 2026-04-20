/**
 * Logique d'ingestion e-commerce : livraison (statut Livré), consentement RGPD,
 * délai post-livraison selon la stratégie commerçant.
 */

export type EcommerceDeliveryStrategy = 'immediate_pleasure' | 'test_mount' | 'custom';

/** Minutes après le scan « Livré » (transporteur). */
export const POST_DELIVERY_MINUTES: Record<
  Exclude<EcommerceDeliveryStrategy, 'custom'>,
  number
> = {
  immediate_pleasure: 120, // 2h — vêtements, gadgets
  test_mount: 1440, // 24h — meubles, high-tech
};

/** Bornes pour le délai personnalisé (minutes). */
export const POST_DELIVERY_CUSTOM_MIN = 30;
export const POST_DELIVERY_CUSTOM_MAX = 10080; // 7 jours

export type ParsedShipmentStatus = 'delivered' | 'shipped' | 'pending';

const STATUS_ALIASES = [
  'status',
  'delivery_status',
  'order_status',
  'shipment_status',
  'parcel_status',
  'tracking_status',
];

/**
 * Résout le statut d'expédition depuis le payload (string).
 * Par défaut : pending (pas encore livré → pas d'envoi programmé).
 */
export function parseShipmentStatus(raw: string | undefined | null): ParsedShipmentStatus {
  if (raw == null || String(raw).trim() === '') return 'pending';
  const s = String(raw).trim().toLowerCase();
  // Livré
  if (
    s === 'delivered' ||
    s === 'livré' ||
    s === 'livre' ||
    s.includes('delivered') ||
    s.includes('livré') ||
    s.includes('delivery_complete') ||
    s.includes('consegnat') ||
    s.includes('entregad') ||
    s.includes('entregue') ||
    s.includes('zugestellt') ||
    s.includes('geliefert') ||
    s.includes('ausgeliefert') ||
    (s.includes('配達') && (s.includes('完了') || s.includes('済'))) ||
    s.includes('已送达') ||
    (s.includes('派送') && s.includes('完'))
  ) {
    return 'delivered';
  }
  // Expédié / en transit
  if (
    s === 'shipped' ||
    s === 'expédié' ||
    s === 'expedie' ||
    s.includes('shipped') ||
    s.includes('in_transit') ||
    s.includes('transit')
  ) {
    return 'shipped';
  }
  return 'pending';
}

/** Première valeur string non vide parmi les clés (insensible à la casse). */
export function resolveStringField(
  body: Record<string, unknown>,
  candidates: string[]
): string {
  const normalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    normalized[k.toLowerCase().trim()] = v;
  }
  for (const key of candidates) {
    const val = normalized[key.toLowerCase()];
    if (typeof val === 'string' && val.trim()) return val.trim();
    if (typeof val === 'number') return String(val);
  }
  return '';
}

export function resolveShipmentStatus(body: Record<string, unknown>): ParsedShipmentStatus {
  const raw = resolveStringField(body, STATUS_ALIASES);
  return parseShipmentStatus(raw);
}

/**
 * True si le payload contient au moins un champ de statut livraison non vide
 * (status, delivery_status, order_status, etc.).
 * Si aucun → mode « hybride » : pas d’attente « Livré », file d’attente comme un test / intégration rapide.
 */
export function hasShipmentStatusField(body: Record<string, unknown>): boolean {
  const normalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    normalized[k.toLowerCase().trim()] = v;
  }
  for (const key of STATUS_ALIASES) {
    const val = normalized[key.toLowerCase()];
    if (val === undefined || val === null) continue;
    if (typeof val === 'string' && val.trim() === '') continue;
    if (typeof val === 'number' && !Number.isFinite(val)) continue;
    return true;
  }
  return false;
}

export type ConsentParse = 'yes' | 'no' | 'missing';

const CONSENT_ALIASES = [
  'whatsapp_consent',
  'consent',
  'marketing_consent',
  'rgpd_whatsapp_consent',
  'accepte_whatsapp',
  'opt_in_whatsapp',
];

/**
 * Consentement explicite pour contact WhatsApp (checkout Shopify / Stripe, etc.).
 */
export function parseWhatsappConsent(body: Record<string, unknown>): ConsentParse {
  const normalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    normalized[k.toLowerCase().trim()] = v;
  }
  for (const key of CONSENT_ALIASES) {
    const raw = normalized[key];
    if (raw === undefined) continue;
    if (typeof raw === 'boolean') return raw ? 'yes' : 'no';
    if (typeof raw === 'number') return raw === 1 ? 'yes' : 'no';
    if (typeof raw === 'string') {
      const s = raw.trim().toLowerCase();
      if (['true', '1', 'yes', 'oui', 'ok', 'y', 'o'].includes(s)) return 'yes';
      if (['false', '0', 'no', 'non', 'n'].includes(s)) return 'no';
    }
  }
  return 'missing';
}

const TRACKING_ALIASES = [
  'tracking_number',
  'tracking',
  'numero_suivi',
  'numéro_suivi',
  'suivi',
  'parcel_tracking',
  'carrier_tracking',
];

export function resolveTrackingNumber(body: Record<string, unknown>): string {
  return resolveStringField(body, TRACKING_ALIASES);
}

export function strategyToMinutes(
  strategy: string | null | undefined,
  customMinutes?: number | null
): number {
  if (strategy === 'custom') {
    const m = Math.round(Number(customMinutes));
    if (Number.isFinite(m) && m >= POST_DELIVERY_CUSTOM_MIN) {
      return Math.min(m, POST_DELIVERY_CUSTOM_MAX);
    }
    return POST_DELIVERY_MINUTES.immediate_pleasure;
  }
  const s = (strategy === 'test_mount' ? 'test_mount' : 'immediate_pleasure') as
    | 'immediate_pleasure'
    | 'test_mount';
  return POST_DELIVERY_MINUTES[s];
}
