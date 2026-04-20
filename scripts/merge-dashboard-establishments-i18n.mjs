/**
 * Fusionne les clés UI Dashboard.establishments dans messages/fr.json puis :
 * node scripts/sync-all-locale-messages.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frPath = path.join(__dirname, '..', 'messages', 'fr.json');

const extra = {
  subscriptionLoadError:
    "Nous n'arrivons pas à charger votre abonnement. Vérifiez votre connexion.",
  retryCta: 'Réessayez',
  establishmentsCountLabel: 'Établissements : {current} / {max}',
  beyondQuota: '({count} au-delà du quota)',
  savingsPerMonthLine: '· Économie : {amount}€/mois',
  addSlotCta: 'Ajouter un emplacement',
  reduceQuotaCta: 'Réduire mon quota payé',
  badgeConfigure: 'À configurer',
  badgePrincipal: 'PRINCIPAL',
  badgeSiege: 'SIÈGE',
  statusConfigured: 'Configuré',
  statusPending: 'En attente',
  pricePerMonthShort: '{price}€/mois',
  savingsVsBase: 'Économie : {amount}€/mois',
  configureSlotButton: 'Configurer mon emplacement',
  defaultSlotBadge: 'Emplacement par défaut',
  setDefaultCta: 'Définir comme emplacement par défaut',
  ariaEdit: 'Modifier',
  ariaDelete: 'Supprimer',
  emptySlotTitle: 'Emplacement payé — fiche à créer',
  emptySlotHint: 'Nous alignons vos emplacements avec votre quota Stripe. Un clic suffit.',
  emptySlotCta: 'Actualiser et créer la fiche',
  archivedSectionTitle: 'Emplacements désactivés ({count})',
  archivedBodyOne:
    'Cet emplacement a été désactivé suite à la réduction de votre forfait.',
  archivedBodyMany:
    'Ces emplacements ont été désactivés suite à la réduction de votre forfait.',
  archivedBodyRest:
    'Vos données restent enregistrées si vous souhaitez les conserver ; vous pouvez les modifier à tout moment ou les supprimer définitivement.',
  modalAddTitle: 'Ajouter un établissement',
  googleReconnectHint: 'Reconnectez Google dans Paramètres pour importer vos lieux Business.',
  googleReconnectLink: 'Paramètres',
  fromGoogleTitle: 'Depuis Google Business',
  loadingEllipsis: 'Chargement…',
  googleLocationsCount: '{count} lieu(x) non importé(s)',
  connectGoogleSettings: 'Connectez Google dans Paramètres',
  noLocationsToImport: 'Aucun lieu disponible à importer',
  manualAddTitle: 'Ajouter manuellement',
  manualAddSubtitle: 'Protéger un lieu sur un autre compte Google',
  cancel: 'Annuler',
  back: 'Retour',
  backArrow: '← Retour',
  noUnimportedGoogle: 'Aucun lieu Google non importé. Ajoutez-en un manuellement.',
  recapAdding: 'Ajout de {name}',
  discountIncluded: ' — Remise {discount}% incluse',
  debitTodayProrata: "Débit aujourd'hui : {amount}€ (prorata restant du mois)",
  thenSubscriptionWillBe: 'Puis votre abonnement passera à {amount}€/mois',
  confirmAdd: "Confirmer l'ajout",
  manualDiscountBanner:
    'Remise -{discount}% pour ce nouvel établissement — {price}€/mois',
  labelNameRequired: 'Nom',
  labelAddress: 'Adresse',
  placeholderRestaurant: 'Ex : Restaurant Le Bistro',
  placeholderAddress: 'Ex : 12 rue de la Paix, 75001 Paris',
  titleConfigureEstablishment: "Configurer l'établissement",
  titleEditEstablishment: "Modifier l'établissement",
  ariaClose: 'Fermer',
  loadingAccountPrefs: 'Chargement des réglages du compte…',
  settingsSameAsRich:
    'Téléphone, WhatsApp, seuil d&apos;alerte et personnalisation IA sont les mêmes que dans <settings>Paramètres</settings>.',
  googleNotConnectedRich:
    'Non connecté. La liaison OAuth et l&apos;import des lieux se font dans <settings>Paramètres → Plateformes</settings>.',
  labelSlotName: "Nom de l'emplacement",
  labelEstablishmentType: "Type d'établissement",
  placeholderEstablishmentType: 'Hôtel, restaurant, bar...',
  googleBusinessCard: 'Google Business (cette fiche)',
  googleConnected: 'Connecté',
  googleConnectedDetail: ' · ',
  labelPhone: 'Téléphone',
  labelWhatsapp: 'WhatsApp',
  phonePlaceholder: '6 12 34 56 78',
  labelAlertStars: 'Alerte avis (étoiles ≤)',
  starSingular: '{n} étoile',
  starPlural: '{n} étoiles',
  aiPersonalizationTitle: 'Personnalisation IA des réponses',
  aiPersonalizationHint: 'Même réglage que dans Paramètres ; un seul enregistrement pour tout le compte.',
  labelTone: 'Ton',
  labelLength: 'Longueur',
  toneProfessional: 'Professionnel',
  toneWarm: 'Chaleureux',
  toneCasual: 'Décontracté',
  toneLuxury: 'Luxueux',
  toneHumorous: 'Humoristique',
  lengthConcise: 'Concis',
  lengthBalanced: 'Équilibré',
  lengthDetailed: 'Détaillé',
  safeModeTitle: 'Mode prudence (formulations plus sûres)',
  safeModeDesc: 'Réduit les engagements risqués dans les réponses générées.',
  labelCustomInstructions: 'Instructions spécifiques',
  placeholderAiInstructions:
    'Ex : Toujours mentionner la terrasse ombragée.\nNe pas proposer de remboursement sans validation.',
  voiceAnalyzing: 'Analyse…',
  voiceDictate: 'Dicter',
  voiceFinish: 'Terminer',
  save: 'Enregistrer',
  expansionCalculatorTitle: "Calculatrice d'expansion",
  expansionCalculatorBody:
    "Combien d'établissements voulez-vous ajouter ? Plus vous en prenez, plus le prix unitaire baisse.",
  labelCountToAdd: 'Nombre à ajouter',
  expansionSitesLine:
    'Vous avez {sites} {sitesWord}. Cible : {target} établissements',
  expansionSiteSingular: 'site',
  expansionSitePlural: 'sites',
  supplementalFirst: '1er supplémentaire',
  supplementalSecond: '2ème',
  supplementalNth: '{n}ème',
  totalDueToday: "Total à payer aujourd'hui (prorata Stripe)",
  newSubscriptionAnnual: 'Nouvel abonnement annuel',
  newSubscriptionMonthly: 'Nouvel abonnement mensuel',
  generating: 'Génération…',
  validateAndPay: 'Valider et payer',
  later: 'Plus tard',
  deleteConfirmTitle: 'Confirmer la suppression',
  deleteConfirmBody:
    'La suppression de «{name}» est définitive. Tapez {word} pour valider.',
  deleteConfirmFootnote:
    "Les avis et paramètres liés à cet emplacement add-on seront effacés. Le siège (profil) n'est pas concerné.",
  labelConfirmation: 'Confirmation',
  deleteForever: 'Supprimer définitivement',
  deleteTypeWord: 'supprimer',
  newEstablishmentDefaultName: 'Nouvel établissement',
  planBadgePrefix: 'Plan',
  perMonth: '/mois',
  perYear: '/an',
};

const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
if (!fr.Dashboard) fr.Dashboard = {};
if (!fr.Dashboard.establishments) fr.Dashboard.establishments = {};
Object.assign(fr.Dashboard.establishments, extra);
fs.writeFileSync(frPath, JSON.stringify(fr));
console.log('Merged', Object.keys(extra).length, 'keys into Dashboard.establishments in fr.json');
