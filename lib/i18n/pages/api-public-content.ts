export type ApiUseCase = {
  iconKey: 'shoppingCart' | 'zap' | 'smartphone';
  title: string;
  description: string;
  badge: string;
  badgeColor: string;
};

export type ApiSecurityRule = { iconKey: 'lock' | 'shield' | 'alertTriangle' | 'checkCircle'; text: string };
export type ApiErrorRow = { code: string; desc: string };
export type ApiKeyStep = { step: string; label: string };

export type ApiPublicStrings = {
  useCases: ApiUseCase[];
  endpointDoc: string;
  securityRules: ApiSecurityRule[];
  errorCodes: ApiErrorRow[];
  zapierExample: string;
  honestTitle: string;
  honestBodyHtml: string;
  sectionUseCases: string;
  sectionKeyTitle: string;
  keyIntro: string;
  keySteps: ApiKeyStep[];
  keyFootnote: string;
  sectionEndpoint: string;
  sectionSecurity: string;
  sectionCodes: string;
  zapierSectionTitle: string;
  zapierPanelLabel: string;
  ctaTitle: string;
  ctaBody: string;
  ctaTrial: string;
  ctaDoc: string;
};

const FR: ApiPublicStrings = {
  useCases: [
    {
      iconKey: 'shoppingCart',
      title: 'Logiciel de caisse (POS)',
      description:
        'Square, SumUp, Lightspeed ou tout POS avec webhooks. À chaque transaction finalisée, envoyez les données du client à REPUTEXA — le module AI Capture déclenche automatiquement un message WhatsApp 30 minutes plus tard.',
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
    {
      iconKey: 'zap',
      title: 'Zapier / Make',
      description:
        "Connectez n'importe quel outil (Shopify, WooCommerce, Airtable, formulaire de réservation…) via Zapier ou Make. Configurez un Zap/Scénario qui appelle votre endpoint REPUTEXA à chaque visite ou commande confirmée.",
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
    {
      iconKey: 'smartphone',
      title: 'Système de réservation',
      description:
        "Thefork, Resy, booking en ligne sur mesure. Déclenchez l'invitation à laisser un avis 30 minutes après l'horaire de réservation — sans action manuelle de votre part.",
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
  ],
  endpointDoc: `POST https://reputexa.fr/api/webhooks/{votre_cle_rtx_live}

// Headers requis
Content-Type: application/json

// Corps de la requête
{
  "customerName": "Marie Dupont",      // Prénom + nom du client
  "phone": "+33612345678",             // Format international E.164 OBLIGATOIRE
  "visitDate": "2026-03-22T14:30:00Z", // ISO 8601 — date/heure de la visite
  "establishmentId": "votre_id"        // Visible dans votre dashboard REPUTEXA
}

// Réponse — succès (200)
{
  "queued": true,
  "scheduledAt": "2026-03-22T15:00:00Z",
  "message": "AI Capture programmé pour 30 minutes après la visite."
}

// Réponse — erreur clé invalide (401)
{
  "error": "Clé API invalide ou révoquée"
}

// Réponse — téléphone invalide (422)
{
  "error": "Format de téléphone invalide — utilisez E.164 (+33612345678)"
}`,
  securityRules: [
    {
      iconKey: 'lock',
      text: "La clé rtx_live_ est spécifique à votre compte — ne la partagez pas et ne l'intégrez pas côté client (frontend).",
    },
    {
      iconKey: 'shield',
      text: 'REPUTEXA vérifie la validité de la clé, le format du téléphone et applique une fenêtre anti-resollicitation (120 jours minimum entre deux campagnes pour un même numéro).',
    },
    {
      iconKey: 'alertTriangle',
      text: 'Les invitations ne sont envoyées que dans la fenêtre 09h–21h heure de Paris pour respecter la tranquillité des clients.',
    },
    {
      iconKey: 'checkCircle',
      text: "Un même numéro de téléphone ne peut pas être contacté plus d'une fois toutes les 5 minutes (déduplication).",
    },
  ],
  errorCodes: [
    { code: '200', desc: 'Données reçues — AI Capture programmé dans la review_queue' },
    { code: '401', desc: 'Clé rtx_live_ absente, invalide ou révoquée' },
    { code: '403', desc: 'Fonctionnalité AI Capture non incluse dans votre plan (ZENITH requis)' },
    { code: '409', desc: 'Ce numéro a été contacté dans les 5 dernières minutes (déduplication)' },
    { code: '422', desc: 'Données invalides (téléphone non E.164, date manquante, etc.)' },
    { code: '429', desc: 'Trop de requêtes depuis votre IP — réessayez après quelques secondes' },
  ],
  zapierExample: `Trigger: Nouvelle commande finalisée sur votre POS / e-commerce

Action: Webhook by Zapier
  URL     : https://reputexa.fr/api/webhooks/rtx_live_VOTRE_CLE
  Method  : POST
  Headers : Content-Type: application/json
  Data    : {
              "customerName": "{{prenom}} {{nom}}",
              "phone": "{{telephone_e164}}",
              "visitDate": "{{date_commande}}",
              "establishmentId": "VOTRE_ETABLISSEMENT_ID"
            }

Résultat : REPUTEXA programme automatiquement un message WhatsApp
           30 minutes après la visite pour inviter le client à laisser un avis.`,
  honestTitle: "Ce que l'API REPUTEXA fait réellement",
  honestBodyHtml: `L'API REPUTEXA est un <strong class="text-white">webhook entrant</strong> : elle reçoit des données de visite depuis vos systèmes externes (POS, Zapier, réservation) et déclenche automatiquement le module <strong class="text-white">AI Capture</strong> — un message WhatsApp envoyé au client 30 minutes après sa visite pour l'inviter à laisser un avis Google.<br /><br />Il n'existe pas à ce stade d'API publique de <em>lecture</em> (GET /reviews, GET /statistics, etc.). Vos données sont accessibles via le <a href="/dashboard" class="text-[#2563eb] hover:underline">tableau de bord REPUTEXA</a>.`,
  sectionUseCases: "Cas d'usage",
  sectionKeyTitle: "Obtenir votre clé d'intégration",
  keyIntro:
    'La clé d\'intégration (<code class="text-gray-300 font-mono text-xs bg-white/10 px-1.5 py-0.5 rounded">rtx_live_…</code>) est générée automatiquement lors de la création de votre compte ZENITH. Elle est visible et renouvelable dans votre dashboard.',
  keySteps: [
    { step: '1', label: 'Tableau de bord → Paramètres' },
    { step: '2', label: 'Section "Intégrations"' },
    { step: '3', label: 'Copier la clé rtx_live_…' },
  ],
  keyFootnote:
    "Plan ZENITH requis pour générer une clé d'intégration. L'ancien plan DOMINATOR hérite des accès.",
  sectionEndpoint: "Documentation de l'endpoint",
  sectionSecurity: 'Règles de sécurité & limitations',
  sectionCodes: 'Codes de réponse',
  zapierSectionTitle: 'Exemple : intégration Zapier',
  zapierPanelLabel: 'Zapier — action Webhook (POST)',
  ctaTitle: "Activer l'intégration POS / Zapier",
  ctaBody:
    "Le module AI Capture est exclusif ZENITH. Commencez par un essai gratuit de 14 jours pour tester l'intégration dans votre environnement réel.",
  ctaTrial: 'Essai gratuit ZENITH',
  ctaDoc: 'Guide de démarrage',
};

const EN: ApiPublicStrings = {
  useCases: [
    {
      iconKey: 'shoppingCart',
      title: 'Point-of-sale (POS)',
      description:
        'Square, SumUp, Lightspeed or any POS with webhooks. After each completed sale, send customer data to REPUTEXA — AI Capture automatically schedules a WhatsApp message 30 minutes later.',
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
    {
      iconKey: 'zap',
      title: 'Zapier / Make',
      description:
        'Connect any stack (Shopify, WooCommerce, Airtable, booking forms…) via Zapier or Make. Trigger your REPUTEXA endpoint on each confirmed visit or order.',
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
    {
      iconKey: 'smartphone',
      title: 'Reservation systems',
      description:
        'TheFork, Resy, custom online booking. Trigger the review invite 30 minutes after the reservation time — no manual step.',
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
  ],
  endpointDoc: `POST https://reputexa.fr/api/webhooks/{your_rtx_live_key}

// Required headers
Content-Type: application/json

// Request body
{
  "customerName": "Jane Doe",
  "phone": "+14155552671",              // E.164 international format REQUIRED
  "visitDate": "2026-03-22T14:30:00Z",  // ISO 8601 visit timestamp
  "establishmentId": "your_establishment_id"
}

// Response — success (200)
{
  "queued": true,
  "scheduledAt": "2026-03-22T15:00:00Z",
  "message": "AI Capture scheduled for 30 minutes after the visit."
}

// Response — invalid key (401)
{
  "error": "Invalid or revoked API key"
}

// Response — invalid phone (422)
{
  "error": "Invalid phone format — use E.164 (+14155552671)"
}`,
  securityRules: [
    {
      iconKey: 'lock',
      text: 'Your rtx_live_ key is account-specific — never share it or embed it in client-side code.',
    },
    {
      iconKey: 'shield',
      text: 'REPUTEXA validates the key and phone format and enforces a 120-day minimum gap between campaigns for the same number.',
    },
    {
      iconKey: 'alertTriangle',
      text: 'Invites are only sent between 09:00–21:00 Paris time to respect quiet hours.',
    },
    {
      iconKey: 'checkCircle',
      text: 'The same phone number cannot be contacted more than once every 5 minutes (deduplication).',
    },
  ],
  errorCodes: [
    { code: '200', desc: 'Payload accepted — AI Capture queued in review_queue' },
    { code: '401', desc: 'Missing, invalid or revoked rtx_live_ key' },
    { code: '403', desc: 'AI Capture not included in your plan (ZENITH required)' },
    { code: '409', desc: 'This number was contacted in the last 5 minutes' },
    { code: '422', desc: 'Invalid payload (non-E.164 phone, missing date, etc.)' },
    { code: '429', desc: 'Too many requests from your IP — retry shortly' },
  ],
  zapierExample: `Trigger: New completed order on your POS / e-commerce

Action: Webhook by Zapier
  URL     : https://reputexa.fr/api/webhooks/rtx_live_YOUR_KEY
  Method  : POST
  Headers : Content-Type: application/json
  Data    : {
              "customerName": "{{first_name}} {{last_name}}",
              "phone": "{{phone_e164}}",
              "visitDate": "{{order_date}}",
              "establishmentId": "YOUR_ESTABLISHMENT_ID"
            }

Result: REPUTEXA automatically schedules a WhatsApp message
        30 minutes after the visit to invite a Google review.`,
  honestTitle: 'What the REPUTEXA API actually does',
  honestBodyHtml: `The REPUTEXA API is an <strong class="text-white">inbound webhook</strong>: it receives visit payloads from your external systems (POS, Zapier, booking) and automatically triggers <strong class="text-white">AI Capture</strong> — a WhatsApp message to the customer 30 minutes after their visit to invite a Google review.<br /><br />There is currently no public <em>read</em> API (GET /reviews, GET /statistics, etc.). Access your data in the <a href="/dashboard" class="text-[#2563eb] hover:underline">REPUTEXA dashboard</a>.`,
  sectionUseCases: 'Use cases',
  sectionKeyTitle: 'Get your integration key',
  keyIntro:
    'The integration key (<code class="text-gray-300 font-mono text-xs bg-white/10 px-1.5 py-0.5 rounded">rtx_live_…</code>) is created with your ZENITH account. View or rotate it in the dashboard.',
  keySteps: [
    { step: '1', label: 'Dashboard → Settings' },
    { step: '2', label: 'Integrations section' },
    { step: '3', label: 'Copy rtx_live_… key' },
  ],
  keyFootnote: 'ZENITH is required to generate an integration key. Legacy DOMINATOR plans retain access.',
  sectionEndpoint: 'Endpoint reference',
  sectionSecurity: 'Security rules & limits',
  sectionCodes: 'Response codes',
  zapierSectionTitle: 'Example: Zapier integration',
  zapierPanelLabel: 'Zapier — Webhook action (POST)',
  ctaTitle: 'Enable POS / Zapier integration',
  ctaBody: 'AI Capture is ZENITH-only. Start a 14-day free trial to test the integration in your real environment.',
  ctaTrial: 'Start ZENITH trial',
  ctaDoc: 'Getting started guide',
};

export function getApiPublicContent(locale: string): ApiPublicStrings {
  return locale === 'fr' ? FR : EN;
}
