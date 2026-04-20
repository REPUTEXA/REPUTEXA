/**
 * Ajoute Dashboard.shell + Dashboard.adminUpdatesForm dans messages/fr.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frPath = path.join(__dirname, '..', 'messages', 'fr.json');
const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
fr.Dashboard = fr.Dashboard || {};

fr.Dashboard.shell = {
  ...(fr.Dashboard.shell || {}),
  defaultEstablishment: 'Mon établissement',
  stripeLoadFailed: "Impossible de charger l'abonnement.",
  retry: 'Réessayer',
  loading: 'Chargement…',
  openMenu: 'Ouvrir le menu',
  searchPlaceholder: 'Rechercher des avis...',
  notificationsAria: 'Notifications',
  toxicTitle: 'Action requise : avis toxique détecté',
  toxicOne: '1 avis est en attente dans le Bouclier IA.',
  toxicMany: '{count} avis sont en attente dans le Bouclier IA.',
  trendAlert: 'Alerte de tendance',
  trendFallback: 'Signal à surveiller.',
  trendsDetected: 'Tendances détectées',
  trendsNone: 'Aucune tendance négative marquante sur vos derniers avis.',
  seeWeeklyAnalysis: "Voir l'analyse détaillée",
  adminPanel: 'Admin Panel',
  signOut: 'Déconnexion',
  closeMenu: 'Fermer le menu',
};

fr.Dashboard.adminUpdatesForm = {
  toastMediaError: "Erreur lors de l'envoi du média",
  toastSublimeOk: "Contenu sublimé par l'IA !",
  toastSublimeError: 'Erreur lors de la génération IA',
  toastTitleOrNotes: 'Renseignez au moins un titre ou des notes brutes',
  toastTitleRequired: 'Le titre est requis',
  toastContentRequired: 'Le contenu est requis — utilisez « Sublimer par l\'IA » ou rédigez manuellement',
  toastSchedulePick: 'Choisissez une date et une heure de publication.',
  toastScheduleInvalid: 'Date ou heure invalide.',
  toastScheduledFor: 'Mise à jour programmée pour {when} (fuseau du navigateur).',
  toastPublished: 'Mise à jour publiée !',
  heading: 'Créer une mise à jour manuelle',
  fieldTitle: 'Titre de la mise à jour',
  titlePlaceholder: 'Ex : Nouvelle fonctionnalité de rapport hebdomadaire…',
  rawNotesPlaceholder:
    "Notez vos idées brutes, bullet points, détails techniques… L'IA les transformera en changelog élégant.",
  aiHint:
    'Le serveur croise votre titre et vos notes avec un extrait du dépôt (commits récents, fichiers modifiés, CHANGELOG) pour des formulations plus précises — sans remplacer votre relecture.',
  labelSublimed: 'Sublimé',
  contentPlaceholder: "Le contenu sublimé apparaîtra ici — vous pouvez l'éditer avant de publier.",
  charCount: '{count} caractères',
  mediaHeading: 'Images ou vidéos',
  mediaHint: 'Fichiers image ou vidéo — usage admin uniquement.',
  addMedia: 'Ajouter des médias',
  addMediaUploading: 'Envoi…',
  video: 'Vidéo',
  removeMediaAria: 'Retirer le média',
  scheduleHelp:
    'Par défaut, le communiqué est visible tout de suite pour les utilisateurs connectés. En mode planifié, la date/heure saisie est interprétée dans le fuseau du navigateur (convertie en UTC côté serveur). Bornes : au moins ~30 s dans le futur, max. ~12 mois — comme la diffusion e-mail planifiée, sans lien avec le préavis légal 30 jours.',
  publishNow: 'Publication immédiate',
  publishScheduled: 'Programmer pour plus tard',
  ctaSchedule: 'Programmer la mise à jour',
  ctaPublish: 'Publier la mise à jour',
  subtitle: 'Visible uniquement par vous · Sublimation IA disponible',
  adminBadge: 'Admin',
  fieldRawNotes: 'Notes brutes',
  optional: '(optionnel)',
  sublimeRunning: 'Sublimation en cours…',
  sublimeCta: "Sublimer par l'IA",
  contentLabel: 'Contenu final du changelog',
  filesCount: '{count} fichier(s)',
  scheduleTitle: 'Calendrier de publication',
  scheduleRadioLater: 'Planifier date & heure',
  publishSending: 'Envoi…',
  toastPublishError: 'Erreur lors de la publication',
  scheduleHelpHtml:
    'Par défaut, le communiqué est visible tout de suite pour les utilisateurs connectés. En mode planifié, l’heure choisie suit le <strong class=\"text-slate-600 dark:text-zinc-400\">fuseau de ce navigateur</strong> (convertie en UTC côté serveur). Bornes : au moins ~30&nbsp;s dans le futur, max. ~12 mois — comme la diffusion e-mail planifiée, sans lien avec le préavis légal 30 jours.',
};

fr.Dashboard.upgradeGate = {
  title: 'Fonctionnalité réservée',
  bodyPrefix: 'Cette fonctionnalité est réservée aux membres ',
  bodySuffix: '. Voulez-vous booster votre visibilité ?',
  later: 'Plus tard',
  upgradeCta: 'Passer au plan {planName}',
};

fr.Dashboard.upgradeSuccessToast = {
  message: 'Félicitations ! Votre passage au plan {planName} est validé. 🚀',
  planFallback: 'votre plan supérieur',
};

fr.Statistics = { ...(fr.Statistics || {}), insightsInsufficient: "Pas assez d'avis sur cette période pour une analyse précise." };

fr.Dashboard.overview = {
  ...(fr.Dashboard.overview || {}),
  aiAlertLead: "L'IA a détecté",
  aiAlertNegativeReviews:
    '{count, plural, one {# avis négatif} other {# avis négatifs}}',
  aiAlertOnPeriod: 'sur la période affichée',
  aiAlertSubtext:
    'Des réponses personnalisées ont été préparées et sont prêtes à envoyer.',
  aiAlertCta: 'Voir les réponses →',
  cardAvgRating: 'Note moyenne',
  statsDeltaVsPrevious: '{value}% vs période précédente',
  avgRatingGoal: 'Objectif : maintenir > 4.5',
  totalReviewsLabel: 'Avis ce mois',
  positiveReviewsLabel: 'Avis positifs (4★ et 5★)',
  totalOnPeriod: 'Total sur la période affichée',
  negativeReviewsLabel: 'Avis négatifs (1★ à 3★)',
  platformSectionTitle: 'Avis par plateforme',
  distributionTotal: 'Répartition totale',
};

fr.Dashboard.establishmentSelector = {
  ...(fr.Dashboard.establishmentSelector || {}),
  selectAria: "Sélectionner l'établissement",
  myAccount: 'Mon compte',
  addEstablishment: 'Ajouter un établissement',
  principal: 'Principal',
};

fr.Dashboard.planBadge = {
  ...(fr.Dashboard.planBadge || {}),
  trialWithDays:
    'Essai {planName} — {days, plural, one {# jour restant} other {# jours restants}}',
  trialSimple: 'Essai {planName}',
  futureScheduled: '✨ Passage sur {plan} programmé',
  ctaChangePlan: 'Changer de plan',
  ctaUpgrade: 'Passer au niveau supérieur',
  toastPortalOpenFailed: "Impossible d'ouvrir le portail de facturation.",
  toastGenericError: 'Erreur',
};

fs.writeFileSync(frPath, JSON.stringify(fr));
console.log('OK: Dashboard i18n keys merged into fr.json');
