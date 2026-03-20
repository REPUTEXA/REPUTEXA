/**
 * POST /api/webhooks/:api_key
 *
 * Webhook d'ingestion client — version clé-dans-l'URL (format rtx_live_<uuid>).
 *
 * Authentification : la clé est passée directement dans le chemin d'URL.
 * Aucun header supplémentaire requis — compatible avec tous les POS et Zapier.
 *
 * Payload JSON attendu :
 *   {
 *     "first_name":    "Sophie",
 *     "phone":         "+33612345678",
 *     "last_purchase": "Soin Kératine",    // optionnel
 *     "source_info":   "Zelty / Caisse 1"  // optionnel
 *   }
 *
 * Sécurités :
 *   1. Validation de la clé API         → 401 si invalide / révoquée
 *   2. Vérification blacklist RGPD      → 200 silencieux
 *   3. Anti-spam 90 jours              → 200 silencieux
 *   4. Anti-doublon 5 minutes          → 200 silencieux (même téléphone + même achat)
 *   5. Fenêtre de courtoisie 09h–21h   → report automatique au lendemain 10h30
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizePhone } from '@/lib/zenith-capture/can-contact';

// ── Timezone / courtesy window helpers ────────────────────────────────────────

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

/** Fenêtre de courtoisie : 09h00–21h00 Paris. */
function isInCourtesyWindow(date: Date): boolean {
  const { hour } = getParisDateTime(date);
  return hour >= 9 && hour < 21;
}

/** Lendemain 10h30 Paris, DST-aware. */
function nextDayAt1030Paris(date: Date): string {
  const { year, month, day } = getParisDateTime(date);
  for (let utcH = 7; utcH <= 11; utcH++) {
    const candidate = new Date(Date.UTC(year, month - 1, day + 1, utcH, 30, 0));
    const { hour: h, day: d } = getParisDateTime(candidate);
    if (h === 10 && d === day + 1) return candidate.toISOString();
  }
  return new Date(Date.UTC(year, month - 1, day + 1, 9, 30, 0)).toISOString();
}

/** Calcule scheduled_at avec jitter ±15% et sécurité sommeil. */
function computeScheduledAt(targetMinutes: number): { scheduledAt: string; finalMinutes: number } {
  const jitter       = 0.85 + Math.random() * 0.30;           // [0.85 – 1.15]
  const finalMinutes = Math.round(targetMinutes * jitter);
  const scheduled    = new Date(Date.now() + finalMinutes * 60_000);

  const scheduledAt = isInCourtesyWindow(scheduled)
    ? scheduled.toISOString()
    : nextDayAt1030Paris(scheduled);

  return { scheduledAt, finalMinutes };
}

// ── Plan de vol des délais par catégorie ─────────────────────────────────────

/**
 * Délai post-visite (minutes) selon la catégorie métier.
 * Synchronisé avec CATEGORY_DELAYS dans zenith/route.ts et ACTIVITY_PROFILES dashboard.
 */
const CATEGORY_DELAYS: Record<string, number> = {
  restaurant:   45,    // Repas terminé, client encore dans l'élan
  bakery:       120,   // Boulangerie : rentré chez lui, savoure
  beauty:       180,   // Coiffeur / esthétique : 3h après le soin
  garage:       1440,  // Garage : 24h après récupération du véhicule
  hotel:        120,   // Hôtel : 2h post check-out, en route
  artisan:      240,   // Artisan : 4h après fin de chantier
  fast_service: 20,    // Pharmacie, vente rapide : 20 min
  custom:       0,     // Délai libre → utilise webhook_send_delay_minutes
};

// ── Types ─────────────────────────────────────────────────────────────────────

