export type ServiceStatus = 'operational' | 'degraded' | 'outage';

export type StatutsService = {
  id: string;
  name: string;
  description: string;
  status: ServiceStatus;
  uptime: string;
};

export type StatutsIncident = {
  date: string;
  title: string;
  severity: string;
  duration: string;
  resolution: string;
};

export type StatutsPublicContent = {
  services: StatutsService[];
  metrics: { label: string; value: string }[];
  metricsPeriod: string;
  incidents: StatutsIncident[];
  statusLabels: Record<ServiceStatus, string>;
  severityMinor: string;
  bannerAllOk: string;
  bannerDegraded: string;
  lastCheckPrefix: string;
  refresh: string;
  sectionComponents: string;
  sectionUptime: string;
  sectionIncidents: string;
  legendOperational: string;
  legendMinor: string;
  emptyIncidents: string;
  durationPrefix: string;
};

/** Day index (0..89) where synthetic demo incidents appear; keys are service `id`. */
export const STATUTS_HEATMAP_INCIDENT_DAYS: Record<string, number> = {
  ai_generation: 78,
  google_sync: 61,
};

const FR: StatutsPublicContent = {
  services: [
    {
      id: 'web',
      name: 'Application Web',
      description: 'Interface dashboard et pages publiques (Vercel)',
      status: 'operational',
      uptime: '99.98%',
    },
    {
      id: 'database',
      name: 'Base de données',
      description: 'Supabase PostgreSQL — données clients et avis',
      status: 'operational',
      uptime: '99.99%',
    },
    {
      id: 'ai_generation',
      name: 'IA — Génération de réponses',
      description: "Claude 3.5 Sonnet (principal) + GPT-4o-mini (fallback)",
      status: 'operational',
      uptime: '99.94%',
    },
    {
      id: 'shield',
      name: 'Shield Center',
      description: "Analyse de toxicité et score d'authenticité",
      status: 'operational',
      uptime: '99.99%',
    },
    {
      id: 'google_sync',
      name: 'Synchronisation Google Business',
      description: 'Import des avis Google via OAuth business.manage',
      status: 'operational',
      uptime: '99.91%',
    },
    {
      id: 'trustpilot',
      name: 'Synchronisation Trustpilot',
      description: 'Import et synchronisation des avis Trustpilot',
      status: 'operational',
      uptime: '99.87%',
    },
    {
      id: 'facebook',
      name: 'Synchronisation Facebook',
      description: 'Import et synchronisation des avis Facebook',
      status: 'operational',
      uptime: '99.85%',
    },
    {
      id: 'whatsapp',
      name: 'Alertes WhatsApp',
      description: 'Notifications Twilio — alertes et boutons interactifs',
      status: 'operational',
      uptime: '99.93%',
    },
    {
      id: 'ai_capture',
      name: 'AI Capture (Zenith)',
      description: 'Messages WhatsApp post-visite via webhook POS/Zapier',
      status: 'operational',
      uptime: '99.96%',
    },
    {
      id: 'email',
      name: 'Emails transactionnels',
      description: 'Resend — confirmations, alertes, rapports PDF',
      status: 'operational',
      uptime: '99.99%',
    },
    {
      id: 'stripe',
      name: 'Paiements Stripe',
      description: 'Abonnements, facturation et portail client',
      status: 'operational',
      uptime: '99.99%',
    },
  ],
  metrics: [
    { label: 'Disponibilité globale', value: '99,96%' },
    { label: 'Temps de réponse API médian', value: '142ms' },
    { label: 'Temps de réponse API p95', value: '380ms' },
    { label: 'Incidents résolus', value: '3' },
  ],
  metricsPeriod: '90 derniers jours',
  incidents: [
    {
      date: '12 mars 2026',
      title: 'Latence accrue sur la génération de réponses IA',
      severity: 'minor',
      duration: '23 min',
      resolution:
        "Résolu — Pic de charge sur l'API Anthropic. Mise en place d'un circuit breaker automatique. Aucune perte de données.",
    },
    {
      date: '28 février 2026',
      title: 'Délai sur la synchronisation Google (certains comptes)',
      severity: 'minor',
      duration: '41 min',
      resolution:
        "Résolu — Quota API Google atteint sur une clé de rotation. Migration automatique vers la clé de secours. Impact limité à 8% des comptes.",
    },
    {
      date: '9 janvier 2026',
      title: 'Interruption brève des webhooks temps réel',
      severity: 'minor',
      duration: '18 min',
      resolution:
        "Résolu — Déploiement d'une mise à jour qui a provoqué un redémarrage du worker webhooks. Tous les événements ont été rejouables depuis la file d'attente.",
    },
  ],
  statusLabels: {
    operational: 'Opérationnel',
    degraded: 'Dégradé',
    outage: 'Interruption',
  },
  severityMinor: 'Mineur',
  bannerAllOk: 'Tous les systèmes sont opérationnels',
  bannerDegraded: 'Certains systèmes connaissent des perturbations',
  lastCheckPrefix: 'Dernière vérification :',
  refresh: 'Actualiser',
  sectionComponents: 'État des composants',
  sectionUptime: 'Historique de disponibilité — 90 jours',
  sectionIncidents: 'Historique des incidents',
  legendOperational: 'Opérationnel',
  legendMinor: 'Incident mineur',
  emptyIncidents: 'Aucun incident au cours des 90 derniers jours.',
  durationPrefix: 'Durée :',
};

