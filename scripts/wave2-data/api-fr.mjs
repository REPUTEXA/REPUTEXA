export const apiPageFr = {
  title: 'API REPUTEXA',
  subtitle:
    "Intégrez REPUTEXA dans vos systèmes pour déclencher automatiquement la collecte d'avis après chaque visite client.",
  noticeTitle: "Ce que l'API REPUTEXA fait réellement",
  noticeBody:
    "L'API REPUTEXA est un <strong>webhook entrant</strong> : elle reçoit des données de visite depuis vos systèmes externes (POS, Zapier, réservation) et déclenche automatiquement le module <strong>AI Capture</strong> — un message WhatsApp envoyé au client 30 minutes après sa visite pour l'inviter à laisser un avis Google.<br/><br/>Il n'existe pas à ce stade d'API publique de <em>lecture</em> (GET /reviews, GET /statistics, etc.). Vos données sont accessibles via le <link>tableau de bord REPUTEXA</link>.",
  useCasesTitle: "Cas d'usage",
  useCases: [
    {
      iconKey: 'ShoppingCart',
      title: 'Logiciel de caisse (POS)',
      description:
        'Square, SumUp, Lightspeed ou tout POS avec webhooks. À chaque transaction finalisée, envoyez les données du client à REPUTEXA — le module AI Capture déclenche automatiquement un message WhatsApp 30 minutes plus tard.',
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
    {
      iconKey: 'Zap',
      title: 'Zapier / Make',
      description:
        "Connectez n'importe quel outil (Shopify, WooCommerce, Airtable, formulaire de réservation…) via Zapier ou Make. Configurez un Zap/Scénario qui appelle votre endpoint REPUTEXA à chaque visite ou commande confirmée.",
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
    {
      iconKey: 'Smartphone',
      title: 'Système de réservation',
      description:
        "Thefork, Resy, booking en ligne sur mesure. Déclenchez l'invitation à laisser un avis 30 minutes après l'horaire de réservation — sans action manuelle de votre part.",
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
  ],
  keySectionTitle: "Obtenir votre clé d'intégration",
  keyIntro:
    "La clé d'intégration (<rtx>rtx_live_…</rtx>) est générée automatiquement lors de la création de votre compte ZENITH. Elle est visible et renouvelable dans votre dashboard.",
  keySteps: [
    { step: '1', label: 'Tableau de bord → Paramètres' },
    { step: '2', label: 'Section « Intégrations »' },
    { step: '3', label: 'Copier la clé rtx_live_…' },
  ],
  keyFootnote:
    "Plan ZENITH requis pour générer une clé d'intégration. L'ancien plan DOMINATOR hérite des accès.",
  endpointTitle: "Documentation de l'endpoint",
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
  securityTitle: 'Règles de sécurité & limitations',
  securityRules: [
    {
      iconKey: 'Lock',
      text: "La clé rtx_live_ est spécifique à votre compte — ne la partagez pas et ne l'intégrez pas côté client (frontend).",
    },
    {
      iconKey: 'Shield',
      text: "REPUTEXA vérifie la validité de la clé, le format du téléphone et applique une fenêtre anti-resollicitation (120 jours minimum entre deux campagnes pour un même numéro).",
    },
    {
      iconKey: 'AlertTriangle',
      text: "Les invitations ne sont envoyées que dans la fenêtre 09h–21h heure de Paris pour respecter la tranquillité des clients.",
    },
    {
      iconKey: 'CheckCircle',
      text: "Un même numéro de téléphone ne peut pas être contacté plus d'une fois toutes les 5 minutes (déduplication).",
    },
  ],
  errorCodesTitle: 'Codes de réponse',
  errorCodes: [
    { code: '200', desc: 'Données reçues — AI Capture programmé dans la review_queue' },
    { code: '401', desc: 'Clé rtx_live_ absente, invalide ou révoquée' },
    { code: '403', desc: "Fonctionnalité AI Capture non incluse dans votre plan (ZENITH requis)" },
    { code: '409', desc: 'Ce numéro a été contacté dans les 5 dernières minutes (déduplication)' },
    { code: '422', desc: 'Données invalides (téléphone non E.164, date manquante, etc.)' },
    { code: '429', desc: "Trop de requêtes depuis votre IP — réessayez après quelques secondes" },
  ],
  zapierTitle: 'Exemple : intégration Zapier',
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
  ctaTitle: "Activer l'intégration POS / Zapier",
  ctaSubtitle:
    "Le module AI Capture est exclusif ZENITH. Commencez par un essai gratuit de 14 jours pour tester l'intégration dans votre environnement réel.",
  ctaPrimary: 'Essai gratuit ZENITH',
  ctaSecondary: 'Guide de démarrage',
};
