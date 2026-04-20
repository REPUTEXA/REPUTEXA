export const helpPageIt = {
  title: 'Centro assistenza',
  subtitle:
    'Risposte sulle domande su REPUTEXA — IA, Shield Center, integrazioni e fatturazione.',
  searchPlaceholder: 'Cerca una domanda…',
  questionsCount: '{count} domande',
  contactChatTitle: 'Chat e supporto',
  contactChatMeta: 'Risposta in meno di 2 h',
  contactChatBody:
    'Il nostro team è disponibile dal lunedì al venerdì, 9:00–18:00 (CET).',
  contactChatCta: 'Apri un ticket',
  contactEmailTitle: 'Supporto email',
  contactEmailMeta: 'Tempo medio: 4 h lavorative',
  contactEmailBody:
    'Per richieste tecniche o assistenza scrivici direttamente.',
  contactEmailCta: 'Apri il modulo di contatto',
  categories: [
    {
      id: 'ai',
      iconKey: 'Bot',
      label: 'Intelligenza artificiale',
      color: 'text-violet-400',
      faqs: [
        {
          question: "Come l'IA genera le risposte alle recensioni?",
          answer:
            'REPUTEXA usa Claude 3.5 Sonnet di Anthropic come motore principale; se non disponibile, GPT-4o-mini di OpenAI subentra automaticamente (doppio motore con failover). Ogni risposta segue regole rigide: “effetto specchio” (riuso delle parole chiave della recensione), zero allucinazioni, tono dall’ADN IA.',
        },
        {
          question: "L'IA può adattare il tono al mio brand?",
          answer:
            'Sì. Nelle impostazioni definisci un brief: settore, tono (formale, caldo, premium…), frasi da evitare e parole ricorrenti. L’IA applica queste istruzioni in ogni suggerimento.',
        },
        {
          question: 'Le risposte sono inviate automaticamente?',
          answer:
            'In parte. Le recensioni positive ricevono risposta automatica con ritardo simulato 2–9 h. Per quelle negative: su VISION validi dal dashboard; su PULSE e ZENITH alert WhatsApp con bozza modificabile. Dopo la pubblicazione, coda 2–7 h prima del live.',
        },
        {
          question: "L'IA gestisce recensioni in altre lingue?",
          answer:
            'Su VISION risponde nella lingua principale della struttura. Su PULSE e ZENITH la lingua è rilevata per ogni recensione e la risposta è generata nella stessa lingua (FR, EN, ES, DE, IT, ecc.).',
        },
        {
          question: 'Quale precisione per analisi tossicità?',
          answer:
            'Il modello raggiunge 97,4 % sul nostro benchmark interno (10 000 recensioni etichettate). Shield Center separa recensioni negative legittime da abusi, diffamazione o contenuti sintetici.',
        },
      ],
    },
    {
      id: 'shield',
      iconKey: 'Shield',
      label: 'Shield Center',
      color: 'text-emerald-400',
      faqs: [
        {
          question: "Cos'è Shield Center?",
          answer:
            'È il sistema che analizza ogni recensione con 14 indicatori: tossicità, autenticità, intento fraudolento, sentiment, entità citate, ecc. Genera alert e può preparare segnalazioni per Google.',
        },
        {
          question: 'Come funziona il rilevamento di recensioni false?',
          answer:
            'Incrociamo coerenza temporale (picchi anomali), pattern linguistici tra account, geolocalizzazione revisori e storico profili. Ogni recensione ha uno score di autenticità nel dashboard.',
        },
        {
          question: 'Posso contestare una recensione da REPUTEXA?',
          answer:
            'Lo scudo IA prepara un fascicolo (motivi e testo per moderatori) da incollare nel modulo Google Business Profile. Google non offre API pubbliche per cancellare al posto tuo: l’invio finale resta su Google dopo tua revisione.',
        },
        {
          question: 'Gli alert WhatsApp sono in tutti i piani?',
          answer:
            'Alert immediati e digest settimanale da PULSE (97 €/mese). VISION solo email. Su ZENITH, AI Capture può invitare via WhatsApp 30 min dopo la visita.',
        },
      ],
    },
    {
      id: 'integration',
      iconKey: 'Plug',
      label: 'Integrazione e API',
      color: 'text-blue-400',
      faqs: [
        {
          question: 'Come collego Google Business Profile?',
          answer:
            'Dashboard → Impostazioni → Piattaforme → “Collega Google”. OAuth — concedi business.manage. Connessione ~30 s, sync automatica, nessuna chiave API manuale.',
        },
        {
          question: 'Quali piattaforme sono collegate?',
          answer:
            'REPUTEXA sincronizza Google Business Profile, Facebook e Trustpilot (Google OAuth, altri webhook). Altre in roadmap.',
        },
        {
          question: 'Posso collegare POS o Zapier?',
          answer:
            'Sì via AI Capture (solo ZENITH). Chiave rtx_live_… in Impostazioni → Integrazioni. POS (Square, SumUp) o Zapier/Make inviano dati visita; WhatsApp 30 min dopo.',
        },
        {
          question: 'Quante strutture posso gestire?',
          answer:
            'Nessun limite per piano: fatturazione su sedi attive con sconti scalari (1ª prezzo pieno, 2ª −20 %, 3ª −30 %, 4ª −40 %, 5+ −50 %). Tutto da un unico dashboard.',
        },
      ],
    },
    {
      id: 'billing',
      iconKey: 'CreditCard',
      label: 'Fatturazione e abbonamento',
      color: 'text-amber-400',
      faqs: [
        {
          question: 'Posso cambiare piano in qualsiasi momento?',
          answer:
            'Sì. Upgrade/downgrade in Impostazioni → Abbonamento. Upgrade subito con proroga; downgrade al rinnovo.',
        },
        {
          question: 'La prova gratuita include tutto?',
          answer:
            'Sì — 14 giorni con piano ZENITH completo. Nessuna carta per iniziare.',
        },
        {
          question: 'Politica di rimborso?',
          answer:
            'Se non sei soddisfatto entro 30 giorni dall’iscrizione, rimborso integrale. support@reputexa.fr.',
        },
      ],
    },
    {
      id: 'stats',
      iconKey: 'BarChart2',
      label: 'Statistiche e report',
      color: 'text-pink-400',
      faqs: [
        {
          question: 'Con che frequenza si aggiornano le statistiche?',
          answer:
            'Le recensioni arrivano in tempo reale via webhook. Il dashboard mostra sempre l’ultima versione. Gli aggregati si ricalcolano a ogni caricamento.',
        },
        {
          question: 'Posso esportare PDF?',
          answer:
            'Sì. Ogni mese un PDF “studi professionali” (statistiche + testi IA per piano): sintesi Vision; analisi Pulse; strategia Zenith. Ricevi via email e rigeneri dall’archivio. Pulse e Zenith anche recap settimanale WhatsApp.',
        },
      ],
    },
    {
      id: 'global',
      iconKey: 'Globe',
      label: 'Multilingue e internazionale',
      color: 'text-cyan-400',
      faqs: [
        {
          question: 'REPUTEXA funziona fuori dalla Francia?',
          answer:
            'Sì — FR, BE, CH, ES, IT, DE. Infrastruttura UE (Parigi, Francoforte) allineata al GDPR.',
        },
        {
          question: "L'interfaccia è multilingue?",
          answer:
            'Interfaccia in FR, EN, ES, DE, IT. Cambia dalle impostazioni o dal selettore in fondo pagina.',
        },
      ],
    },
  ],
};
