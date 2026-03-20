import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';

// ── Config ────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min (Vercel Pro)

/** Nombre max de messages traités par run. */
const BATCH_LIMIT = 100;

/** Fenêtre de courtoisie Paris : 09h00 (inclus) → 21h00 (exclus). */
const WINDOW_START_H = 9;
const WINDOW_END_H   = 21;

// ── Types ─────────────────────────────────────────────────────────────────────

type QueueEntry = {
  id: string;
  user_id: string;
  first_name: string;
  phone: string;
  source_info: string | null;
  metadata: Record<string, unknown> | null;
};

type ProfileRow = {
  id: string;
  establishment_name: string | null;
  full_name: string | null;
  google_review_url: string | null;
};

type RunResult = {
  processed: number;
  sent: number;
  rescheduled: number;
  cancelled: number;
  failed: number;
  rgpd_anonymized: number;
  paris_hour?: number;
  next_window?: string;
  reason?: string;
};

type AnonymizeRow = {
  id: string;
  phone: string;
  metadata: Record<string, unknown> | null;
};

// ── RGPD helpers ──────────────────────────────────────────────────────────────

/**
 * Hash SHA-256 d'un numéro de téléphone.
 * Permet de conserver une empreinte unique sans stocker la donnée personnelle.
 */
function hashPhone(phone: string): string {
  return crypto.createHash('sha256').update(phone.trim()).digest('hex');
}

// ── Timezone helpers (Paris / DST-aware) ──────────────────────────────────────

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
 * Retourne true si l'instant est dans la fenêtre de courtoisie (09h–21h Paris).
 */
function isInCourtesyWindow(date: Date): boolean {
  const { hour } = getParisDateTime(date);
  return hour >= WINDOW_START_H && hour < WINDOW_END_H;
}

/**
 * Calcule l'heure UTC correspondant au lendemain 10h30 Paris (gère DST).
 * 10h30 = fenêtre de disponibilité optimale (post-café, avant déjeuner).
 * Itère les offsets plausibles (7h–11h UTC) pour trouver la correspondance exacte.
 */
function nextDayAt1030Paris(date: Date): Date {
  const { year, month, day } = getParisDateTime(date);
  for (let utcH = 7; utcH <= 11; utcH++) {
    const candidate = new Date(Date.UTC(year, month - 1, day + 1, utcH, 30, 0));
    const { hour: h, day: d } = getParisDateTime(candidate);
    if (h === 10 && d === day + 1) return candidate;
  }
  // Fallback sûr : 09h30 UTC = 10h30 CET
  return new Date(Date.UTC(year, month - 1, day + 1, 9, 30, 0));
}

// ── Message builder ───────────────────────────────────────────────────────────

/**
 * Construit le message WhatsApp de demande de permission (Étape A du workflow M. Martin).
 *
 * Ton : conseiller de luxe, vouvoiement impératif, chaleureux et non intrusif.
 * "1" → accord pour partager l'expérience (→ étape B : question ouverte)
 * "2" → refus poli (→ blacklist + message de remerciement)
 */
function buildMessage(firstName: string, commerceName: string, _reviewUrl: string | null): string {
  return (
    `Bonjour ${firstName} 👋\n\n` +
    `Merci d'avoir choisi ${commerceName} ! Nous espérons que votre visite s'est bien passée.\n\n` +
    `Seriez-vous d'accord pour nous partager votre ressenti en quelques mots ? ` +
    `Votre avis compte beaucoup pour nous 🙏\n\n` +
    `Répondez *1* pour partager votre expérience\n` +
    `Répondez *2* pour ne plus recevoir nos messages`
  );
}

// ── Core logic ────────────────────────────────────────────────────────────────

