/**
 * bananoVoucherArchive, bananoPublicJoin, bananoManualWhatsapp, bananoPilotageDaily
 * Run: node scripts/merge-banano-modules-part1.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function pack(fr, en) {
  return { fr, en };
}

const bananoVoucherArchive = {
  ...pack(
    {
      emptyArchive:
        "Aucune archive pour l'instant. Le premier export CSV est créé automatiquement au prochain passage du cron (1er du mois vers 8h UTC, comme le rapport performance IA), ou contactez le support pour une extraction manuelle urgente.",
      lastMonthArchived: 'Dernier mois archivé',
      archive: 'Archive',
      downloadCsv: 'Télécharger CSV →',
      rowsCount: '{count, plural, one {# ligne} other {# lignes}}',
    },
    {
      emptyArchive:
        'No archives yet. The first CSV export is created automatically on the next cron run (1st of the month around 8:00 UTC, like the AI performance report), or contact support for an urgent manual extract.',
      lastMonthArchived: 'Latest archived month',
      archive: 'Archive',
      downloadCsv: 'Download CSV →',
      rowsCount: '{count, plural, one {# row} other {# rows}}',
    },
  ),
};

const bananoPublicJoin = {
  ...pack(
    {
      errEnroll: 'Inscription impossible.',
      errNetwork: 'Réseau indisponible. Réessayez.',
      successCard:
        'Carte créée. Ajoutez-la à votre Wallet pour présenter le code en caisse.',
      ctaWallet: 'Préparer Apple / Google Wallet',
      subtitle: 'Fidélité — cadeau de bienvenue en quelques secondes.',
      labelFirstName: 'Prénom',
      labelLastName: 'Nom',
      labelPhone: 'Téléphone (mobile)',
      phonePlaceholder: '+33 …',
      labelBirth: 'Date de naissance (optionnel)',
      brandFallback: 'Votre enseigne',
      busy: 'Patience…',
      ctaSubmit: 'Valider et recevoir ma carte',
    },
    {
      errEnroll: 'Could not complete signup.',
      errNetwork: 'Network unavailable. Try again.',
      successCard: 'Card created. Add it to your Wallet to show the code at checkout.',
      ctaWallet: 'Set up Apple / Google Wallet',
      subtitle: 'Loyalty — welcome gift in seconds.',
      labelFirstName: 'First name',
      labelLastName: 'Last name',
      labelPhone: 'Phone (mobile)',
      phonePlaceholder: '+1 …',
      labelBirth: 'Date of birth (optional)',
      brandFallback: 'Your brand',
      busy: 'Please wait…',
      ctaSubmit: 'Confirm and get my card',
    },
  ),
};

const bananoManualWhatsapp = {
  ...pack(
    {
      close: 'Fermer',
      title: 'Message WhatsApp manuel',
      customerFallback: 'Client',
      birthdayBadge: 'Anniv.',
      yourMessage: 'Votre message',
      placeholder: 'Écrivez votre message...',
      rephraseAi: 'Reformuler par IA (pro)',
      scheduleLabel: "Planifier l'envoi (date & heure)",
      scheduleHint:
        "Envoi via Twilio (hors scénarios Zenith automatisés). Respectez l'opposition client (STOP). Vous restez responsable du contenu et du respect du RGPD.",
      cancel: 'Annuler',
      sendNow: 'Envoyer maintenant',
      schedule: 'Programmer',
      toastDraftShort: 'Écrivez un brouillon à reformuler.',
      toastRephrased: 'Texte reformulé',
      toastEmpty: 'Message vide.',
      toastPickSchedule: "Choisissez une date et heure d'envoi.",
      toastInvalidDate: 'Date invalide.',
      toastScheduleLead: "L'envoi programmé doit être au moins dans environ 2 minutes.",
      toastScheduled: 'Message programmé',
      toastSent: 'Message WhatsApp envoyé',
      errGeneric: 'Erreur',
    },
    {
      close: 'Close',
      title: 'Manual WhatsApp message',
      customerFallback: 'Customer',
      birthdayBadge: 'Bday',
      yourMessage: 'Your message',
      placeholder: 'Write your message...',
      rephraseAi: 'Rephrase with AI (pro)',
      scheduleLabel: 'Schedule send (date & time)',
      scheduleHint:
        'Sent via Twilio (outside automated Zenith flows). Honor opt-outs (STOP). You are responsible for content and GDPR compliance.',
      cancel: 'Cancel',
      sendNow: 'Send now',
      schedule: 'Schedule',
      toastDraftShort: 'Write a draft to rephrase.',
      toastRephrased: 'Text rephrased',
      toastEmpty: 'Empty message.',
      toastPickSchedule: 'Pick a send date and time.',
      toastInvalidDate: 'Invalid date.',
      toastScheduleLead: 'Scheduled send must be at least about 2 minutes from now.',
      toastScheduled: 'Message scheduled',
      toastSent: 'WhatsApp message sent',
      errGeneric: 'Error',
    },
  ),
};

const bananoPilotageDaily = {
  ...pack(
    {
      title: 'Caisse — historique & découpe',
      period: 'Période :',
      thisMonth: 'Ce mois-ci',
      lastMonth: 'Mois dernier',
      monthLabel: 'Mois',
      customRange: 'Plage perso.',
      refresh: 'Actualiser',
      byDay: 'Par jour',
      byWeek: 'Par semaine',
      loading: 'Chargement…',
      errGeneric: 'Erreur',
      thDay: 'Jour',
      thWeek: 'Semaine',
      thPass: 'Pass.',
      thCa: 'CA',
      thAvg: 'Panier moy.',
      thArt: 'Art.',
      thTop: 'Top libellés',
      page: 'Page {current} / {total}',
      close: 'Fermer',
    },
    {
      title: 'Register — history & breakdown',
      period: 'Period:',
      thisMonth: 'This month',
      lastMonth: 'Last month',
      monthLabel: 'Month',
      customRange: 'Custom range',
      refresh: 'Refresh',
      byDay: 'By day',
      byWeek: 'By week',
      loading: 'Loading…',
      errGeneric: 'Error',
      thDay: 'Day',
      thWeek: 'Week',
      thPass: 'Visits',
      thCa: 'Revenue',
      thAvg: 'Avg. basket',
      thArt: 'Items',
      thTop: 'Top labels',
      page: 'Page {current} / {total}',
      close: 'Close',
    },
  ),
};

function mergeNs(name, dict) {
  for (const loc of ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh']) {
    const p = path.join(root, 'messages', `${loc}.json`);
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.Dashboard = j.Dashboard || {};
    const payload = loc === 'fr' ? dict.fr : loc === 'en' ? dict.en : { ...dict.en };
    j.Dashboard[name] = payload;
    fs.writeFileSync(p, JSON.stringify(j));
  }
}

mergeNs('bananoVoucherArchive', bananoVoucherArchive);
mergeNs('bananoPublicJoin', bananoPublicJoin);
mergeNs('bananoManualWhatsapp', bananoManualWhatsapp);
mergeNs('bananoPilotageDaily', bananoPilotageDaily);
console.log('Merged part1: voucher, publicJoin, manualWhatsapp, pilotageDaily');
