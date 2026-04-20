export const helpPageDe = {
  title: 'Hilfe-Center',
  subtitle:
    'Antworten zu REPUTEXA — KI, Shield Center, Integrationen und Abrechnung.',
  searchPlaceholder: 'Frage suchen…',
  questionsCount: '{count} Fragen',
  contactChatTitle: 'Chat & Support',
  contactChatMeta: 'Antwort in unter 2 Std.',
  contactChatBody:
    'Unser Team ist Montag–Freitag, 9–18 Uhr (MEZ), für Sie da.',
  contactChatCta: 'Ticket erstellen',
  contactEmailTitle: 'E-Mail-Support',
  contactEmailMeta: 'Ø Antwortzeit: 4 Werktagsstunden',
  contactEmailBody:
    'Bei technischen Fragen oder Support schreiben Sie uns direkt.',
  contactEmailCta: 'Kontaktformular öffnen',
  categories: [
    {
      id: 'ai',
      iconKey: 'Bot',
      label: 'Künstliche Intelligenz',
      color: 'text-violet-400',
      faqs: [
        {
          question: 'Wie generiert die KI Antworten auf Bewertungen?',
          answer:
            'REPUTEXA nutzt Anthropic Claude 3.5 Sonnet als Hauptmotor. Bei Ausfall übernimmt OpenAI GPT-4o-mini automatisch (Dual-Engine mit nahtlosem Failover). Jede Antwort folgt strengen Regeln: „Spiegeleffekt“ (Schlüsselwörter der Bewertung), keine Halluzinationen, Ton aus Ihrer KI-DNA.',
        },
        {
          question: 'Passt die KI den Ton an meine Marke an?',
          answer:
            'Ja. In den Einstellungen definieren Sie ein Marken-Briefing: Branche, Ton (formell, warm, Premium…), Tabus und Keywords. Die KI wendet das in jedem Vorschlag an.',
        },
        {
          question: 'Werden Antworten automatisch gesendet?',
          answer:
            'Teilweise. Positive Bewertungen erhalten eine Auto-Antwort mit simulierter menschlicher Verzögerung (2–9 Std.). Bei Negativ: Bei VISION validieren Sie im Dashboard; bei PULSE und ZENITH kommt ein WhatsApp-Alert mit Vorschlag. Nach Veröffentlichung: Warteschlange 2–7 Std. bis live.',
        },
        {
          question: 'Bearbeitet die KI Bewertungen in anderen Sprachen?',
          answer:
            'Bei VISION antwortet die KI in der Hauptsprache des Betriebs. Bei PULSE und ZENITH wird pro Bewertung erkannt und in derselben Sprache geantwortet (u. a. FR, EN, ES, DE, IT).',
        },
        {
          question: 'Wie genau ist die Toxizitätserkennung?',
          answer:
            'Unser Modell erreicht 97,4 % Genauigkeit im internen Benchmark (10 000 manuell gelabelte Reviews). Shield Center trennt berechtigte Negativeinträge von Missbrauch, Diffamierung oder synthetischem Inhalt.',
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
          question: 'Was ist das Shield Center?',
          answer:
            'Das Shield Center überwacht jede Bewertung mit 14 Signalen: u. a. Toxizität, Echtheit, betrügerische Absicht, Stimmung, Entitäten. Es löst Alerts aus und kann Fälle für Google vorbereiten.',
        },
        {
          question: 'Wie funktioniert Fake-Review-Erkennung?',
          answer:
            'Der Algorithmus kombiniert Zeitmuster (ungewöhnliche Peaks), sprachliche Muster über Konten, Geo und Profilverlauf. Jede Bewertung erhält einen Authentizitäts-Score im Dashboard.',
        },
        {
          question: 'Kann ich eine Bewertung direkt aus REPUTEXA anfechten?',
          answer:
            'Der KI-Schild erstellt ein Dossier (Argumente, Formulierung) für das Meldeformular von Google Business Profile. Google bietet keine öffentliche API zum Löschen in Ihrem Namen — die finale Einreichung bleibt bei Google.',
        },
        {
          question: 'Sind WhatsApp-Alerts in jedem Plan?',
          answer:
            'Sofort-Alerts und der wöchentliche WhatsApp-Digest ab PULSE (97 €/Monat). VISION nur E-Mail. Bei ZENITH kann AI Capture 30 Min. nach dem Besuch eine WhatsApp-Einladung senden.',
        },
      ],
    },
    {
      id: 'integration',
      iconKey: 'Plug',
      label: 'Integration & API',
      color: 'text-blue-400',
      faqs: [
        {
          question: 'Wie verbinde ich Google Business Profile?',
          answer:
            'Dashboard → Einstellungen → Plattformen → „Google verbinden“. OAuth öffnet sich — business.manage gewähren. ~30 Sekunden bis Sync, kein manueller API-Schlüssel.',
        },
        {
          question: 'Welche Review-Plattformen sind angebunden?',
          answer:
            'REPUTEXA synchronisiert Google Business Profile, Facebook und Trustpilot (Google OAuth, andere per Webhook). Weitere sind auf der Roadmap.',
        },
        {
          question: 'Kasse oder Zapier anbinden?',
          answer:
            'Ja über AI Capture (nur ZENITH). Schlüssel rtx_live_… unter Einstellungen → Integrationen. POS (Square, SumUp) oder Zapier/Make sendet Besuchsdaten; WhatsApp-Einladung 30 Min. später.',
        },
        {
          question: 'Wie viele Standorte kann ich verwalten?',
          answer:
            'Kein Plan-Limit: Abrechnung nach aktiven Standorten mit Staffelrabatt (1. voller Preis, 2. −20 %, 3. −30 %, 4. −40 %, 5+ −50 %). Ein Dashboard für alle.',
        },
      ],
    },
    {
      id: 'billing',
      iconKey: 'CreditCard',
      label: 'Abrechnung & Abo',
      color: 'text-amber-400',
      faqs: [
        {
          question: 'Kann ich den Plan jederzeit wechseln?',
          answer:
            'Ja. Upgrade/Downgrade unter Einstellungen → Abo. Upgrades sofort mit Proration; Downgrades zum nächsten Verlängerungstermin.',
        },
        {
          question: 'Ist die Testversion vollständig?',
          answer:
            'Ja — 14 Tage voller ZENITH-Umfang ohne Feature-Limit. Keine Karte nötig zum Start.',
        },
        {
          question: 'Wie ist die Rückerstattungspolitik?',
          answer:
            'Nicht zufrieden in den ersten 30 Tagen nach Abschluss: volle Rückerstattung. Kontakt: support@reputexa.fr.',
        },
      ],
    },
    {
      id: 'stats',
      iconKey: 'BarChart2',
      label: 'Statistiken & Reports',
      color: 'text-pink-400',
      faqs: [
        {
          question: 'Wie oft aktualisieren sich Statistiken?',
          answer:
            'Reviews kommen in Echtzeit per Webhook. Das Dashboard zeigt immer den neuesten Stand. Aggregate werden bei jedem Laden neu berechnet.',
        },
        {
          question: 'PDF-Export möglich?',
          answer:
            'Ja. Monatlich ein „Kanzlei“-PDF (Stats + KI-Texte je Plan): sachlich Vision, Analyse Pulse, Strategie Zenith. Per E-Mail und aus dem Archiv. Pulse/Zenith zusätzlich Wochenrekapitulation per WhatsApp.',
        },
      ],
    },
    {
      id: 'global',
      iconKey: 'Globe',
      label: 'Mehrsprachig & international',
      color: 'text-cyan-400',
      faqs: [
        {
          question: 'Funktioniert REPUTEXA außerhalb Frankreichs?',
          answer:
            'Ja — FR, BE, CH, ES, IT, DE. Infrastruktur in der EU (Paris, Frankfurt) DSGVO-orientiert.',
        },
        {
          question: 'Ist die Oberfläche mehrsprachig?',
          answer:
            'UI in FR, EN, ES, DE, IT. Umschalten in den Einstellungen oder über die Sprachauswahl in der Fußzeile.',
        },
      ],
    },
  ],
};