async function run(): Promise<RunResult> {
  const admin = createAdminClient();
  if (!admin) throw new Error('Supabase admin non configuré');

  const now    = new Date();
  const nowISO = now.toISOString();

  // ── 1. RGPD Anonymisation — entrées > 90 jours ───────────────────────────
  //
  // Au lieu de supprimer, on anonymise pour préserver les statistiques :
  //   - first_name  → NULL
  //   - phone       → SHA-256 (empreinte unique, non réversible)
  //   - metadata    → suppression de raw_phone et caller_ip
  //   - Conservation : user_id, status, sent_at, created_at
  //
  // Les enregistrements déjà anonymisés ont first_name = NULL (on les ignore).
  const rgpdCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: toAnonymize } = await admin
    .from('review_queue')
    .select('id, phone, metadata')
    .lt('created_at', rgpdCutoff)
    .not('first_name', 'is', null)   // déjà anonymisé si first_name est null
    .limit(500);

  let rgpdAnonymized = 0;

  if (toAnonymize?.length) {
    for (const raw of toAnonymize as AnonymizeRow[]) {
      const phoneHash   = hashPhone(raw.phone ?? '');
      const cleanedMeta = { ...(raw.metadata ?? {}) };
      delete cleanedMeta['raw_phone'];
      delete cleanedMeta['caller_ip'];
      cleanedMeta['anonymized_at'] = nowISO;

      await admin
        .from('review_queue')
        .update({
          first_name: null,
          phone: phoneHash,
          metadata: cleanedMeta,
        })
        .eq('id', raw.id);

      rgpdAnonymized++;
    }

    console.info(
      `[cron/send-messages] RGPD: ${rgpdAnonymized} entrée(s) anonymisée(s) ` +
      `(prénom effacé, téléphone hashé SHA-256, IP supprimée)`
    );
  }

  // ── 2. Fenêtre de courtoisie ─────────────────────────────────────────────
  if (!isInCourtesyWindow(now)) {
    const { hour } = getParisDateTime(now);
    const nextWindow    = nextDayAt1030Paris(now);
    const nextWindowISO = nextWindow.toISOString();

    // Reporter tous les pending échus au lendemain 09h05
    const { data: toReschedule } = await admin
      .from('review_queue')
      .select('id')
      .eq('status', 'pending')
      .lte('scheduled_at', nowISO);

    const ids = (toReschedule ?? []).map((r) => r.id as string);

    if (ids.length > 0) {
      await admin
        .from('review_queue')
        .update({ scheduled_at: nextWindowISO })
        .in('id', ids);

      console.info(
        `[cron/send-messages] Hors fenêtre (Paris ${hour}h). ` +
        `${ids.length} message(s) reporté(s) → ${nextWindowISO}`
      );
    }

    return {
      processed: 0, sent: 0, rescheduled: ids.length,
      cancelled: 0, failed: 0, rgpd_anonymized: rgpdAnonymized,
      paris_hour: hour, next_window: nextWindowISO,
      reason: 'outside_courtesy_window',
    };
  }

  // ── 3. Sélection du batch pending ────────────────────────────────────────
  const { data: queue, error: fetchError } = await admin
    .from('review_queue')
    .select('id, user_id, first_name, phone, source_info, metadata')
    .eq('status', 'pending')
    .lte('scheduled_at', nowISO)
    .order('scheduled_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (fetchError) throw new Error(fetchError.message);

  if (!queue?.length) {
    return { processed: 0, sent: 0, rescheduled: 0, cancelled: 0, failed: 0, rgpd_anonymized: rgpdAnonymized };
  }

  // ── 4. Chargement des profils (batch unique, pas de N+1) ─────────────────
  const userIds = Array.from(new Set((queue as QueueEntry[]).map((r) => r.user_id)));
  const { data: profilesRaw } = await admin
    .from('profiles')
    .select('id, establishment_name, full_name, google_review_url')
    .in('id', userIds);

  const profileMap = new Map<string, ProfileRow>(
    ((profilesRaw ?? []) as ProfileRow[]).map((p) => [p.id, p])
  );

  // ── 5. Traitement de chaque entrée ────────────────────────────────────────
  let sent = 0;
  let cancelled = 0;
  let failed = 0;

  for (const entry of queue as QueueEntry[]) {
    const { id, user_id: userId, first_name: firstName, phone } = entry;

    // ── 5a. Vérification blacklist (par entrée) ──────────────────────────
    const { data: blacklisted } = await admin
      .from('blacklist')
      .select('id')
      .eq('user_id', userId)
      .eq('phone', phone)
      .maybeSingle();

    if (blacklisted) {
      await admin
        .from('review_queue')
        .update({
          status: 'cancelled',
          metadata: {
            ...(entry.metadata ?? {}),
            cancelled_at: new Date().toISOString(),
            reason: 'blacklist',
          },
        })
        .eq('id', id);

      cancelled++;
      continue;
    }

    // ── 5b. Profil commerçant ────────────────────────────────────────────
    const profile       = profileMap.get(userId);
    const commerceName  =
      profile?.establishment_name?.trim() ||
      profile?.full_name?.trim() ||
      'votre commerce';
    const reviewUrl = profile?.google_review_url?.trim() || null;

    // ── 5c. Envoi WhatsApp ───────────────────────────────────────────────
    const message = buildMessage(firstName, commerceName, reviewUrl);
    const result  = await sendWhatsAppMessage(phone, message);

    if (result.success) {
      const sentAt = new Date().toISOString();
      await admin
        .from('review_queue')
        .update({
          status: 'sent',
          sent_at: sentAt,
          metadata: {
            ...(entry.metadata ?? {}),
            sent_at: sentAt,
            message_id: result.messageId ?? null,
            commerce_name: commerceName,
          },
        })
        .eq('id', id);

      sent++;
    } else {
      console.error(`[cron/send-messages] Échec entry=${id} phone=${phone}:`, result.error);
      await admin
        .from('review_queue')
        .update({
          status: 'failed',
          metadata: {
            ...(entry.metadata ?? {}),
            failed_at: new Date().toISOString(),
            error: result.error ?? 'Erreur inconnue',
          },
        })
        .eq('id', id);

      failed++;
    }
  }

  console.info(
    `[cron/send-messages] Traité=${queue.length} ` +
    `Envoyé=${sent} Annulé=${cancelled} Échoué=${failed}`
  );

  return {
    processed: queue.length,
    sent, rescheduled: 0, cancelled, failed,
    rgpd_anonymized: rgpdAnonymized,
  };
}

// ── Route handlers ────────────────────────────────────────────────────────────

function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  return !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

/**
 * POST /api/cron/send-messages
 * Appelé par un planificateur externe (Zapier, cURL, etc.).
 */
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await run();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[cron/send-messages] POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/send-messages
 * Alias GET pour compatibilité Vercel Crons (schedule: "* /15 * * * *").
 */
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await run();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[cron/send-messages] GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
