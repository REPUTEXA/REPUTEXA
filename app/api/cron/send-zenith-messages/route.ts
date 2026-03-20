import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';

// ── Config ────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max (Vercel Pro)

/** Batch size par exécution (évite les timeouts sur gros volumes). */
const BATCH_LIMIT = 100;

/** Fenêtre de courtoisie : INTERDICTION d'envoyer hors de 09h00–21h00 Paris. */
const WINDOW_START_H = 9;
const WINDOW_END_H = 21;

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

// ── Timezone helpers ──────────────────────────────────────────────────────────

type ParisDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
};

/**
 * Extrait les composants date/heure d'une Date en fuseau Europe/Paris.
 * Utilise Intl.DateTimeFormat pour une gestion correcte du DST (UTC+1/UTC+2).
 */
function getParisDateTime(date: Date): ParisDateTime {
  const fmt = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

  return {
    year:  get('year'),
    month: get('month'),
    day:   get('day'),
    hour:  get('hour'),
  };
}

/**
 * Retourne true si l'heure Paris actuelle est dans la fenêtre de courtoisie
 * (09h00 inclus — 21h00 exclus).
 */
function isInCourtesyWindow(date: Date): boolean {
  const { hour } = getParisDateTime(date);
  return hour >= WINDOW_START_H && hour < WINDOW_END_H;
}

/**
 * Calcule l'heure UTC qui correspond au lendemain 10h30 Paris.
 * 10h30 = fenêtre de disponibilité optimale (post-café, avant déjeuner).
 * Gère automatiquement le DST (UTC+1 hiver / UTC+2 été) par itération.
 */
function nextDayAt1030Paris(date: Date): Date {
  const { year, month, day } = getParisDateTime(date);

  for (let utcHour = 7; utcHour <= 11; utcHour++) {
    const candidate = new Date(Date.UTC(year, month - 1, day + 1, utcHour, 30, 0));
    const { hour: candidateHour, day: candidateDay } = getParisDateTime(candidate);
    if (candidateHour === 10 && candidateDay === day + 1) {
      return candidate;
    }
  }
  // Fallback sûr : 09h30 UTC = 10h30 CET
  return new Date(Date.UTC(year, month - 1, day + 1, 9, 30, 0));
}

/** Hash SHA-256 d'un numéro de téléphone (RGPD — non réversible). */
function hashPhone(phone: string): string {
  return crypto.createHash('sha256').update(phone.trim()).digest('hex');
}

type AnonymizeRow = {
  id: string;
  phone: string;
  metadata: Record<string, unknown> | null;
};

// ── Message builder ───────────────────────────────────────────────────────────

function buildMessage(
  firstName: string,
  establishmentName: string,
  googleReviewUrl: string | null
): string {
  const ctaLine = googleReviewUrl
    ? `\n\nVotre avis nous aide à progresser ✨ Il suffit de 30 secondes :\n${googleReviewUrl}`
    : `\n\nVotre avis nous aide à progresser ✨ Répondez à ce message pour partager votre expérience.`;

  return (
    `Bonjour ${firstName} 👋, comment s'est passée votre expérience chez ${establishmentName} ?` +
    ctaLine +
    '\n\nPour ne plus recevoir ce message, répondez STOP.'
  );
}

// ── Cron Route ────────────────────────────────────────────────────────────────

/**
 * GET /api/cron/send-zenith-messages
 *
 * Facteur Intelligent — déqueue et envoie les messages WhatsApp de sollicitation.
 * Protégé par Authorization: Bearer CRON_SECRET.
 * Planifié toutes les 15 minutes via Vercel Crons (nécessite Vercel Pro).
 *
 * Comportement :
 *  1. Auth + init admin
 *  2. RGPD Cleanup : supprime les entrées > 90 jours
 *  3. Fenêtre de courtoisie : si hors 09h–21h Paris → reporte TOUT au lendemain 09h05
 *  4. Fetch batch pending (scheduled_at <= now)
 *  5. Pour chaque entrée : récupère profil, construit message, envoie
 *  6. status = 'sent' (+ sent_at) ou 'failed' (+ error dans metadata)
 */
