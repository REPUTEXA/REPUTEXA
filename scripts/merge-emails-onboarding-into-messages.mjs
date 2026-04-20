/**
 * Fusionne Emails.Onboarding dans messages/{fr,en,es,de,it}.json
 * (fichiers JSON monoligne — parse + stringify).
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const localesDir = path.join(root, 'messages');

const ONBOARDING = {
  fr: {
    guestName: 'toi',
    stepsTitle: 'Tes prochaines étapes',
    cta: 'Accéder à mon dashboard',
    subjectTrial: "🚀 C'est parti ! Tes 14 jours d'accès {planName} commencent.",
    subjectPaid: '✅ Paiement confirmé : Bienvenue chez Reputexa ({planName})',
    yearAnnual:
      'Merci pour ton engagement sur la durée : tu bénéficies de -20% sur l\'année. On est à tes côtés pour les 12 prochains mois.',
    invoiceLink: 'Voir ma facture',
    vision: {
      title: 'Bravo pour ce premier pas.',
      intro:
        "{customerName}, tu as fait le choix de prendre ta réputation en main. Vision te donne l'essentiel : réponses IA illimitées et tableau de bord pour ne plus laisser un avis sans réponse.",
      step1:
        "<strong>🔍 Premier pas</strong> — Connecte ton Google Business dans Paramètres pour que l'IA analyse tes avis.",
    },
    pulse: {
      title: 'Tu es prêt à réagir en temps réel.',
      intro:
        "{customerName}, Pulse ajoute la puissance des alertes et de l'analyse de sentiment. Reste réactif et garde le contrôle.",
      step1:
        "<strong>🔍 Analyse</strong> — Connecte ton Google Business pour voir l'IA analyser tes avis.",
      step2:
        '<strong>📲 Réactivité</strong> — Configure tes alertes WhatsApp pour ne plus rien rater.',
    },
    zenith: {
      title: "Bienvenue dans l'élite de la réputation.",
      intro:
        '{customerName}, tu as maintenant les mêmes outils que les plus grandes entreprises. Zénith, c\'est la Triple Vérification, le Boost SEO et un accompagnement stratégique avancé.',
      step1:
        "<strong>🔍 Analyse</strong> — Connecte ton Google Business pour voir l'IA analyser tes avis.",
      step2:
        '<strong>📲 Réactivité</strong> — Configure tes alertes WhatsApp pour ne plus rien rater.',
      step3: '<strong>🧠 Stratégie</strong> — Pose ta première question stratégique.',
    },
    trial: {
      giftTitle: '🎁 Ton essai Zénith est 100% libre',
      giftBeforeLink: 'Tu peux annuler en un clic à tout moment depuis ',
      giftSettingsLink: 'tes paramètres',
      giftAfterLink:
        " pour ne pas être prélevé. Si tu adores Reputexa mais que tu préfères un plan plus léger (PULSE ou VISION) à la fin de l'essai, tu pourras changer d'offre très simplement avant la fin des 14 jours.",
      endsBefore: 'Ton essai se termine le ',
      endsAfter: '.',
      notConvinced: 'Pas convaincu ? ',
      cancelTrialLink: 'Annuler mon essai immédiatement',
    },
  },
  en: {
    guestName: 'there',
    stepsTitle: 'Your next steps',
    cta: 'Open my dashboard',
    subjectTrial: '🚀 Your 14 days of {planName} access start now.',
    subjectPaid: '✅ Payment confirmed — welcome to Reputexa ({planName})',
    yearAnnual:
      'Thanks for committing for the year: you get 20% off annually. We’re with you for the next 12 months.',
    invoiceLink: 'View my invoice',
    vision: {
      title: 'Great first step.',
      intro:
        '{customerName}, you’ve chosen to take charge of your reputation. Vision gives you the essentials: unlimited AI replies and a dashboard so no review goes unanswered.',
      step1:
        '<strong>🔍 First step</strong> — Connect Google Business in Settings so AI can analyse your reviews.',
    },
    pulse: {
      title: 'You’re ready to react in real time.',
      intro:
        '{customerName}, Pulse adds powerful alerts and sentiment analysis. Stay responsive and in control.',
      step1:
        '<strong>🔍 Analysis</strong> — Connect Google Business so AI can analyse your reviews.',
      step2:
        '<strong>📲 Reactivity</strong> — Set up WhatsApp alerts so nothing slips through.',
    },
    zenith: {
      title: 'Welcome to reputation excellence.',
      intro:
        '{customerName}, you now have the same tools as top-tier companies. Zenith means triple verification, SEO boost, and advanced strategic support.',
      step1:
        '<strong>🔍 Analysis</strong> — Connect Google Business so AI can analyse your reviews.',
      step2:
        '<strong>📲 Reactivity</strong> — Set up WhatsApp alerts so nothing slips through.',
      step3: '<strong>🧠 Strategy</strong> — Ask your first strategic question.',
    },
    trial: {
      giftTitle: '🎁 Your Zenith trial is 100% free',
      giftBeforeLink: 'You can cancel anytime in one click from ',
      giftSettingsLink: 'your settings',
      giftAfterLink:
        ' to avoid being charged. If you love Reputexa but want a lighter plan (PULSE or VISION) after the trial, you can switch easily before day 14.',
      endsBefore: 'Your trial ends on ',
      endsAfter: '.',
      notConvinced: 'Not convinced? ',
      cancelTrialLink: 'Cancel my trial now',
    },
  },
  es: {
    guestName: 'tú',
    stepsTitle: 'Tus próximos pasos',
    cta: 'Ir a mi panel',
    subjectTrial: '🚀 ¡Empezamos! Tus 14 días de acceso {planName}.',
    subjectPaid: '✅ Pago confirmado: bienvenido a Reputexa ({planName})',
    yearAnnual:
      'Gracias por el compromiso anual: tienes un 20% de descuento. Te acompañamos los próximos 12 meses.',
    invoiceLink: 'Ver mi factura',
    vision: {
      title: 'Excelente primer paso.',
      intro:
        '{customerName}, has decidido tomar el control de tu reputación. Vision te da lo esencial: respuestas IA ilimitadas y un panel para no dejar ninguna reseña sin respuesta.',
      step1:
        '<strong>🔍 Primer paso</strong> — Conecta Google Business en Ajustes para que la IA analice tus reseñas.',
    },
    pulse: {
      title: 'Estás listo para reaccionar en tiempo real.',
      intro:
        '{customerName}, Pulse añade alertas potentes y análisis de sentimiento. Mantente reactivo y al mando.',
      step1:
        '<strong>🔍 Análisis</strong> — Conecta Google Business para ver a la IA analizar tus reseñas.',
      step2:
        '<strong>📲 Reactividad</strong> — Configura alertas WhatsApp para no perderte nada.',
    },
    zenith: {
      title: 'Bienvenido a la élite de la reputación.',
      intro:
        '{customerName}, ahora tienes las mismas herramientas que las grandes empresas. Zenith es triple verificación, impulso SEO y acompañamiento estratégico avanzado.',
      step1:
        '<strong>🔍 Análisis</strong> — Conecta Google Business para ver a la IA analizar tus reseñas.',
      step2:
        '<strong>📲 Reactividad</strong> — Configura alertas WhatsApp para no perderte nada.',
      step3:
        '<strong>🧠 Estrategia</strong> — Haz tu primera pregunta estratégica.',
    },
    trial: {
      giftTitle: '🎁 Tu prueba Zenith es 100% gratuita',
      giftBeforeLink: 'Puedes cancelar en un clic desde ',
      giftSettingsLink: 'tus ajustes',
      giftAfterLink:
        ' para no ser cobrado. Si te gusta Reputexa pero prefieres un plan más ligero (PULSE o VISION), podrás cambiar antes del día 14.',
      endsBefore: 'Tu prueba termina el ',
      endsAfter: '.',
      notConvinced: '¿No estás convencido? ',
      cancelTrialLink: 'Cancelar mi prueba ahora',
    },
  },
  de: {
    guestName: 'du',
    stepsTitle: 'Deine nächsten Schritte',
    cta: 'Zum Dashboard',
    subjectTrial: '🚀 Los geht’s! Deine 14 Tage {planName} starten jetzt.',
    subjectPaid: '✅ Zahlung bestätigt — willkommen bei Reputexa ({planName})',
    yearAnnual:
      'Danke für dein Jahresengagement: du erhältst 20% Rabatt. Wir begleiten dich die nächsten 12 Monate.',
    invoiceLink: 'Rechnung anzeigen',
    vision: {
      title: 'Starker erster Schritt.',
      intro:
        '{customerName}, du übernimmst die Kontrolle über deine Reputation. Vision liefert das Wesentliche: unbegrenzte KI-Antworten und ein Dashboard, damit keine Bewertung offen bleibt.',
      step1:
        '<strong>🔍 Erster Schritt</strong> — Verbinde Google Business in den Einstellungen, damit die KI deine Bewertungen analysiert.',
    },
    pulse: {
      title: 'Du bist bereit, in Echtzeit zu reagieren.',
      intro:
        '{customerName}, Pulse ergänzt starke Alerts und Sentiment-Analyse. Bleib wachsam und behalte die Kontrolle.',
      step1:
        '<strong>🔍 Analyse</strong> — Verbinde Google Business, damit die KI deine Bewertungen auswertet.',
      step2:
        '<strong>📲 Reaktionszeit</strong> — Richte WhatsApp-Alerts ein, damit nichts verloren geht.',
    },
    zenith: {
      title: 'Willkommen in der Reputation-Elite.',
      intro:
        '{customerName}, du hast jetzt die gleichen Werkzeuge wie große Unternehmen. Zenith bedeutet Dreifach-Prüfung, SEO-Boost und fortgeschrittene strategische Begleitung.',
      step1:
        '<strong>🔍 Analyse</strong> — Verbinde Google Business, damit die KI deine Bewertungen auswertet.',
      step2:
        '<strong>📲 Reaktionszeit</strong> — Richte WhatsApp-Alerts ein, damit nichts verloren geht.',
      step3:
        '<strong>🧠 Strategie</strong> — Stelle deine erste strategische Frage.',
    },
    trial: {
      giftTitle: '🎁 Dein Zenith-Test ist 100% kostenlos',
      giftBeforeLink: 'Du kannst jederzeit mit einem Klick in den ',
      giftSettingsLink: 'Einstellungen',
      giftAfterLink:
        ' kündigen, um keine Abbuchung zu riskieren. Wenn du Reputexa magst, aber einen leichteren Plan (PULSE oder VISION) willst, wechselst du einfach vor Tag 14.',
      endsBefore: 'Dein Test endet am ',
      endsAfter: '.',
      notConvinced: 'Nicht überzeugt? ',
      cancelTrialLink: 'Test sofort beenden',
    },
  },
  it: {
    guestName: 'tu',
    stepsTitle: 'I prossimi passi',
    cta: 'Apri la dashboard',
    subjectTrial: '🚀 Iniziano i tuoi 14 giorni di accesso {planName}.',
    subjectPaid: '✅ Pagamento confermato — benvenuto su Reputexa ({planName})',
    yearAnnual:
      'Grazie per l’impegno annuale: hai il 20% di sconto. Siamo al tuo fianco per i prossimi 12 mesi.',
    invoiceLink: 'Vedi la mia fattura',
    vision: {
      title: 'Ottimo primo passo.',
      intro:
        '{customerName}, hai scelto di prendere in mano la tua reputazione. Vision ti dà l’essenziale: risposte IA illimitate e una dashboard così nessuna recensione resta senza risposta.',
      step1:
        '<strong>🔍 Primo passo</strong> — Collega Google Business in Impostazioni così l’IA analizza le recensioni.',
    },
    pulse: {
      title: 'Sei pronto a reagire in tempo reale.',
      intro:
        '{customerName}, Pulse aggiunge alert potenti e analisi del sentiment. Resta reattivo e al comando.',
      step1:
        '<strong>🔍 Analisi</strong> — Collega Google Business per vedere l’IA analizzare le recensioni.',
      step2:
        '<strong>📲 Reattività</strong> — Configura gli alert WhatsApp per non perdere nulla.',
    },
    zenith: {
      title: 'Benvenuto nell’élite della reputazione.',
      intro:
        '{customerName}, ora hai gli stessi strumenti delle grandi aziende. Zenith è tripla verifica, boost SEO e supporto strategico avanzato.',
      step1:
        '<strong>🔍 Analisi</strong> — Collega Google Business per vedere l’IA analizzare le recensioni.',
      step2:
        '<strong>📲 Reattività</strong> — Configura gli alert WhatsApp per non perdere nulla.',
      step3:
        '<strong>🧠 Strategia</strong> — Fai la tua prima domanda strategica.',
    },
    trial: {
      giftTitle: '🎁 La prova Zenith è gratuita al 100%',
      giftBeforeLink: 'Puoi annullare in un clic da ',
      giftSettingsLink: 'impostazioni',
      giftAfterLink:
        ' per non essere addebitato. Se ami Reputexa ma preferisci un piano più leggero (PULSE o VISION), potrai cambiare prima del giorno 14.',
      endsBefore: 'La prova termina il ',
      endsAfter: '.',
      notConvinced: 'Non convinto? ',
      cancelTrialLink: 'Annulla subito la prova',
    },
  },
};

for (const loc of ['fr', 'en', 'es', 'de', 'it']) {
  const file = path.join(localesDir, `${loc}.json`);
  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  data.Emails = data.Emails || {};
  data.Emails.Onboarding = ONBOARDING[loc];
  fs.writeFileSync(file, JSON.stringify(data));
  console.log('merged Emails.Onboarding ->', loc);
}
