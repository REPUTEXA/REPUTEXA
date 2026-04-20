/**
 * Utilitaires partagés de planification pour les webhooks d'ingestion.
 * Utilisé par : app/api/webhooks/[api_key]/route.ts et app/api/webhooks/zenith/route.ts
 */

// ── Timezone helpers (Paris / DST-aware) ───────────────────────────────────

type ParisDateTime = { year: number; month: number; day: number; hour: number };

export function getParisDateTime(date: Date): ParisDateTime {
  const fmt = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

/** Fenêtre de courtoisie : 09h00–21h00 heure de Paris. */
export function isInCourtesyWindow(date: Date): boolean {
  const { hour } = getParisDateTime(date);
  return hour >= 9 && hour < 21;
}

/** Lendemain 10h30 heure de Paris, DST-aware. */
export function nextDayAt1030Paris(date: Date): string {
  const { year, month, day } = getParisDateTime(date);
  for (let utcH = 7; utcH <= 11; utcH++) {
    const candidate = new Date(Date.UTC(year, month - 1, day + 1, utcH, 30, 0));
    const { hour: h, day: d } = getParisDateTime(candidate);
    if (h === 10 && d === day + 1) return candidate.toISOString();
  }
  return new Date(Date.UTC(year, month - 1, day + 1, 9, 30, 0)).toISOString();
}

/**
 * Calcule scheduled_at avec jitter ±15% et sécurité fenêtre de sommeil.
 * Formule : finalDelay = targetMinutes × (0.85 + random() × 0.30)
 * Si l'heure tombe hors 09h–21h Paris → report au lendemain 10h30.
 */
export function computeScheduledAt(targetMinutes: number): { scheduledAt: string; finalMinutes: number } {
  const jitter = 0.85 + Math.random() * 0.30; // [0.85 – 1.15]
  const finalMinutes = Math.round(targetMinutes * jitter);
  const scheduled = new Date(Date.now() + finalMinutes * 60_000);

  const scheduledAt = isInCourtesyWindow(scheduled)
    ? scheduled.toISOString()
    : nextDayAt1030Paris(scheduled);

  return { scheduledAt, finalMinutes };
}

// ── Délais adaptatifs par catégorie métier (minutes) ───────────────────────
//
// Synchronisé entre api_key et zenith webhooks.

export const CATEGORY_DELAYS: Record<string, number> = {
  restaurant:   45,    // Repas terminé, client encore dans l'élan
  bakery:       120,   // Boulangerie : rentré chez lui, savoure
  beauty:       180,   // Coiffeur / esthétique : 3h après le soin
  garage:       1440,  // Garage : 24h après récupération du véhicule
  hotel:        120,   // Hôtel : 2h post check-out, en route
  artisan:      240,   // Artisan : 4h après fin de chantier
  fast_service: 20,    // Pharmacie, vente rapide : 20 min
  ecommerce:    120,   // E-commerce : 2h après réception colis — aligné dashboard
  custom:       0,     // Délai libre → utilise webhook_send_delay_minutes
};

// ── IP helper ─────────────────────────────────────────────────────────────

/** Extrait l'IP réelle de l'appelant (Vercel / proxy-aware). */
export function getCallerIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}
