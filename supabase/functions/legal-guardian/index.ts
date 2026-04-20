/**
 * Edge Function proxy — déclenche le Guardian hébergé sur Vercel.
 *
 * Déployer : supabase functions deploy legal-guardian
 * Secrets :
 *   CRON_SECRET — identique à Vercel
 *   LEGAL_GUARDIAN_TRIGGER_URL — ex. https://reputexa.fr/api/cron/legal-guardian
 *
 * Planifier (Supabase Dashboard → Edge Functions → Cron) : 0 6 * * 0
 */

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const TRIGGER_URL = Deno.env.get('LEGAL_GUARDIAN_TRIGGER_URL') ?? '';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  const auth = req.headers.get('Authorization') ?? '';
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!TRIGGER_URL) {
    return new Response(JSON.stringify({ error: 'LEGAL_GUARDIAN_TRIGGER_URL manquant' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const r = await fetch(TRIGGER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const text = await r.text();
  return new Response(text, { status: r.status, headers: { 'Content-Type': 'application/json' } });
});