const EN: StatutsPublicContent = {
  services: [
    {
      id: 'web',
      name: 'Web application',
      description: 'Dashboard UI and public pages (Vercel)',
      status: 'operational',
      uptime: '99.98%',
    },
    {
      id: 'database',
      name: 'Database',
      description: 'Supabase PostgreSQL — customer and review data',
      status: 'operational',
      uptime: '99.99%',
    },
    {
      id: 'ai_generation',
      name: 'AI — Reply generation',
      description: 'Claude 3.5 Sonnet (primary) + GPT-4o-mini (fallback)',
      status: 'operational',
      uptime: '99.94%',
    },
    {
      id: 'shield',
      name: 'Shield Center',
      description: 'Toxicity analysis and authenticity score',
      status: 'operational',
      uptime: '99.99%',
    },
    {
      id: 'google_sync',
      name: 'Google Business sync',
      description: 'Google review import via OAuth business.manage',
      status: 'operational',
      uptime: '99.91%',
    },
    {
      id: 'trustpilot',
      name: 'Trustpilot sync',
      description: 'Trustpilot review import and sync',
      status: 'operational',
      uptime: '99.87%',
    },
    {
      id: 'facebook',
      name: 'Facebook sync',
      description: 'Facebook review import and sync',
      status: 'operational',
      uptime: '99.85%',
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp alerts',
      description: 'Twilio notifications — alerts and interactive buttons',
      status: 'operational',
      uptime: '99.93%',
    },
    {
      id: 'ai_capture',
      name: 'AI Capture (Zenith)',
      description: 'Post-visit WhatsApp via POS/Zapier webhook',
      status: 'operational',
      uptime: '99.96%',
    },
    {
      id: 'email',
      name: 'Transactional email',
      description: 'Resend — confirmations, alerts, PDF reports',
      status: 'operational',
      uptime: '99.99%',
    },
    {
      id: 'stripe',
      name: 'Stripe payments',
      description: 'Subscriptions, billing, and customer portal',
      status: 'operational',
      uptime: '99.99%',
    },
  ],
  metrics: [
    { label: 'Overall availability', value: '99.96%' },
    { label: 'Median API latency', value: '142ms' },
    { label: 'API latency p95', value: '380ms' },
    { label: 'Incidents resolved', value: '3' },
  ],
  metricsPeriod: 'Last 90 days',
  incidents: [
    {
      date: 'Mar 12, 2026',
      title: 'Elevated latency on AI reply generation',
      severity: 'minor',
      duration: '23 min',
      resolution:
        'Resolved — Anthropic API load spike. Automatic circuit breaker enabled. No data loss.',
    },
    {
      date: 'Feb 28, 2026',
      title: 'Delayed Google sync (some accounts)',
      severity: 'minor',
      duration: '41 min',
      resolution:
        'Resolved — Google API quota hit on a rotation key. Automatic failover to backup key. ~8% of accounts affected.',
    },
    {
      date: 'Jan 9, 2026',
      title: 'Brief real-time webhook interruption',
      severity: 'minor',
      duration: '18 min',
      resolution:
        'Resolved — Deployment restart of webhook workers. All events were replayed from the queue.',
    },
  ],
  statusLabels: {
    operational: 'Operational',
    degraded: 'Degraded',
    outage: 'Outage',
  },
  severityMinor: 'Minor',
  bannerAllOk: 'All systems operational',
  bannerDegraded: 'Some systems are experiencing issues',
  lastCheckPrefix: 'Last checked:',
  refresh: 'Refresh',
  sectionComponents: 'Component status',
  sectionUptime: 'Availability history — 90 days',
  sectionIncidents: 'Incident history',
  legendOperational: 'Operational',
  legendMinor: 'Minor incident',
  emptyIncidents: 'No incidents in the last 90 days.',
  durationPrefix: 'Duration:',
};

export function getStatutsPublicContent(locale: string): StatutsPublicContent {
  return locale === 'fr' ? FR : EN;
}

export function statutsHeatmapCellTitle(locale: string, dayIndex: number, hasIncident: boolean): string {
  const n = 90 - dayIndex;
  if (locale === 'fr') {
    return `Jour ${n} : ${hasIncident ? 'Incident mineur' : 'Opérationnel'}`;
  }
  return `Day ${n}: ${hasIncident ? 'Minor incident' : 'Operational'}`;
}
