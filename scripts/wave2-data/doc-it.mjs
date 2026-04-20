export const documentationPageIt = {
  title: 'Documentazione REPUTEXA',
  subtitle: "Guida rapida e integrazione — allineata al funzionamento reale dell'app.",
  onboardingTitle: 'Avvio in 5 passaggi',
  onboardingBadge: '≈ 10 minuti',
  onboardingSteps: [
    {
      number: '01',
      iconKey: 'UserPlus',
      title: 'Crea il tuo account',
      description:
        'Nome, tipo, indirizzo, WhatsApp ed email. Codice di verifica immediato.',
      detail:
        'Cloudflare Turnstile anti-bot. Telefono in formato internazionale (+39…).',
    },
    {
      number: '02',
      iconKey: 'Mail',
      title: 'Verifica email',
      description: 'Inserisci il codice a 6 cifre. Valido 15 minuti.',
      detail: 'Controlla spam o richiedi nuovo codice da /verify.',
    },
    {
      number: '03',
      iconKey: 'Globe',
      title: 'Collega Google Business Profile',
      description:
        'Dashboard → Impostazioni → Piattaforme → “Collega Google”. OAuth con business.manage. Recensioni sincronizzate.',
      detail: 'REPUTEXA chiede solo business.manage, non il tuo Google personale.',
    },
    {
      number: '04',
      iconKey: 'Settings',
      title: 'Configura ADN IA',
      description: 'Impostazioni → ADN IA: tono, lunghezza, istruzioni. Anteprima live.',
      detail: 'Su ZENITH, Triple Judge propone tre varianti e sceglie la migliore.',
    },
    {
      number: '05',
      iconKey: 'Smartphone',
      title: 'Attiva alert WhatsApp',
      description:
        'Impostazioni → Notifiche: numero e soglia (es. ≤3★). Recensioni negative con bozza IA.',
      detail: 'PULSE e ZENITH, pulsanti Approva / Modifica via Twilio.',
    },
  ],
  flowTitle: 'Flusso automatico',
  flowIntro:
    'Rilevata una recensione negativa, REPUTEXA avvia questa pipeline senza azioni manuali.',
  whatsappFlow: [
    { step: 'Recensione negativa ricevuta', detail: '≤3★ su Google, Facebook o Trustpilot.' },
    { step: 'Analisi Shield Center', detail: 'IA su tossicità e autenticità.' },
    { step: 'Generazione IA (Claude 3.5 Sonnet)', detail: 'Risposta secondo ADN.' },
    { step: 'Alert WhatsApp', detail: 'Sintesi + bozza con Approva / Modifica.' },
    { step: 'Pubblicazione ritardata', detail: '2–7 h; dossier contestazione se frode.' },
  ],
  platformsTitle: 'Piattaforme collegate',
  tablePlatform: 'Piattaforma',
  tableProtocol: 'Protocollo',
  tableAvailability: 'Disponibilità',
  platforms: [
    { name: 'Google Business Profile', status: 'OAuth 2.0 (business.manage)', available: 'Tutti i piani' },
    { name: 'Facebook', status: 'Webhook', available: 'Tutti i piani' },
    { name: 'Trustpilot', status: 'Webhook', available: 'Tutti i piani' },
  ],
  platformsFootnote:
    'Google usa solo <code>business.manage</code> — niente accesso al conto Google personale.',
  posTitle: 'Integrazione POS e Zapier',
  posBadge: 'Solo ZENITH',
  posIntro:
    'REPUTEXA genera chiave in entrata (<rtx>rtx_live_…</rtx>) in Impostazioni. POS o Zapier/Make invia dati visita → AI Capture: WhatsApp 30 min dopo.',
  posCodeLabel: 'Webhook in entrata — visita POS',
  posSnippet: `POST https://reputexa.fr/api/webhooks/{tua_chiave_rtx_live}

Content-Type: application/json

{
  "customerName": "Mario Rossi",
  "phone": "+393331234567",
  "visitDate": "2026-03-22T14:30:00Z",
  "establishmentId": "tuo_id"
}

// WhatsApp automatico 30 min dopo.
// Solo ZENITH (AI Capture).`,
  posNote:
    'Chiave per <strong>webhook in entrata</strong>. Non per leggere recensioni o statistiche via API esterne.',
  keysTitle: 'Dove trovi le chiavi',
  keyCards: [
    { label: 'Chiave API in entrata (POS/Zapier)', path: 'Impostazioni → Integrazioni → Chiave API', plan: 'ZENITH', planColor: 'text-violet-400' },
    { label: 'WhatsApp per alert', path: 'Impostazioni → Notifiche → WhatsApp', plan: 'PULSE+', planColor: 'text-blue-400' },
    { label: 'Google Business', path: 'Impostazioni → Piattaforme → Google', plan: 'Tutti', planColor: 'text-emerald-400' },
  ],
  practicesTitle: 'Buone pratiche',
  practiceTips: [
    'Imposta ADN IA prima delle prime recensioni.',
    'WhatsApp su numero controllato spesso.',
    'Webhook POS entro 10 min dalla cassa.',
    'Non esporre rtx_live_.',
    'Shield Center è automatico — usa Alert per i casi critici.',
    'Se la bozza è sbagliata, Modifica per addestrare.',
  ],
  ctaTitle: 'Pronti a partire?',
  ctaSubtitle: 'ZENITH completo 14 giorni senza carta. Prima risposta IA sotto un minuto dopo Google.',
  ctaPrimary: 'Crea account gratis',
  ctaSecondary: 'Centro assistenza',
};
