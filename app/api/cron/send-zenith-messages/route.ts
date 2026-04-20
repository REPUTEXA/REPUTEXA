import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';
import {
  getChallengeWhatsAppAppendixForMerchant,
  appendChallengeToWhatsAppBody,
} from '@/lib/reputexa-challenge/whatsapp-appendix';
import {
  safeIngestWhatsAppOutbound,
  safeScheduleOmniPublicationFollowup,
} from '@/lib/omni-synapse';
import { queueRetentionCutoffIso } from '@/lib/zenith-capture/policy';
import { buildReviewQueueInitialWhatsApp } from '@/lib/zenith-capture/review-queue-initial-message';

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
  legal_compliance_accepted: boolean | null;
  subscription_plan: string | null;
};

type ChallengeRow = {
  user_id: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  competition_message: string;
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
 *  2. RGPD Cleanup : anonymise les entrées > fenêtre de conservation (120 j)
 *  3. Fenêtre de courtoisie : si hors 09h–21h Paris → reporte TOUT au lendemain 09h05
 *  4. Fetch batch pending (scheduled_at <= now)
 *  5. Pour chaque entrée : récupère profil, construit message, envoie
 *  6. status = 'sent' (+ sent_at) ou 'failed' (+ error dans metadata)
 */
export async function GET(request: Request) {
  const ta = apiAdminT();
  // ── 1. Authentification ────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('serviceUnavailable') }, { status: 503 });
  }

  const now = new Date();
  const nowISO = now.toISOString();

  // ── 2. RGPD Anonymisation — entrées hors fenêtre ZENITH_QUEUE_RETENTION_DAYS ─
  //
  // Anonymisation plutôt que suppression : préserve les statistiques historiques.
  //   - first_name  → NULL
  //   - phone       → SHA-256 (non réversible, conserve l'unicité)
  //   - metadata    → suppression de raw_phone + caller_ip
  //   - source_info → NULL
  const rgpdCutoff = queueRetentionCutoffIso(now);

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
      delete cleanedMeta['outbound_whatsapp_body'];
      cleanedMeta['anonymized_at'] = nowISO;

      await admin
        .from('review_queue')
        .update({
          first_name: null,
          phone: phoneHash,
          source_info: null,
          metadata: cleanedMeta,
        })
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
    return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  }

  if (!queue?.length) {
    return NextResponse.json({ processed: 0, sent: 0, rescheduled: 0, failed: 0 });
  }

  // ── 5. Chargement des profils marchands (batch) ───────────────────────────
  const userIds = Array.from(new Set((queue as QueueEntry[]).map((r) => r.user_id)));
  const { data: profilesRaw } = await admin
    .from('profiles')
    .select('id, establishment_name, full_name, google_review_url, legal_compliance_accepted, subscription_plan')
    .in('id', userIds);

  const profileMap = new Map<string, ProfileRow>(
    ((profilesRaw ?? []) as ProfileRow[]).map((p) => [p.id, p])
  );

  const { data: challengesRaw } = await admin
    .from('reputexa_challenge_campaigns')
    .select('user_id, is_active, starts_at, ends_at, competition_message')
    .in('user_id', userIds);

  const challengeMap = new Map<string, ChallengeRow>(
    ((challengesRaw ?? []) as ChallengeRow[]).map((c) => [c.user_id, c])
  );

  // ── 6. Envoi de chaque message ─────────────────────────────────────────────
  let sent = 0;
  let failed = 0;
  let skippedCompliance = 0;

  for (const entry of queue as QueueEntry[]) {
    const profile = profileMap.get(entry.user_id);

    if (!profile?.legal_compliance_accepted) {
      skippedCompliance++;
      await admin
        .from('review_queue')
        .update({
          status: 'cancelled',
          metadata: {
            ...(entry.metadata ?? {}),
            cancelled_at: new Date().toISOString(),
            cancel_reason: 'legal_compliance_required',
          },
        })
        .eq('id', entry.id);
      continue;
    }

    const establishmentName =
      profile?.establishment_name?.trim() ||
      profile?.full_name?.trim() ||
      'notre établissement';

    const lastPurchase =
      typeof entry.metadata?.last_purchase === 'string'
        ? (entry.metadata.last_purchase as string).trim()
        : null;

    let message = buildReviewQueueInitialWhatsApp({
      firstName: entry.first_name,
      commerceName: establishmentName,
      lastPurchase,
    });
    const ch = challengeMap.get(entry.user_id);
    const appendix = getChallengeWhatsAppAppendixForMerchant(ch ?? null, profile?.subscription_plan);
    message = appendChallengeToWhatsAppBody(message, appendix);

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
            outbound_whatsapp_body: message,
          },
        })
        .eq('id', entry.id);

      const sentDate = new Date(sentAt);
      safeScheduleOmniPublicationFollowup(admin, {
        userId: entry.user_id,
        reviewQueueId: entry.id,
        sentAt: sentDate,
      });
      safeIngestWhatsAppOutbound(admin, {
        userId: entry.user_id,
        reviewQueueId: entry.id,
        firstName: entry.first_name,
        commerceName: establishmentName,
        messageBody: message,
      });

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
    `Envoyé=${sent} Échoué=${failed} Annulés_conformité=${skippedCompliance}`
  );

  return NextResponse.json({
    processed: queue.length,
    sent,
    skipped_compliance: skippedCompliance,
    rescheduled: 0,
    failed,
    rgpd_anonymized: rgpdAnonymized,
  });
}
