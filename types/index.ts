/**
 * Types TypeScript centralisés pour REPUTEXA.
 *
 * Ce fichier re-exporte tous les types partagés depuis leurs modules sources.
 * Importer depuis '@/types' plutôt que de dupliquer les interfaces.
 *
 * Structure :
 *   @/types           → Ce fichier (barrel export)
 *   @/lib/feature-gate → PlanSlug, FeatureKey, FEATURES
 *   @/lib/webhooks/*  → Types e-commerce, consentement, scheduling
 *   @/lib/whatsapp-alerts/types → StandardReview, ReviewPlatform, etc.
 *   @/lib/monthly-reports/types → MonthlyReportRow, ReportType, etc.
 */

// ── Plans & Feature Gate ────────────────────────────────────────────────────
export type { PlanSlug, FeatureKey } from '@/lib/feature-gate';
export { FEATURES, PLAN_DISPLAY } from '@/lib/feature-gate';

// ── E-commerce & Webhooks ───────────────────────────────────────────────────
export type {
  EcommerceDeliveryStrategy,
  ParsedShipmentStatus,
  ConsentParse,
} from '@/lib/webhooks/ecommerce-ingest';

// ── WhatsApp & Reviews ──────────────────────────────────────────────────────
export type {
  ReviewPlatform,
  StandardReview,
  GoogleReviewWebhookPayload,
  WhatsAppAlertPayload,
  WhatsAppCallbackPayload,
  CallbackAction,
} from '@/lib/whatsapp-alerts/types';
export { CALLBACK_ACTIONS } from '@/lib/whatsapp-alerts/types';

// ── Monthly Reports ─────────────────────────────────────────────────────────
export type {
  ReportType,
  MonthlyStats,
  ReviewForReport,
  VisionInsights,
  PulseInsights,
  ZenithInsights,
  SummaryStats,
  MonthlyReportRow,
} from '@/lib/monthly-reports/types';

// ── API Response helpers ────────────────────────────────────────────────────

/** Structure de réponse JSON succès standard. */
export type ApiSuccess<T = Record<string, unknown>> = {
  ok: true;
} & T;

/** Structure de réponse JSON erreur standard. */
export type ApiError = {
  error: string;
  code?: string;
};

/** Union discriminée pour les réponses API. */
export type ApiResponse<T = Record<string, unknown>> = ApiSuccess<T> | ApiError;

// ── Queue & Scheduling ──────────────────────────────────────────────────────

export type ReviewQueueStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

export type ReviewQueueMetadata = {
  caller_ip: string;
  raw_phone: string;
  source_info: string | null;
  last_purchase: string | null;
  received_at: string;
  target_minutes: number;
  final_minutes: number;
  ingress: 'api_key' | 'zenith' | 'manual';
  zenith_message_type: 'review';
  shipment_status?: string;
  tracking_number?: string | null;
  ecommerce_post_delivery?: boolean;
  ecommerce_hybrid_test?: boolean;
};

// ── Auth ────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'user';

export type ProfileRow = {
  id: string;
  email: string | null;
  subscription_plan: string | null;
  selected_plan: string | null;
  business_category: string | null;
  webhook_send_delay_minutes: number | null;
  ecommerce_delivery_strategy: string | null;
  ecommerce_post_delivery_custom_minutes: number | null;
  legal_compliance_accepted: boolean | null;
  legal_compliance_accepted_at?: string | null;
  legal_compliance_accepted_legal_version?: number | null;
  establishment_name: string | null;
  api_key: string | null;
  webhook_token: string | null;
};
