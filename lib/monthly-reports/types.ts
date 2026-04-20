/**
 * Types pour le système de rapports mensuels REPUTEXA.
 */

export type ReportType = 'VISION' | 'PULSE' | 'ZENITH';

export type MonthlyStats = {
  averageRating: number;
  totalReviews: number;
  positiveCount: number;
  negativeCount: number;
  platforms: { name: string; count: number }[];
  monthLabel: string;
  establishmentName: string;
};

export type ReviewForReport = {
  rating: number;
  comment: string;
  source: string;
  createdAt: string;
};

/** Insights IA — structure par plan */
export type VisionInsights = {
  kpis: string[];
  strength: string;
  opportunity: string;
};

export type PulseInsights = VisionInsights & {
  sentiment: {
    love: string[];
    hate: string[];
  };
  tactics: string[];
  /** Audit interne / sentiment prédictif chiffré (ex. « N avis évoquent X en 30 jours ») — Pulse & Zenith */
  predictive?: string;
};

export type ZenithInsights = PulseInsights & {
  predictive: string;
  benchmark: string;
  actionPlan: string[];
  /** Conseils stratégiques pour le mois suivant — ton consultant de luxe */
  nextMonthAdvice?: string;
};

export type SummaryStats = VisionInsights | PulseInsights | ZenithInsights;

export type MonthlyReportRow = {
  id: string;
  user_id: string;
  month: number;
  year: number;
  report_type: ReportType;
  pdf_url: string | null;
  summary_stats: SummaryStats;
  created_at: string;
};
