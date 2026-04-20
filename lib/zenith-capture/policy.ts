/**
 * Politique Zenith — sollicitation WhatsApp & durées RGPD.
 * Single source of truth pour cooldown, anonymisation et exports audit.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Délai minimum entre deux campagnes de sollicitation d’avis pour le même numéro
 * (même compte marchand). En dessous : aucun nouvel envoi (file non alimentée).
 * Ex. retour client à J+119 → pas de message ; à J+120 → nouvelle sollicitation
 * à nouveau possible (hors liste STOP / opposition).
 */
export const ZENITH_RESOLICITATION_COOLDOWN_DAYS = 120;

/**
 * Conservation des données identifiantes dans la file d’avis : anonymisation ou
 * suppression au plus tard à cette échéance (crons `send-messages` /
 * `send-zenith-messages`, `queueRetentionCutoffIso`). Aligné affiche / politique.
 */
export const ZENITH_QUEUE_RETENTION_DAYS = 120;

/** Fenêtre par défaut des exports conformité admin (snapshot file + consentements). */
export const ZENITH_AUDIT_EXPORT_DEFAULT_DAYS = ZENITH_QUEUE_RETENTION_DAYS;

export function solicitationCooldownCutoffIso(now: Date = new Date()): string {
  return new Date(now.getTime() - ZENITH_RESOLICITATION_COOLDOWN_DAYS * MS_PER_DAY).toISOString();
}

export function queueRetentionCutoffIso(now: Date = new Date()): string {
  return new Date(now.getTime() - ZENITH_QUEUE_RETENTION_DAYS * MS_PER_DAY).toISOString();
}

/** Raison API / logs : numéro encore dans la fenêtre anti-resollicitation. */
export const SOLICITATION_COOLDOWN_REASON = 'solicitation_cooldown' as const;