export async function GET(request: Request) {
  // ── 1. Authentification ────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const now = new Date();
  const nowISO = now.toISOString();

  // ── 2. RGPD Anonymisation — entrées > 90 jours ────────────────────────────
  //
  // Anonymisation plutôt que suppression : préserve les statistiques historiques.
  //   - first_name  → NULL
  //   - phone       → SHA-256 (non réversible, conserve l'unicité)
  //   - metadata    → suppression de raw_phone + caller_ip
  const rgpdCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: toAnonymize } = await admin
    .from('review_queue')
    .select('id, phone, metadata')
    .lt('created_at', rgpdCutoff)
    .not('first_name', 'is', null)
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
        .update({ first_name: null, phone: phoneHash, metadata: cleanedMeta })
        .eq('id', raw.id);

      rgpdAnonymized++;
    }
    console.info(
      `[cron/send-zenith-messages] RGPD: ${rgpdAnonymized} entrée(s) anonymisée(s) (SHA-256)`,
    );
  }

  // ── 3. Vérification de la fenêtre de courtoisie (Paris) ───────────────────
  if (!isInCourtesyWindow(now)) {
    const nextWindow = nextDayAt1030Paris(now);
    const nextWindowISO = nextWindow.toISOString();
    const { hour } = getParisDateTime(now);

    // Récupère les IDs à reporter
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
        `[cron/send-zenith-messages] Hors fenêtre (Paris ${hour}h). ` +
        `${ids.length} messages reportés au ${nextWindowISO}`
      );
    }

    return NextResponse.json({
      processed: 0,
      sent: 0,
      rescheduled: ids.length,
      failed: 0,
      rgpd_anonymized: rgpdAnonymized,
      reason: 'outside_courtesy_window',
      paris_hour: hour,
      next_window: nextWindowISO,
    });
  }

  // ── 4. Récupération du batch pending ─────────────────────────────────────
  const { data: queue, error: fetchError } = await admin
    .from('review_queue')
    .select('id, user_id, first_name, phone, source_info, metadata')
    .eq('status', 'pending')
    .lte('scheduled_at', nowISO)
    .order('scheduled_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (fetchError) {
    console.error('[cron/send-zenith-messages] fetch:', fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!queue?.length) {
    return NextResponse.json({ processed: 0, sent: 0, rescheduled: 0, failed: 0 });
  }

  // ── 5. Chargement des profils marchands (batch) ───────────────────────────
  const userIds = Array.from(new Set((queue as QueueEntry[]).map((r) => r.user_id)));
  const { data: profilesRaw } = await admin
    .from('profiles')
    .select('id, establishment_name, full_name, google_review_url')
    .in('id', userIds);

  const profileMap = new Map<string, ProfileRow>(
    ((profilesRaw ?? []) as ProfileRow[]).map((p) => [p.id, p])
  );

  // ── 6. Envoi de chaque message ─────────────────────────────────────────────
  let sent = 0;
  let failed = 0;

  for (const entry of queue as QueueEntry[]) {
    const profile = profileMap.get(entry.user_id);

    const establishmentName =
      profile?.establishment_name?.trim() ||
      profile?.full_name?.trim() ||
      'notre établissement';

    const googleReviewUrl = profile?.google_review_url?.trim() || null;

    const message = buildMessage(entry.first_name, establishmentName, googleReviewUrl);

    const result = await sendWhatsAppMessage(entry.phone, message);

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
            establishment_name: establishmentName,
          },
        })
        .eq('id', entry.id);

      sent++;
    } else {
      console.error(
        `[cron/send-zenith-messages] Échec envoi entry=${entry.id} phone=${entry.phone}:`,
        result.error
      );

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
        .eq('id', entry.id);

      failed++;
    }
  }

  console.info(
    `[cron/send-zenith-messages] Traité=${queue.length} ` +
    `Envoyé=${sent} Échoué=${failed}`
  );

  return NextResponse.json({
    processed: queue.length,
    sent,
    rescheduled: 0,
    failed,
    rgpd_anonymized: rgpdAnonymized,
  });
}
