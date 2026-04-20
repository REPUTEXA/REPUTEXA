export const apiPageIt = {
  title: 'API REPUTEXA',
  subtitle:
    'Integra REPUTEXA per attivare inviti a recensire dopo ogni visita.',
  noticeTitle: 'Cosa fa davvero l’API',
  noticeBody:
    "L'API REPUTEXA è un <strong>webhook in entrata</strong>: riceve dati visita da POS, Zapier o prenotazioni e avvia <strong>AI Capture</strong> — WhatsApp 30 minuti dopo per invito a lasciare recensione Google.<br/><br/>Non esiste ancora API pubblica di <em>lettura</em> (GET /reviews…). I dati sono nel <link>dashboard REPUTEXA</link>.",
  useCasesTitle: 'Casi d’uso',
  useCases: [
    {
      iconKey: 'ShoppingCart',
      title: 'Cassa / POS',
      description:
        'Square, SumUp, Lightspeed… Dopo ogni vendita invii il payload: AI Capture programma WhatsApp a +30 min.',
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
    {
      iconKey: 'Zap',
      title: 'Zapier / Make',
      description: 'Shopify, WooCommerce, Airtable, moduli. Ogni visita confermata chiama il tuo endpoint.',
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
    {
      iconKey: 'Smartphone',
      title: 'Prenotazioni',
      description: 'TheFork, Resy, booking custom. Invito 30 min dopo l’orario senza azioni manuali.',
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
  ],
  keySectionTitle: 'Chiave di integrazione',
  keyIntro:
    'La chiave (<rtx>rtx_live_…</rtx>) si crea con ZENITH. Visibile e rinnovabile dal dashboard.',
  keySteps: [
    { step: '1', label: 'Dashboard → Impostazioni' },
    { step: '2', label: 'Integrazioni' },
    { step: '3', label: 'Copia rtx_live_…' },
  ],
  keyFootnote: 'Serve ZENITH. DOMINATOR mantiene accesso.',
  endpointTitle: 'Documentazione endpoint',
  endpointDoc: `POST https://reputexa.fr/api/webhooks/{rtx_live}

Content-Type: application/json

{
  "customerName": "Mario Rossi",
  "phone": "+393331234567",
  "visitDate": "2026-03-22T14:30:00Z",
  "establishmentId": "tuo_id"
}

// 200 — in coda
// 401 — chiave non valida
// 422 — validazione`,
  securityTitle: 'Sicurezza e limiti',
  securityRules: [
    { iconKey: 'Lock', text: 'rtx_live_ è del tuo account — mai nel frontend pubblico.' },
    { iconKey: 'Shield', text: 'Controllo chiave, E.164, minimo 120 giorni tra campagne sullo stesso numero.' },
    { iconKey: 'AlertTriangle', text: 'Invii solo 09:00–21:00 ora Parigi.' },
    { iconKey: 'CheckCircle', text: 'Stesso numero al massimo ogni 5 minuti.' },
  ],
  errorCodesTitle: 'Codici di risposta',
  errorCodes: [
    { code: '200', desc: 'Ricevuto — in coda review' },
    { code: '401', desc: 'rtx_live_ mancante o non valida' },
    { code: '403', desc: 'AI Capture non nel piano (ZENITH)' },
    { code: '409', desc: 'Deduplicazione 5 min' },
    { code: '422', desc: 'Dati non validi' },
    { code: '429', desc: 'Troppe richieste' },
  ],
  zapierTitle: 'Esempio Zapier',
  zapierExample: `Trigger: Ordine saldato
Webhook POST con JSON nome, telefono E.164, data, establishmentId
→ WhatsApp dopo 30 minuti.`,
  ctaTitle: 'Attiva POS / Zapier',
  ctaSubtitle: 'AI Capture solo con ZENITH. Prova 14 giorni.',
  ctaPrimary: 'Prova ZENITH',
  ctaSecondary: 'Guida introduttiva',
};
