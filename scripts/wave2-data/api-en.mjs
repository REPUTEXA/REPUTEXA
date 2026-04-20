export const apiPageEn = {
  title: 'REPUTEXA API',
  subtitle:
    'Wire REPUTEXA into your stack to trigger automated review invites after every customer visit.',
  noticeTitle: 'What the REPUTEXA API actually does',
  noticeBody:
    'The REPUTEXA API is an <strong>inbound webhook</strong>: it receives visit payloads from your POS, Zapier, or booking stack and automatically triggers <strong>AI Capture</strong> — a WhatsApp message 30 minutes after the visit inviting the customer to leave a Google review.<br/><br/>There is still no public <em>read</em> API (GET /reviews, GET /statistics, etc.). Your data lives in the <link>REPUTEXA dashboard</link>.',
  useCasesTitle: 'Use cases',
  useCases: [
    {
      iconKey: 'ShoppingCart',
      title: 'Point of sale (POS)',
      description:
        'Square, SumUp, Lightspeed, or any POS with outbound webhooks. After each closed sale, POST customer data to REPUTEXA so AI Capture schedules WhatsApp 30 minutes later.',
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
    {
      iconKey: 'Zap',
      title: 'Zapier / Make',
      description:
        'Connect Shopify, WooCommerce, Airtable, booking forms, etc. Each confirmed visit or order triggers your REPUTEXA endpoint.',
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
    {
      iconKey: 'Smartphone',
      title: 'Reservation systems',
      description:
        'TheFork, Resy, or bespoke booking tools. Fire the invite flow 30 minutes after the reservation time with zero manual work.',
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
  ],
  keySectionTitle: 'Get your integration key',
  keyIntro:
    'Your integration key (<rtx>rtx_live_…</rtx>) is created with a ZENITH workspace. View or rotate it anytime from the dashboard.',
  keySteps: [
    { step: '1', label: 'Dashboard → Settings' },
    { step: '2', label: 'Open the Integrations section' },
    { step: '3', label: 'Copy the rtx_live_… value' },
  ],
  keyFootnote: 'ZENITH is required to mint a key. Legacy DOMINATOR workspaces keep their access.',
  endpointTitle: 'Endpoint reference',
  endpointDoc: `POST https://reputexa.fr/api/webhooks/{your_rtx_live_key}

// Required headers
Content-Type: application/json

// Request body
{
  "customerName": "Jane Doe",          // First + last name
  "phone": "+33612345678",             // E.164 international format REQUIRED
  "visitDate": "2026-03-22T14:30:00Z", // ISO 8601 visit timestamp
  "establishmentId": "your_id"        // Copied from the REPUTEXA dashboard
}

// 200 — success
{
  "queued": true,
  "scheduledAt": "2026-03-22T15:00:00Z",
  "message": "AI Capture scheduled 30 minutes after the visit."
}

// 401 — bad key
{
  "error": "Invalid or revoked API key"
}

// 422 — validation error
{
  "error": "Invalid phone format — use E.164 (+33612345678)"
}`,
  securityTitle: 'Security guardrails',
  securityRules: [
    {
      iconKey: 'Lock',
      text: 'rtx_live_ keys are account-scoped — never embed them in public frontends.',
    },
    {
      iconKey: 'Shield',
      text: 'REPUTEXA validates the key, enforces E.164 phone numbers, and applies a 120-day minimum gap before re-contacting the same number.',
    },
    {
      iconKey: 'AlertTriangle',
      text: 'Messages only send between 09:00 and 21:00 Paris time to protect customers.',
    },
    {
      iconKey: 'CheckCircle',
      text: 'The same phone number cannot be messaged more than once every five minutes (deduplication).',
    },
  ],
  errorCodesTitle: 'Response codes',
  errorCodes: [
    { code: '200', desc: 'Payload accepted — job enqueued in review_queue' },
    { code: '401', desc: 'Missing, invalid, or revoked rtx_live_ key' },
    { code: '403', desc: 'AI Capture not enabled on this plan (ZENITH required)' },
    { code: '409', desc: 'Number contacted inside the last five minutes' },
    { code: '422', desc: 'Validation error (phone, timestamp, etc.)' },
    { code: '429', desc: 'Too many requests from this IP — retry shortly' },
  ],
  zapierTitle: 'Sample Zapier flow',
  zapierExample: `Trigger: Order paid on POS / ecommerce

Action: Webhook by Zapier
  URL     : https://reputexa.fr/api/webhooks/rtx_live_YOUR_KEY
  Method  : POST
  Headers : Content-Type: application/json
  Data    : {
              "customerName": "{{first}} {{last}}",
              "phone": "{{phone_e164}}",
              "visitDate": "{{order_completed_at}}",
              "establishmentId": "YOUR_ESTABLISHMENT_ID"
            }

Result: REPUTEXA queues WhatsApp 30 minutes after the visit.`,
  ctaTitle: 'Enable POS / Zapier capture',
  ctaSubtitle:
    'AI Capture ships with ZENITH. Start the 14-day trial to test against your real traffic.',
  ctaPrimary: 'Start ZENITH trial',
  ctaSecondary: 'Getting started guide',
};
