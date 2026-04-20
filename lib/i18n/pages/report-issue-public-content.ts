export type ReportIssueBugType = {
  id: string;
  iconKey: 'zap' | 'alertTriangle' | 'bug' | 'info';
  label: string;
  description: string;
};

export type ReportIssuePriority = {
  id: string;
  label: string;
  description: string;
  color: string;
};

export type ReportIssuePublicContent = {
  bugTypes: ReportIssueBugType[];
  priorities: ReportIssuePriority[];
  slaBannerStrong: string;
  slaBannerRest: string;
  labelIssueType: string;
  labelPriority: string;
  labelTitle: string;
  labelDescription: string;
  labelSteps: string;
  labelEmail: string;
  placeholderTitle: string;
  placeholderDescription: string;
  placeholderSteps: string;
  placeholderEmail: string;
  submitSending: string;
  submitIdle: string;
  footerNote: string;
  successTitle: string;
  successBodyBefore: string;
  successBodyAfter: string;
  successCriticalNote: string;
};

const FR: ReportIssuePublicContent = {
  bugTypes: [
    {
      id: 'ai-error',
      iconKey: 'zap',
      label: "Erreur d'analyse IA",
      description: 'Réponse incorrecte ou hors-contexte',
    },
    {
      id: 'sync-issue',
      iconKey: 'alertTriangle',
      label: 'Problème de synchronisation',
      description: 'Avis manquants ou en retard',
    },
    { id: 'ui-bug', iconKey: 'bug', label: "Bug d'interface", description: 'Affichage, navigation, formulaire' },
    {
      id: 'billing-issue',
      iconKey: 'info',
      label: 'Problème de facturation',
      description: 'Paiement, facture, abonnement',
    },
    { id: 'other', iconKey: 'info', label: 'Autre', description: 'Tout autre type de problème' },
  ],
  priorities: [
    {
      id: 'low',
      label: 'Faible',
      description: "N'impacte pas mon activité quotidienne",
      color: 'text-gray-400 border-gray-600',
    },
    {
      id: 'medium',
      label: 'Moyen',
      description: 'Gêne partielle, un contournement existe',
      color: 'text-amber-400 border-amber-600/40',
    },
    {
      id: 'high',
      label: 'Élevé',
      description: 'Bloque une fonctionnalité importante',
      color: 'text-orange-400 border-orange-600/40',
    },
    {
      id: 'critical',
      label: 'Critique',
      description: 'Perte de données ou interruption totale',
      color: 'text-red-400 border-red-600/40',
    },
  ],
  slaBannerStrong: 'Temps de réponse garanti :',
  slaBannerRest: ' 4h ouvrées pour les priorités critiques · 24h pour les autres niveaux.',
  labelIssueType: 'Type de problème',
  labelPriority: 'Niveau de priorité',
  labelTitle: 'Titre du problème',
  labelDescription: 'Description détaillée',
  labelSteps: 'Étapes pour reproduire le problème',
  labelEmail: 'Votre adresse email',
  placeholderTitle: "Ex: Les avis Google de l'établissement X ne se synchronisent plus",
  placeholderDescription: 'Décrivez le comportement observé et le comportement attendu...',
  placeholderSteps: "1. Aller sur le tableau de bord\n2. Cliquer sur Avis\n3. Observer l'erreur...",
  placeholderEmail: 'vous@exemple.com',
  submitSending: 'Envoi en cours...',
  submitIdle: 'Envoyer le rapport',
  footerNote:
    'Notre équipe support traite chaque rapport avec accusé de réception. Délai SLA : 4h ouvrées pour les incidents critiques.',
  successTitle: 'Rapport reçu !',
  successBodyBefore: 'Votre rapport a été transmis à notre équipe technique. Nous vous contacterons à ',
  successBodyAfter:
    " dans les 4 heures ouvrées pour vous tenir informé de l'avancement.",
  successCriticalNote:
    'Pour les incidents critiques en production, notre équipe support surveille votre dossier en priorité.',
};

const EN: ReportIssuePublicContent = {
  bugTypes: [
    {
      id: 'ai-error',
      iconKey: 'zap',
      label: 'AI analysis error',
      description: 'Incorrect or off-context reply',
    },
    {
      id: 'sync-issue',
      iconKey: 'alertTriangle',
      label: 'Sync issue',
      description: 'Missing or delayed reviews',
    },
    { id: 'ui-bug', iconKey: 'bug', label: 'UI bug', description: 'Layout, navigation, forms' },
    {
      id: 'billing-issue',
      iconKey: 'info',
      label: 'Billing issue',
      description: 'Payment, invoice, subscription',
    },
    { id: 'other', iconKey: 'info', label: 'Other', description: 'Anything else' },
  ],
  priorities: [
    {
      id: 'low',
      label: 'Low',
      description: 'No impact on day-to-day work',
      color: 'text-gray-400 border-gray-600',
    },
    {
      id: 'medium',
      label: 'Medium',
      description: 'Partial disruption; workaround exists',
      color: 'text-amber-400 border-amber-600/40',
    },
    {
      id: 'high',
      label: 'High',
      description: 'Blocks an important feature',
      color: 'text-orange-400 border-orange-600/40',
    },
    {
      id: 'critical',
      label: 'Critical',
      description: 'Data loss or full outage',
      color: 'text-red-400 border-red-600/40',
    },
  ],
  slaBannerStrong: 'Response-time commitment:',
  slaBannerRest: ' 4 business hours for critical priority · 24h for other levels.',
  labelIssueType: 'Issue type',
  labelPriority: 'Priority level',
  labelTitle: 'Short title',
  labelDescription: 'Detailed description',
  labelSteps: 'Steps to reproduce',
  labelEmail: 'Your email',
  placeholderTitle: 'E.g. Google reviews for location X no longer sync',
  placeholderDescription: 'What you observed vs what you expected…',
  placeholderSteps: '1. Open the dashboard\n2. Go to Reviews\n3. See the error…',
  placeholderEmail: 'you@example.com',
  submitSending: 'Sending…',
  submitIdle: 'Send report',
  footerNote:
    'Support acknowledges every report. SLA: 4 business hours for critical production incidents.',
  successTitle: 'Report received',
  successBodyBefore: 'Your report was sent to our engineering team. We will follow up at ',
  successBodyAfter: ' within 4 business hours with next steps.',
  successCriticalNote: 'For critical production issues, support prioritizes your ticket.',
};

export function getReportIssuePublicContent(locale: string): ReportIssuePublicContent {
  return locale === 'fr' ? FR : EN;
}
