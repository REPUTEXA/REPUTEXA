/**
 * Dashboard.bananoParametres — Paramètres Banano (relances, sections).
 * Locales non fr/en : copie EN (pas de repli FR sur clés manquantes).
 * Run: node scripts/merge-banano-parametres-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const FR = {
  errLoad: 'Erreur chargement',
  errInvalid: 'Réponse invalide.',
  errGeneric: 'Erreur',
  toastRelancesSaved: 'Relances enregistrées',
  loadingSettings: 'Chargement des paramètres…',
  loadingPilotRules: 'Chargement des réglages…',
  loadLoyaltyFailed: 'Impossible de charger le programme fidélité.',
  loadRulesFailed:
    'Impossible de charger les règles automatiques (migration Supabase / tables pilote).',
  headerTitle: 'Paramètres',
  headerLead:
    'Réglages du programme (seuil points ou tampons, récompense) et relances WhatsApp automatiques (client inactif, anniversaire, client VIP du mois). Le terminal caisse utilise ces valeurs en direct.',
  sectionLoyaltyTitle: 'Programme fidélité (caisse)',
  sectionRelancesTitle: 'Relances WhatsApp',
  autoMessagesTitle: 'Messages automatiques',
  whatsappHelpA:
    "Une case décochée = aucun envoi automatique pour cette règle (le cron ignore la ligne). Vous rédigez seulement la touche personnelle au centre du message. Le prénom vient de la fiche client, et l'introduction utilise le nom enregistré pour votre commerce : ",
  whatsappHelpB: '. Modifiez ce nom dans ',
  whatsappHelpC:
    ". Indiquez aussi la date d'anniversaire sur les fiches (Base clients). Le VIP du mois est calculé sur le mois civil précédent ; envoi automatique le 1er du mois (Paris) si la règle est activée. Envoi : cron + Twilio.",
  establishmentNameFallback: "non renseigné — « notre équipe » sera utilisé à l'envoi",
  linkAccountSettings: 'Réglages compte',
  lostClientLabel: 'Client perdu (inactif)',
  lostClientDisabled:
    'Désactivé : aucune relance « client perdu » ne part automatiquement. Cochez et enregistrez pour réactiver.',
  daysInactiveLabel: 'Jours sans visite avant envoi',
  minVisitsLabel: 'Visites min. (historique)',
  personalTouchLabel: 'Touche personnelle (phrase du milieu)',
  placeholderLost: 'Ex. : vous nous manquez, on serait ravis de vous revoir…',
  discountWithMessage: 'Réduction offerte avec ce message',
  typeLabel: 'Type',
  optNone: 'Aucune',
  optPercent: 'Pourcentage',
  optFixedEur: 'Montant fixe (€)',
  percentRange: 'Pourcentage (1–100)',
  amountEurFixed: 'Montant en euros (remise fixe)',
  previewLostBirthTitle: 'Aperçu (ex. prénom {prenom}{establishmentSuffix})',
  establishmentSuffix: ', {name}',
  birthdayLabel: 'Anniversaire (jour exact, date sur la fiche client)',
  birthdayDisabled:
    "Désactivé : aucun message automatique le jour J. Cochez et enregistrez pour réactiver (la date d'anniversaire reste sur la fiche).",
  placeholderBirth: "Ex. : toute l'équipe vous embrasse pour votre jour J…",
  birthdayDiscountTitle: 'Réduction / cadeau anniversaire',
  optNoneTextOnly: 'Aucune (texte seul)',
  vipLabel: 'Client VIP du mois (meilleur cumul CA sur le mois civil écoulé)',
  vipDisabled:
    'Désactivé : aucun message automatique pour le meilleur client du mois précédent. Le tableau Pilotage affiche toujours le classement en direct.',
  variablesHelp:
    'Variables disponibles dans un gabarit à accolades : {{prenom}} {{etablissement}} {{periode}} {{montant_ca}} {{reduction}}.',
  placeholderVip: 'Ex. : un immense merci pour votre fidélité sur cette période…',
  vipDiscountTitle: 'Réduction / cadeau VIP',
  saveRelances: 'Enregistrer les relances',
  previewVipTitle:
    'Aperçu (ex. prénom {prenom}{establishmentSuffix}, période {period}, cumul {amount})',
  previewOfferLost: 'une offre spéciale',
  previewGiftBirth: 'Un petit cadeau vous attend',
  previewAttentionVip: 'une petite attention vous attend',
  vipPreviewPeriod: 'du 1 au 28 février 2026',
  vipPreviewAmount: '127,50 €',
  previewFirstName: 'Marie',
};

const EN = {
  errLoad: 'Load error',
  errInvalid: 'Invalid response.',
  errGeneric: 'Error',
  toastRelancesSaved: 'Automations saved',
  loadingSettings: 'Loading settings…',
  loadingPilotRules: 'Loading automation rules…',
  loadLoyaltyFailed: 'Could not load the loyalty program.',
  loadRulesFailed: 'Could not load automation rules (Supabase migration / pilot tables).',
  headerTitle: 'Settings',
  headerLead:
    'Program settings (points or stamp threshold, reward) and automatic WhatsApp follow-ups (inactive customer, birthday, VIP of the month). The register terminal uses these values live.',
  sectionLoyaltyTitle: 'Loyalty program (register)',
  sectionRelancesTitle: 'WhatsApp follow-ups',
  autoMessagesTitle: 'Automatic messages',
  whatsappHelpA:
    'If a box is unchecked, no automatic send runs for that rule (the cron skips it). You only write the personal touch in the middle of the message. First name comes from the customer record, and the intro uses the name saved for your business: ',
  whatsappHelpB: '. Edit this name under ',
  whatsappHelpC:
    '. Also set the birthday on customer records (Customer base). VIP of the month is based on the previous calendar month; automatic send on the 1st (Paris time) if the rule is on. Delivery: cron + Twilio.',
  establishmentNameFallback: 'not set — “our team” will be used when sending',
  linkAccountSettings: 'Account settings',
  lostClientLabel: 'Lost customer (inactive)',
  lostClientDisabled:
    'Off: no “lost customer” message is sent automatically. Check and save to re-enable.',
  daysInactiveLabel: 'Days without a visit before sending',
  minVisitsLabel: 'Min. visits (history)',
  personalTouchLabel: 'Personal touch (middle phrase)',
  placeholderLost: 'E.g. we miss you and would love to see you again…',
  discountWithMessage: 'Discount offered with this message',
  typeLabel: 'Type',
  optNone: 'None',
  optPercent: 'Percentage',
  optFixedEur: 'Fixed amount (€)',
  percentRange: 'Percentage (1–100)',
  amountEurFixed: 'Amount in euros (fixed discount)',
  previewLostBirthTitle: 'Preview (e.g. first name {prenom}{establishmentSuffix})',
  establishmentSuffix: ', {name}',
  birthdayLabel: 'Birthday (exact day — date on customer record)',
  birthdayDisabled:
    'Off: no automatic message on the day. Check and save to re-enable (birthday stays on the record).',
  placeholderBirth: 'E.g. the whole team wishes you a wonderful birthday…',
  birthdayDiscountTitle: 'Birthday discount / gift',
  optNoneTextOnly: 'None (text only)',
  vipLabel: 'VIP of the month (highest revenue on the previous calendar month)',
  vipDisabled:
    'Off: no automatic message for the top customer of the previous month. The Cockpit table still shows the live ranking.',
  variablesHelp:
    'Variables available in a template with braces: {{prenom}} {{etablissement}} {{periode}} {{montant_ca}} {{reduction}}.',
  placeholderVip: 'E.g. a huge thank you for your loyalty this period…',
  vipDiscountTitle: 'VIP discount / gift',
  saveRelances: 'Save follow-up rules',
  previewVipTitle: 'Preview (e.g. first name {prenom}{establishmentSuffix}, period {period}, total {amount})',
  previewOfferLost: 'a special offer',
  previewGiftBirth: 'A little gift is waiting for you',
  previewAttentionVip: 'a small treat is waiting for you',
  vipPreviewPeriod: 'Feb 1–28, 2026',
  vipPreviewAmount: '€127.50',
  previewFirstName: 'Jane',
};

const locales = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh'];
for (const loc of locales) {
  const p = path.join(root, 'messages', `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.Dashboard = j.Dashboard || {};
  const payload = loc === 'fr' ? FR : loc === 'en' ? EN : { ...EN };
  j.Dashboard.bananoParametres = payload;
  fs.writeFileSync(p, JSON.stringify(j));
}
console.log('Merged Dashboard.bananoParametres for', locales.length, 'locales');