type WebhookBody = {
  first_name?:   string;
  phone?:        string;
  last_purchase?: string;
  source_info?:  string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCallerIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ api_key: string }> }
) {
  const { api_key } = await params;

  // ── 1. Validation de la clé API ───────────────────────────────────────────
  if (!api_key?.startsWith('rtx_live_')) {
    return NextResponse.json(
      { error: 'Clé API invalide.' },
      { status: 401 }
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error('[webhooks/api_key] Supabase admin non configuré');
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, subscription_plan, selected_plan, webhook_send_delay_minutes, business_category')
    .eq('api_key', api_key)
    .maybeSingle();

  if (profileError) {
    console.error('[webhooks/api_key] profiles lookup:', profileError.message);
    return NextResponse.json({ error: 'Erreur de vérification de la clé.' }, { status: 500 });
  }

  if (!profile?.id) {
    return NextResponse.json(
      { error: 'Clé API invalide ou révoquée.' },
      { status: 401 }
    );
  }

  const userId = profile.id as string;

  // ── 2. Parsing et validation du body ─────────────────────────────────────
  let body: Partial<WebhookBody>;
  try {
    body = (await request.json()) as Partial<WebhookBody>;
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide.' }, { status: 400 });
  }

  const firstName   = typeof body.first_name   === 'string' ? body.first_name.trim()   : '';
  const phoneRaw    = typeof body.phone        === 'string' ? body.phone.trim()        : '';
  const lastPurchase = typeof body.last_purchase === 'string' && body.last_purchase.trim()
    ? body.last_purchase.trim()
    : null;
  const sourceInfo  = typeof body.source_info  === 'string' && body.source_info.trim()
    ? body.source_info.trim()
    : null;

  if (!firstName) {
    return NextResponse.json({ error: 'Le champ first_name est requis.' }, { status: 400 });
  }
  if (!phoneRaw) {
    return NextResponse.json({ error: 'Le champ phone est requis.' }, { status: 400 });
  }

  const phone = normalizePhone(phoneRaw);

  // ── 3. Vérification blacklist RGPD ────────────────────────────────────────
  const { data: blacklisted } = await admin
    .from('blacklist')
    .select('id')
    .eq('user_id', userId)
    .eq('phone', phone)
    .maybeSingle();

  if (blacklisted) {
    return NextResponse.json({ ok: true, queued: false, reason: 'blacklist' });
  }

  // ── 4. Anti-spam 90 jours ─────────────────────────────────────────────────
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentEntry } = await admin
    .from('review_queue')
    .select('id')
    .eq('user_id', userId)
    .eq('phone', phone)
    .eq('status', 'sent')
    .gte('sent_at', ninetyDaysAgo)
    .limit(1)
    .maybeSingle();

  if (recentEntry) {
    return NextResponse.json({ ok: true, queued: false, reason: 'already_contacted_90_days' });
  }

  // ── 5. Anti-doublon 5 minutes (même téléphone + même last_purchase) ───────
  // Bloque les appels webhook dupliqués (retry POS, double-clic Zapier, etc.)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const duplicateQuery = admin
    .from('review_queue')
    .select('id')
    .eq('user_id', userId)
    .eq('phone', phone)
    .gte('created_at', fiveMinutesAgo)
    .limit(1);

  // Filtre sur last_purchase (null ou valeur identique)
  if (lastPurchase) {
    duplicateQuery.eq('metadata->>last_purchase', lastPurchase);
  } else {
    duplicateQuery.is('metadata->>last_purchase', null);
  }

  const { data: duplicate } = await duplicateQuery.maybeSingle();

  if (duplicate) {
    return NextResponse.json({ ok: true, queued: false, reason: 'duplicate_5min' });
  }

  // ── 6. Calcul scheduled_at (délai adaptatif + fenêtre courtoisie) ─────────
  const category      = (profile.business_category as string | null) ?? 'custom';
  const categoryDelay = category !== 'custom' ? (CATEGORY_DELAYS[category] ?? 45) : 0;
  const targetMinutes = categoryDelay > 0
    ? categoryDelay
    : ((profile.webhook_send_delay_minutes as number | null) ?? 45);

  const { scheduledAt, finalMinutes } = computeScheduledAt(targetMinutes);
  const callerIp = getCallerIp(request);

  // ── 7. Insertion dans review_queue ────────────────────────────────────────
  const { error: insertError } = await admin.from('review_queue').insert({
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
      ingress:        'api_key',    // traçabilité : distingue de la route zenith (header)
    },
  });

  if (insertError) {
    console.error('[webhooks/api_key] review_queue insert:', insertError.message);
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement en file d'attente." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok:            true,
      queued:        true,
      scheduled_at:  scheduledAt,
      delay_minutes: finalMinutes,
    },
    { status: 200 }
  );
}
