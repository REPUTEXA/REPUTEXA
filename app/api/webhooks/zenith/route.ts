import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizePhone } from '@/lib/zenith-capture/can-contact';

// ── Timezone / jitter helpers ─────────────────────────────────────────────────

type ParisDateTime = { year: number; month: number; day: number; hour: number };

function getParisDateTime(date: Date): ParisDateTime {
  const fmt = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

/**
 * Vérifie si une date tombe dans la fenêtre de courtoisie Paris (09h–21h).
 */
function isInCourtesyWindow(date: Date): boolean {
  const { hour } = getParisDateTime(date);
  return hour >= 9 && hour < 21;
}

/**
 * Calcule l'ISO correspondant au lendemain 10h30 Paris (gère DST).
 * 10h30 = fenêtre de disponibilité optimale (post-café, avant déjeuner).
 */
function nextDayAt1030Paris(date: Date): string {
  const { year, month, day } = getParisDateTime(date);
  for (let utcH = 7; utcH <= 11; utcH++) {
    const candidate = new Date(Date.UTC(year, month - 1, day + 1, utcH, 30, 0));
    const { hour: h, day: d } = getParisDateTime(candidate);
    if (h === 10 && d === day + 1) return candidate.toISOString();
  }
  // Fallback sûr : 09h30 UTC = 10h30 CET
  return new Date(Date.UTC(year, month - 1, day + 1, 9, 30, 0)).toISOString();
}

/**
 * Calcule le scheduled_at avec jitter ±15% et sécurité heures de sommeil.
 *
 * Formule : finalDelay = targetMinutes * (0.85 + Math.random() * 0.30)
 * Si l'heure d'envoi calculée tombe hors fenêtre 09h-21h Paris → report au lendemain 10h30.
 *
 * @param targetMinutes Délai cible du profil métier (ex: 45 pour Restauration)
 * @returns ISO string du scheduled_at final
 */
function computeScheduledAt(targetMinutes: number): { scheduledAt: string; finalMinutes: number } {
  const jitterFactor  = 0.85 + Math.random() * 0.30;          // [0.85, 1.15]
  const finalMinutes  = Math.round(targetMinutes * jitterFactor);
  const scheduledDate = new Date(Date.now() + finalMinutes * 60 * 1000);

  const scheduledAt = isInCourtesyWindow(scheduledDate)
    ? scheduledDate.toISOString()
    : nextDayAt1030Paris(scheduledDate);

  return { scheduledAt, finalMinutes };
}

// ── Délais adaptatifs par catégorie métier ────────────────────────────────────

/**
 * Délai post-visite par défaut (en minutes) selon la catégorie du commerce.
 * Utilisé quand business_category !== 'custom'.
 *
 * Plan de vol validé :
 *   restaurant   → 45 min   (quitte le restaurant, repas terminé)
 *   bakery       → 120 min  (boulangerie : revenu chez lui, savoure sa viennoiserie)
 *   beauty       → 180 min  (coiffeur/salon de beauté : 3h après le soin)
 *   garage       → 1440 min (garage : 24h après récupération du véhicule)
 *   hotel        → 120 min  (hôtel : 2h post check-out, en route)
 *   artisan      → 240 min  (artisan / prestataire : 4h après la fin du chantier)
 *   fast_service → 20 min   (pharmacie, vente à emporter, service rapide)
 *   custom       → 0        (utilise webhook_send_delay_minutes du profil)
 */
const CATEGORY_DELAYS: Record<string, number> = {
  restaurant:    45,
  bakery:        120,
  beauty:        180,
  garage:        1440,
  hotel:         120,
  artisan:       240,
  fast_service:  20,
  custom:        0,
};

// ── Types ─────────────────────────────────────────────────────────────────────

type ZenithWebhookPayload = {
  first_name: string;
  phone: string;
  source_info?: string;
  last_purchase?: string;   // Nom du dernier achat/service (ex: "Soin Kératine")
};

type ReviewQueueInsert = {
  user_id: string;
  first_name: string;
  phone: string;
  source_info: string | null;
  status: 'pending';
  scheduled_at: string;
  metadata: {
    caller_ip: string;
    raw_phone: string;
    source_info: string | null;
    last_purchase: string | null;
    received_at: string;
    target_minutes: number;
    final_minutes: number;
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extrait l'IP réelle de l'appelant (Vercel / proxy-aware). */
function getCallerIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

// ── Route ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/webhooks/zenith
 *
 * Webhook d'entrée des données clients depuis un POS (Zelty, Lightspeed, Zapier…).
 * Authentifié par le header `x-reputexa-token` (token unique par commerçant Zenith).
 *
 * Payload JSON attendu :
 *   {
 *     "first_name": "Jean",
 *     "phone": "+33612345678",
 *     "source_info": "Zelty / Caisse Centrale",    // optionnel
 *     "last_purchase": "Soin Kératine"             // optionnel — personnalise l'étape 2
 *   }
 *
 * Logique :
 *   1. Authentification par token → résolution du user_id commerçant
 *   2. Vérification blacklist RGPD
 *   3. Insertion dans review_queue avec scheduled_at = now + 30 min
 *   4. IP de l'appelant stockée dans metadata (traçabilité RGPD)
 */
export async function POST(request: Request) {
  // ── 1. Vérification du header d'authentification ──────────────────────────
  const token = request.headers.get('x-reputexa-token')?.trim();
  if (!token) {
    return NextResponse.json(
      { error: 'Header x-reputexa-token manquant.' },
      { status: 401 }
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error('[webhooks/zenith] Supabase admin client non configuré');
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }

  // ── 2. Résolution du commerçant via webhook_token ─────────────────────────
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, subscription_plan, selected_plan, webhook_send_delay_minutes, business_category')
    .eq('webhook_token', token)
    .maybeSingle();

  if (profileError) {
    console.error('[webhooks/zenith] profiles lookup:', profileError.message);
    return NextResponse.json({ error: 'Erreur de vérification du token.' }, { status: 500 });
  }

  if (!profile?.id) {
    return NextResponse.json(
      { error: 'Token invalide ou révoqué.' },
      { status: 401 }
    );
  }

  const userId = profile.id as string;

  // ── 3. Parse et validation du body JSON ──────────────────────────────────
  let body: Partial<ZenithWebhookPayload>;
  try {
    body = (await request.json()) as Partial<ZenithWebhookPayload>;
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide.' }, { status: 400 });
  }

  const firstName = typeof body.first_name === 'string' ? body.first_name.trim() : '';
  const phoneRaw  = typeof body.phone === 'string' ? body.phone.trim() : '';
  const sourceInfo =
    typeof body.source_info === 'string' && body.source_info.trim()
      ? body.source_info.trim()
      : null;
  const lastPurchase =
    typeof body.last_purchase === 'string' && body.last_purchase.trim()
      ? body.last_purchase.trim()
      : null;

  if (!firstName) {
    return NextResponse.json({ error: 'Le champ first_name est requis.' }, { status: 400 });
  }
  if (!phoneRaw) {
    return NextResponse.json({ error: 'Le champ phone est requis.' }, { status: 400 });
  }

  // Normalisation E.164 compatible (ex: 0612345678 → 33612345678)
  const phone = normalizePhone(phoneRaw);

  // ── 4. Vérification blacklist RGPD ────────────────────────────────────────
  const { data: blacklisted, error: blacklistError } = await admin
    .from('blacklist')
    .select('id')
    .eq('user_id', userId)
    .eq('phone', phone)
    .maybeSingle();

  if (blacklistError) {
    console.error('[webhooks/zenith] blacklist check:', blacklistError.message);
    return NextResponse.json({ error: 'Erreur de vérification blacklist.' }, { status: 500 });
  }

  if (blacklisted) {
    // On répond 200 pour ne pas exposer qu'un numéro est blacklisté
    return NextResponse.json({ ok: true, queued: false, reason: 'blacklist' });
  }

  // ── 5. Anti-spam 90 jours — vérifie review_queue ─────────────────────────
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentEntry } = await admin
    .from('review_queue')
    .select('id, sent_at')
    .eq('user_id', userId)
    .eq('phone', phone)
    .eq('status', 'sent')
    .gte('sent_at', ninetyDaysAgo)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentEntry) {
    return NextResponse.json({
      ok: true,
      queued: false,
      reason: 'already_contacted_90_days',
    });
  }

  // ── 6. Calcul scheduled_at avec jitter ±15% et sécurité sommeil ──────────
  //
  // Délai cible : business_category détermine le délai par défaut.
  // Si business_category = 'custom', utilise webhook_send_delay_minutes (config manuelle).
  // Formule jitter : finalDelay = targetMinutes * (0.85 + Math.random() * 0.30)
  // Si l'heure calculée > 21h Paris → report automatique au lendemain 10h30.
  const category       = (profile.business_category as string | null) ?? 'custom';
  const categoryDelay  = category !== 'custom' ? (CATEGORY_DELAYS[category] ?? 45) : 0;
  const targetMinutes  = categoryDelay > 0
    ? categoryDelay
    : ((profile.webhook_send_delay_minutes as number | null) ?? 45);
  const { scheduledAt, finalMinutes } = computeScheduledAt(targetMinutes);
  const callerIp = getCallerIp(request);

  // ── 7. Insertion dans review_queue ───────────────────────────────────────
  const row: ReviewQueueInsert = {
    user_id:      userId,
    first_name:   firstName,
    phone:        phone,
    source_info:  sourceInfo,
    status:       'pending',
    scheduled_at: scheduledAt,
    metadata: {
      caller_ip:      callerIp,
      raw_phone:      phoneRaw,
      source_info:    sourceInfo,
      last_purchase:  lastPurchase,
      received_at:    new Date().toISOString(),
      target_minutes: targetMinutes,
      final_minutes:  finalMinutes,
    },
  };

  const { error: insertError } = await admin.from('review_queue').insert(row);

  if (insertError) {
    console.error('[webhooks/zenith] review_queue insert:', insertError.message);
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement en file d'attente." },
      { status: 500 }
    );
  }

  // ── 8. Réponse succès ─────────────────────────────────────────────────────
  return NextResponse.json(
    {
      ok: true,
      queued: true,
      scheduled_at: scheduledAt,
      delay_minutes: finalMinutes,       // délai réel après jitter (pour debug)
    },
    { status: 200 }
  );
}
