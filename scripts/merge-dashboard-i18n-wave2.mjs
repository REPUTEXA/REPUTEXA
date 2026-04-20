/**
 * Vague 2 : clés FR pour neutraliser le texte en dur (dashboard + support + stats).
 * Exécuter : node scripts/merge-dashboard-i18n-wave2.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frPath = path.join(__dirname, '..', 'messages', 'fr.json');
const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
fr.Dashboard = fr.Dashboard || {};
fr.Statistics = fr.Statistics || {};

const STOPWORDS_LIST = [
  'les', 'des', 'the', 'and', 'very', 'not', 'vous', 'avec', 'pour', 'que', 'qui', 'sur', 'est', 'pas', 'mais', 'plus',
  'nous', 'tres', 'très', 'vraiment', 'peu', 'trop', 'bien', 'tresbien', 'super', 'tresbon', 'bon', 'tresbonne',
  'tresbons', 'tresbelle', 'tresagréable', 'tresagréables', 'tresgentil', 'tresgentille', 'tresgentils', 'tresgentilles',
  'trespropre', 'trespropres', 'trescorrect', 'trescorrecte', 'trescorrectes', 'tresrapide', 'tresrapides', 'tresbonnes',
  'tresbienveillant', 'tresbienveillante', 'tresbienveillants', 'tresbienveillantes', 'tresaccueillant', 'tresaccueillante',
  'tresaccueillants', 'tresaccueillantes',
];
fr.Statistics.stopwords = STOPWORDS_LIST.join(',');

fr.Dashboard.support = {
  ...(fr.Dashboard.support || {}),
  thinkingStepSearch: 'Analyse du compte…',
  thinkingStepVerify: 'Vérification en cours…',
  thinkingStepWrite: 'Rédaction de la réponse…',
  emptyChatSubtitle: "L'agent analyse votre compte dès le premier message.",
  greetingTitle: 'Bonjour, je suis votre Agent Expert REPUTEXA.',
  greetingSubtitle:
    "Décrivez votre problème — j'analyse votre compte en temps réel et interviens directement si nécessaire.",
  gravityTitle: 'Gravité dossier : {score}/100 (priorité admin)',
  modifiedPrefix: 'Modifié',
  renameTicketTitle: 'Renommer',
  sendMessageAria: 'Envoyer',
  agentLoading: "Chargement de l'agent…",
  sidebarExpertBadge: 'Agent Expert',
  sidebarSupportBrand: 'REPUTEXA Support',
  verdictArchiveTitle: 'Archiver le dossier',
  verdictArchiveConfirm: 'Archiver et mémoriser',
  fetchListError: 'Erreur',
  confirmRenameAria: 'Valider',
  cancelRenameAria: 'Annuler',
  bubbleAgentLabel: 'Agent REPUTEXA ·',
};

fr.Dashboard.supportVerdict = {
  defaultTitle: 'Verdict du dossier',
  defaultConfirm: 'Archiver et enregistrer',
  subtitle:
    'Ils alimentent la mémoire sémantique Nexus pour les futurs dossiers similaires.',
  problemLabel: 'Quel était le problème réel ?',
  problemPlaceholder: 'Ex. : Webhook Zenith expiré côté caisse après rotation de clé.',
  solutionLabel: 'Quelle a été la solution ?',
  solutionPlaceholder: 'Ex. : Réinitialisation du jeton + mise à jour du connecteur POS.',
  cancel: 'Annuler',
  closeAria: 'Fermer',
};

fr.Dashboard.updatesList = {
  toastSaved: 'Mise à jour enregistrée',
  toastDeleted: 'Communiqué supprimé',
  toastTitleContentRequired: 'Titre et contenu sont requis',
  toastSaveErr: "Erreur lors de l'enregistrement",
  toastDeleteErr: 'Erreur lors de la suppression',
  toastUploadErr: "Erreur lors de l'envoi",
  empty: 'Aucune mise à jour pour le moment. Les suggestions marquées « Terminé » apparaîtront ici.',
  deleteHeadline: 'Supprimer ce communiqué ?',
  deletePreviewLabel: 'Communiqué',
  deleteBody:
    'Cette action est définitive. Le communiqué ne sera plus visible dans la liste des mises à jour.',
  badgeManual: 'Communiqué',
  badgeSuggestion: 'Suggestion livrée',
};

fr.Dashboard.deleteModal = {
  cancel: 'Annuler',
  confirmDelete: 'Supprimer définitivement',
  closeAria: 'Fermer',
};

fr.Dashboard.weeklyInsight = {
  title: 'Historique des Analyses Hebdomadaires',
  intro:
    'Tous vos rapports hebdomadaires sont archivés ici. Chaque lundi à 8 h (UTC), vous recevez sur WhatsApp le récap de la semaine passée avec un lien vers cette page pour le détail.',
  introNote: 'Les semaines les plus récentes sont en tête de liste.',
  weekLabel: 'Semaine',
  showAllWeeks: 'Voir toutes les semaines',
  weekStarts: 'Semaine du lundi',
  loading: 'Chargement…',
  empty: 'Aucune archive pour ces critères.',
  rowTitle: 'Analyse stratégique — Semaine du',
  reviewsWord: 'avis',
  alertLevel: 'Indice de vigilance',
  detailedTitle: 'Analyse stratégique détaillée',
  topTitle: 'Le Top',
  watchTitle: 'À surveiller',
  watchFallback: 'Rien de critique.',
  adviceTitle: 'Conseil IA',
  paginationRange: 'Affichage {from}–{to} sur {total}',
  paginationPage: 'Page {page} / {totalPages}',
  prev: 'Précédent',
  next: 'Suivant',
};

fr.Dashboard.monthlyArchive = {
  title: 'Archive de vos PDF mensuels',
  intro:
    'Tous vos rapports mensuels générés sont conservés ici ; un clic sur « Télécharger » ouvre le PDF.',
  upgradeTeaser:
    'Pulse et Zénith ajoutent analyse de sentiment, tactiques et (Zénith) plan d’action avancé dans le PDF. Vos mois archivés apparaissent dans le tableau ci-dessous dès qu’un rapport est généré.',
  comparePlans: 'Comparer les offres',
  searchLabel: 'Recherche (mois, année…)',
  searchPlaceholder: 'Ex. mars 2026, 03/2026',
  loading: 'Chargement…',
  empty: 'Aucune archive pour ces critères.',
  colDate: 'Date',
  colDocument: 'Document',
  colAction: 'Action',
  download: 'Télécharger',
  pending: 'En cours',
  paginationRange: 'Affichage {from}–{to} sur {total}',
  paginationPage: 'Page {page} / {totalPages}',
  prev: 'Précédent',
  next: 'Suivant',
  reportPdfName: 'Rapport REPUTEXA — {period}.pdf',
};

fr.Dashboard.featureRelease = {
  toastSaveError: 'Enregistrement impossible. Réessayez dans un instant.',
  badgeNew: 'Nouveau',
  communiqueDate: 'Communiqué du {date}',
  linkAllUpdates: 'Toutes les mises à jour',
  ctaGotIt: 'C’est parti !',
};

fr.Dashboard.generateResponse = {
  defaultLabel: 'Générer une réponse IA',
  generating: 'Génération...',
  toastError: 'Erreur lors de la génération',
  errorGeneric: 'Erreur',
};

fr.Dashboard.stripePortal = {
  defaultChildren: 'Gérer mon abonnement et mes factures',
  redirecting: 'Redirection...',
  errorGeneric: 'Erreur',
  errorNoUrl: 'URL non reçue',
};

fr.Dashboard.subscriptionSuccess = {
  ariaLabel: 'Paiement validé',
  message: 'Paiement validé. Bienvenue chez Reputation AI 🚀',
};

fr.Dashboard.aiResponseModal = {
  errorGenerate: 'Erreur de génération',
  errorSend: "Erreur d'envoi",
  errorGeneric: 'Erreur',
  title: 'Choisir une réponse IA',
  closeAria: 'Fermer',
  loadingOptions: 'Génération des options...',
  noOptions: 'Aucune option disponible.',
  sending: 'Envoi...',
  sent: 'Envoyé',
};

fr.Dashboard.welcomeFlash = {
  ...(fr.Dashboard.welcomeFlash || {}),
  welcomeToast: 'Bienvenue ! Votre plan {planName} est activé. 🎉',
  planFallback: 'Vision',
};

fr.Dashboard.strategicConsultant = {
  quick1: 'Comment améliorer ma note ?',
  quick2: "Besoin d'un conseil équipe",
  quick3: 'Résumé du mois dernier',
  heading: 'Votre Consultant Stratégique 24/7',
  subheading: "Posez vos questions, l'IA analyse vos avis et rapports pour vous conseiller",
  connectionError: 'Erreur de connexion.',
  connectionFailed: 'Connexion impossible. Réessayez dans quelques instants.',
  emptyHint: 'Posez votre question ou cliquez sur une suggestion',
  thinking: 'Réflexion en cours…',
  placeholder: 'Ex : Quels thèmes reviennent le plus dans mes avis ?',
  sendCta: 'Poser la question',
};

fr.Dashboard.generateWithAi = {
  defaultLabel: "Générer avec l'IA",
};

fr.Dashboard.defiReputexa = {
  ...(fr.Dashboard.defiReputexa || {}),
  defaultCampaignTitle: 'Défi REPUTEXA',
};

fr.Dashboard.whatsappReviewMeta = {
  title: 'Avis WhatsApp — REPUTEXA',
  description:
    "Espace Zenith : sollicitation d'avis WhatsApp, fidélité, pilotage et base clients (terminal et intégrations).",
  appleTitle: 'Avis WhatsApp',
};

fr.Dashboard.whatsappReviewError = {
  title: 'Avis WhatsApp — erreur',
  fallbackMessage: 'Erreur inattendue. Réessayez ou rechargez la page.',
  retry: 'Réessayer',
};

fr.Dashboard.reviewsPage = {
  ...(fr.Dashboard.reviewsPage || {}),
  loadError: 'Impossible de charger les avis',
  errorGeneric: 'Erreur',
  toastPublished: 'Réponse publiée ✅',
  toastCancelled: 'Publication annulée',
  toastEdited: 'Réponse modifiée ✅',
  countdownPublished: 'Publié',
  countdownIn: 'dans {hours}h {minutes}min',
  countdownInMinutes: 'dans {minutes}min',
  placeholderResponse: 'Réponse...',
  displayLast24: 'Affichage des 24 derniers publiés.',
  tabAll: 'Tous',
  tabGoogle: 'Google',
  tabFacebook: 'Facebook',
  tabTrustpilot: 'Trustpilot',
};

fs.writeFileSync(frPath, JSON.stringify(fr));
console.log('OK: wave2 dashboard i18n merged into messages/fr.json');
