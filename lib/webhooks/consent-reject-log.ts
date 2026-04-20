/**
 * Journalisation structurée des webhooks e-commerce refusés faute de consentement RGPD.
 */
export function logWebhookConsentRejected(
  source: 'api_key' | 'zenith',
  detail: { user_id: string; consent: 'false' | 'missing' }
): void {
  console.warn(
    JSON.stringify({
      event: 'webhook_ingest',
      status: 'Rejected',
      reason: 'Consentement manquant',
      source,
      user_id: detail.user_id,
      consent: detail.consent === 'false' ? false : null,
    })
  );
}
