/**
 * Fusionne Dashboard.bananoOmnipresent dans messages/{locale}.json
 * node scripts/merge-banano-omnipresent-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES = path.join(__dirname, '..', 'messages');

const bananoOmnipresent = {
  fr: {
    errInvalidResponse: 'Réponse invalide.',
    errLoadPilotage: 'Impossible de charger le pilotage.',
    errSendImpossible: 'Envoi impossible',
    errGeneric: 'Erreur',
    forecastUnavailable: 'Projection non disponible pour cette version.',
    toastWaSent: '{count, plural, one {WhatsApp : # message envoyé.} other {WhatsApp : # messages envoyés.}}',
    toastWaSkippedDesc:
      '{skipped, plural, one {# contact ignoré (relance il y a moins de 30 jours).} other {# contacts ignorés (relance il y a moins de 30 jours).}}',
    toastWaAllSkipped:
      'Aucun envoi : tous les contacts éligibles ont déjà reçu une relance récemment (30 j.).',
    toastWaFailed:
      'Échec envoi WhatsApp. Vérifiez la configuration Twilio et les numéros.',
    toastWaNoTargets: 'Aucun client à relancer avec les critères actuels.',
    title: 'Tableau de bord omniprésent',
    subtitle:
      "Chiffres et textes générés à partir de vos passages fidélité, montants saisis à la caisse, règles de relance « client perdu » et notes d'achat. Branchez catalogue / stocks pour enrichir les cartes produit.",
    lastUpdated: 'Dernière mise à jour : {date}',
    ariaStaffPerformance: 'Performances équipe',
    staffTitle: 'Performances équipe',
    monthLabel: 'Mois',
    yearLabel: 'Année',
    periodPrefix: 'Période : {label}',
    staffReputexaLine:
      'REPUTEXA vous montre quel employé est le plus efficace pour recruter des clients fidèles.',
    staffHelp:
      'Données par mois calendaire (à chaque nouveau mois, les compteurs repartent pour le mois en cours). Fiches créées sur la période, CA saisi sur les tickets à la caisse, avis Google 4–5★ reliés aux passages encaissés par équipier (estimation). Le rapport mensuel PDF reprend ces mêmes agrégats avec la rétention et l’analyse pilotage.',
    staffGoogleDisclaimer:
      "Les avis Google sont attribués quand le nom sur l'avis correspond à une fiche qui a eu au moins une visite créditée par l'équipier sur la période (heuristique).",
    loadingStaffStats: 'Chargement des stats équipe…',
    staffEmpty:
      'Ajoutez des équipiers dans l’onglet Paramètres pour activer le trombinoscope et ces indicateurs.',
    transformFormula: 'Taux de transformation = fiches créées ÷ tickets encaissés.',
    thStaffTransform: 'Équipier & taux transfo.',
    thTickets: 'Tickets',
    thFiches: 'Fiches',
    thCaTicket: 'CA ticket',
    thPanierAvg: 'Panier moy.',
    thAvisGoogle: 'Avis Google 4–5★',
    inactive: '(inactif)',
    srTransform: 'Taux transformation {pct} % (fiches sur tickets)',
    titleBarPct: '{pct} % — fiches / tickets',
    pagePrev: 'Précédent',
    pageNext: 'Suivant',
    staffPageInfo:
      'Page {current} / {total} — {n} {n, plural, one {équipier} other {équipiers}}',
    ariaActivityFeed: "Fil d'activité caisse",
    activityTitle: 'Historique traçabilité (patron)',
    activityHelp:
      'Chaque ligne indique l’équipier connecté au terminal : encaissements, créations de fiche, etc.',
    loading: 'Chargement…',
    noActivityLines: 'Aucune ligne récente.',
    activityNewer: 'Plus récent',
    activityOlder: 'Plus ancien',
    activityPageInfo:
      'Page {current} / {total} — {n} {n, plural, one {événement} other {événements}} au total',
    traceabilityCsvTitle: 'Archives traçabilité (CSV)',
    traceabilityCsvHelp:
      "Export mensuel calendaire (toutes les lignes du mois), comme pour le rapport IA : un fichier par mois, un clic pour télécharger. Pas encore de PDF automatique — le CSV reprend date, client, type d'événement et équipier.",
    archivePreviousMonth: 'Mois précédent',
    archiveLabel: 'Archive',
    downloadCsv: 'Télécharger CSV →',
    monthArchiveSelect: 'Mois (archive)',
    downloadThisMonth: 'Télécharger ce mois (CSV)',
    calculating: 'Calcul des indicateurs…',
    temporalTitle: 'Analyse temporelle',
    ariaPeriodTabs: "Période d'analyse",
    tabDay: 'Jour',
    tabDayHint: 'Le direct',
    tabWeek: 'Semaine',
    tabWeekHint: 'La tendance',
    tabMonth: 'Mois',
    tabMonthHint: 'La stratégie',
    insightLabel: 'Insight concret',
    cashDailyTitle: 'Caisse par jour',
    cashHistoryBtn: 'Historique & périodes',
    cashHelp:
      '{days} derniers jours calendaires : passages enregistrés à la caisse, CA cumulé (TTC saisi), panier moyen sur les tickets avec montant, total articles si vous renseignez le champ optionnel au terminal, et les libellés d’achat les plus repris (proxy « combien de chaque » tant qu’un catalogue produit n’est pas branché).',
    thDay: 'Jour',
    thPassages: 'Passages',
    thCa: 'CA',
    thPanier: 'Panier moy.',
    thArticles: 'Articles',
    thTopLabels: 'Top libellés (note caisse)',
    caissePageInfo: '{current} / {total} ({n} j.)',
    ariaRetention: 'Rétention et activité par jour',
    retentionTitle: 'Radar de rétention & rythme hebdo',
    retentionHelp:
      'Entonnoir sur le mois calendaire en cours (nouveaux clients, retours, VIP). À droite : intensité des encaissements sur les 7 derniers jours par jour de la semaine (vert = plus d’activité).',
    retentionMonthBox: 'Rétention (mois en cours)',
    newClients: 'Nouveaux clients',
    returnedTwice: 'Revenus ≥ 2 fois',
    vipProfiles: 'Fiches VIP (3+ passages)',
    clickRowDetail: 'Cliquez une ligne pour le détail et les graphiques.',
    heatWeekTitle: 'Activité par jour (7 derniers jours)',
    heatmapTooltip:
      '{day} : {count, plural, one {# passage} other {# passages}}',
    smartCardsTitle: 'Smart Cards',
    smartCardsHelp:
      'Signaux dérivés de vos données ; best-seller produit et stock dès connexion ERP / catalogue.',
    noTicketAmounts:
      'Aucun montant TTC en base pour l’instant : saisissez le ticket à la caisse pour activer le CA, le panier moyen et le comparatif VIP au chiffre.',
    relaunchWhatsapp: 'Relancer par WhatsApp',
    reportSectionTitle: 'Rapport de performance IA',
    reportHelp:
      'Génération automatique chaque 1er du mois vers 8h (planification cron serveur, souvent UTC — comme le rapport mensuel Elite). Le PDF porte sur le mois calendaire précédent et est ajouté ici sans action de votre part. Contenu : synthèse IA, chiffres (CA fidélité, recrutement, avis Google), analyse temporelle jour / semaine / mois (direct, tendance, stratégie) avec insights, puis les Smart Cards (champion, stock, VIP, risque, etc.). Le plus récent est à gauche ; un clic télécharge.',
    reportEmpty:
      'Aucun rapport archivé pour l’instant. Le premier PDF sera créé automatiquement au prochain passage du cron (1er du mois), ou contactez le support pour un export manuel si besoin urgent.',
    lastReport: 'Dernier rapport',
    downloadArrow: 'Télécharger →',
    voucherLoyaltyTitle: 'Archives bons fidélité (CSV)',
    voucherLoyaltyDesc:
      'Même principe que le rapport PDF ci-dessus : génération automatique le 1er du mois (8h UTC) pour le mois calendaire précédent. Fichier CSV téléchargeable ; détail aussi dans Base clients → Archive bons d’achat.',
    voucherStaffTitle: 'Archives bons collaborateurs (CSV)',
    voucherStaffDesc:
      'Export mensuel des bons solde € (même cron). Consulter aussi Base clients → Archive bons employés pour le tableau temps réel.',
    modalNewTitle: 'Nouveaux clients (mois en cours)',
    modalReturnedTitle: 'Clients ≥ 2 passages ce mois-ci',
    modalVipTitle: 'Fiches VIP (3+ passages au total)',
    close: 'Fermer',
    noNewMembersMonth: 'Aucune fiche nouvelle sur ce mois.',
    listReturnedCaption: 'Passages ce mois (liste paginée)',
    noClientCategoryMonth: 'Aucun client dans cette catégorie ce mois-ci.',
    listVipCaption: 'Passages cumulés (liste paginée)',
    noVipYet: 'Pas encore de fiche avec 3+ passages.',
    visitsCount: '{n} visites',
    partialDataError:
      'Une section du pilotage n’a pas pu s’afficher (donnée temporelle incomplète). Rechargez la page ou vérifiez la console ; si le problème persiste, contactez le support.',
    funnelCompareTitle: 'Entonnoir du mois (comparatif)',
    funnelNew: 'Nouveaux clients',
    funnelReturned: 'Revenus ≥ 2 fois',
    funnelVip: 'Fiches VIP (3+)',
    ariaReportsPdf: 'Rapports PDF performance IA',
  },
};

bananoOmnipresent.en = {
  errInvalidResponse: 'Invalid response.',
  errLoadPilotage: 'Could not load dashboard data.',
  errSendImpossible: 'Could not send',
  errGeneric: 'Error',
  forecastUnavailable: 'Forecast not available in this version.',
  toastWaSent: '{count, plural, one {WhatsApp: # message sent.} other {WhatsApp: # messages sent.}}',
  toastWaSkippedDesc:
    '{skipped, plural, one {# contact skipped (relaunch within last 30 days).} other {# contacts skipped (relaunch within last 30 days).}}',
  toastWaAllSkipped:
    'No sends: all eligible contacts already received a relaunch recently (30 days).',
  toastWaFailed: 'WhatsApp send failed. Check Twilio configuration and phone numbers.',
  toastWaNoTargets: 'No customers to relaunch with the current criteria.',
  title: 'Omnipresent dashboard',
  subtitle:
    'Figures and copy generated from your loyalty visits, amounts entered at checkout, lost-customer rules and purchase notes. Connect catalog / stock to enrich product cards.',
  lastUpdated: 'Last updated: {date}',
  ariaStaffPerformance: 'Team performance',
  staffTitle: 'Team performance',
  monthLabel: 'Month',
  yearLabel: 'Year',
  periodPrefix: 'Period: {label}',
  staffReputexaLine:
    'REPUTEXA shows which employee is most effective at recruiting loyal customers.',
  staffHelp:
    'Data per calendar month (each new month, counters reset for the current month). Profiles created in the period, revenue on checkout tickets, Google 4–5★ reviews tied to visits per staff member (estimate). The monthly PDF report uses the same aggregates with retention and piloting analysis.',
  staffGoogleDisclaimer:
    'Google reviews are attributed when the name on the review matches a profile that had at least one visit credited to that staff member in the period (heuristic).',
  loadingStaffStats: 'Loading team stats…',
  staffEmpty: 'Add staff in the Settings tab to enable the roster and these metrics.',
  transformFormula: 'Conversion rate = profiles created ÷ checkout tickets.',
  thStaffTransform: 'Staff & conversion',
  thTickets: 'Tickets',
  thFiches: 'Profiles',
  thCaTicket: 'Ticket revenue',
  thPanierAvg: 'Avg. basket',
  thAvisGoogle: 'Google 4–5★ reviews',
  inactive: '(inactive)',
  srTransform: 'Conversion rate {pct}% (profiles per tickets)',
  titleBarPct: '{pct}% — profiles / tickets',
  pagePrev: 'Previous',
  pageNext: 'Next',
  staffPageInfo: 'Page {current} / {total} — {n, plural, one {# staff member} other {# staff members}}',
  ariaActivityFeed: 'Checkout activity feed',
  activityTitle: 'Traceability history (owner)',
  activityHelp:
    'Each line shows the staff member on the terminal: checkouts, profile creation, etc.',
  loading: 'Loading…',
  noActivityLines: 'No recent lines.',
  activityNewer: 'Newer',
  activityOlder: 'Older',
  activityPageInfo:
    'Page {current} / {total} — {n, plural, one {# event} other {# events}} total',
  traceabilityCsvTitle: 'Traceability archives (CSV)',
  traceabilityCsvHelp:
    'Monthly calendar export (all lines for the month), like the AI report: one file per month, one click to download. No automatic PDF yet — CSV includes date, client, event type and staff.',
  archivePreviousMonth: 'Previous month',
  archiveLabel: 'Archive',
  downloadCsv: 'Download CSV →',
  monthArchiveSelect: 'Month (archive)',
  downloadThisMonth: 'Download this month (CSV)',
  calculating: 'Computing metrics…',
  temporalTitle: 'Time analysis',
  ariaPeriodTabs: 'Analysis period',
  tabDay: 'Day',
  tabDayHint: 'Live',
  tabWeek: 'Week',
  tabWeekHint: 'Trend',
  tabMonth: 'Month',
  tabMonthHint: 'Strategy',
  insightLabel: 'Concrete insight',
  cashDailyTitle: 'Checkout by day',
  cashHistoryBtn: 'History & ranges',
  cashHelp:
    'Last {days} calendar days: visits at checkout, cumulative revenue (incl. tax entered), average basket on tickets with amount, total items if you fill the optional field at the terminal, and most common purchase labels (proxy for “how many of each” until a product catalog is connected).',
  thDay: 'Day',
  thPassages: 'Visits',
  thCa: 'Revenue',
  thPanier: 'Avg. basket',
  thArticles: 'Items',
  thTopLabels: 'Top purchase labels (checkout note)',
  caissePageInfo: '{current} / {total} ({n} d.)',
  ariaRetention: 'Retention and daily activity',
  retentionTitle: 'Retention radar & weekly rhythm',
  retentionHelp:
    'Funnel for the current calendar month (new customers, returns, VIP). Right: checkout intensity over the last 7 days by weekday (green = more activity).',
  retentionMonthBox: 'Retention (current month)',
  newClients: 'New customers',
  returnedTwice: 'Returned ≥ 2 times',
  vipProfiles: 'VIP profiles (3+ visits)',
  clickRowDetail: 'Click a row for detail and charts.',
  heatWeekTitle: 'Activity by day (last 7 days)',
  heatmapTooltip: '{day}: {count, plural, one {# visit} other {# visits}}',
  smartCardsTitle: 'Smart Cards',
  smartCardsHelp: 'Signals from your data; bestseller and stock once ERP / catalog is connected.',
  noTicketAmounts:
    'No incl. tax amount in the database yet: enter the ticket at checkout to enable revenue, average basket and VIP comparison.',
  relaunchWhatsapp: 'Relaunch via WhatsApp',
  reportSectionTitle: 'AI performance report',
  reportHelp:
    'Automatic generation on the 1st of each month around 8:00 (server cron, often UTC — like the Elite monthly report). The PDF covers the previous calendar month and appears here without action. Content: AI summary, figures (loyalty revenue, recruitment, Google reviews), day / week / month analysis with insights, then Smart Cards (champion, stock, VIP, risk, etc.). Newest on the left; one click downloads.',
  reportEmpty:
    'No archived report yet. The first PDF will be created on the next cron run (1st of the month), or contact support for a manual export if urgent.',
  lastReport: 'Latest report',
  downloadArrow: 'Download →',
  voucherLoyaltyTitle: 'Loyalty voucher archives (CSV)',
  voucherLoyaltyDesc:
    'Same principle as the PDF report above: automatic generation on the 1st of the month (8:00 UTC) for the previous calendar month. CSV file; details also under Client base → Purchase voucher archive.',
  voucherStaffTitle: 'Staff voucher archives (CSV)',
  voucherStaffDesc:
    'Monthly export of balance € vouchers (same cron). Also see Client base → Staff vouchers for the live table.',
  modalNewTitle: 'New customers (current month)',
  modalReturnedTitle: 'Customers with ≥ 2 visits this month',
  modalVipTitle: 'VIP profiles (3+ visits total)',
  close: 'Close',
  noNewMembersMonth: 'No new profiles this month.',
  listReturnedCaption: 'Visits this month (paginated)',
  noClientCategoryMonth: 'No customers in this category this month.',
  listVipCaption: 'Cumulative visits (paginated)',
  noVipYet: 'No profile with 3+ visits yet.',
  visitsCount: '{n} visits',
  partialDataError:
    'A piloting section could not be displayed (incomplete time data). Reload the page or check the console; if it persists, contact support.',
  funnelCompareTitle: 'Month funnel (comparison)',
  funnelNew: 'New customers',
  funnelReturned: 'Returned ≥ 2 times',
  funnelVip: 'VIP profiles (3+)',
  ariaReportsPdf: 'AI performance PDF reports',
};

bananoOmnipresent.de = { ...bananoOmnipresent.en };
bananoOmnipresent.es = { ...bananoOmnipresent.en };
bananoOmnipresent.it = { ...bananoOmnipresent.en };
bananoOmnipresent.pt = { ...bananoOmnipresent.en };
bananoOmnipresent.ja = { ...bananoOmnipresent.en };
bananoOmnipresent.zh = { ...bananoOmnipresent.en };

for (const loc of ['fr', 'en', 'de', 'es', 'it', 'ja', 'pt', 'zh']) {
  const p = path.join(MESSAGES, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!j.Dashboard) j.Dashboard = {};
  j.Dashboard.bananoOmnipresent = bananoOmnipresent[loc];
  fs.writeFileSync(p, JSON.stringify(j));
  console.log('merged bananoOmnipresent', loc);
}
