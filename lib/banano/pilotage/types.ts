import type { LoyaltyProgramKpiBundle } from '@/lib/banano/pilotage/loyalty-program-kpis';
import type {
  PilotageCashStaffRow,
  PilotageCashTerminalRow,
} from '@/lib/banano/pilotage/cash-ingest-aggregates';
import type {
  PilotageAtRiskMember,
  PilotageAutomationStatusSnapshot,
  PilotageCalendarMonthBundle,
  PilotageCashDeskMetrics,
  PilotageFeedWallItem,
} from '@/lib/banano/pilotage/operational-types';

export type { LoyaltyProgramKpiBundle } from '@/lib/banano/pilotage/loyalty-program-kpis';

export type TemporalViewKey = 'day' | 'week' | 'month';

export type OmnipresentKpiBlock = {
  headline: string;
  subline: string;
  insight: string;
  /** Pour la vue Jour uniquement (objectif CA ou passages). */
  progressPercent: number | null;
};

/** Contact pour la carte VIP (WhatsApp, même logique que la base clients). */
export type VipSmartCardContact = {
  memberId: string;
  phoneE164: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  spendCents: number;
  visitsInPeriod: number;
  basis: 'spend' | 'visits';
};

export type SmartCardItem = {
  id: string;
  emoji: string;
  title: string;
  body: string;
  ctaLabel?: string;
  href?: string;
  /** Affiche le bouton d'envoi WhatsApp (carte Risque, clients à relancer). */
  whatsappRelaunch?: boolean;
  /** Présent si id === 'vip' et client identifiable. */
  vipContact?: VipSmartCardContact;
};

/** Suivi objectif CA mois en cours (mode « jeu du business »). */
export type PilotageMonthlyFinancial = {
  goalCents: number;
  revenueCents: number;
  progressPercent: number;
  daysLeft: number;
  coachLine: string;
  warCouncilLine: string;
  /** Projection linéaire fin de mois + objectif (sans IA). */
  forecastLine: string;
};

export type PilotageReportListItem = {
  year: number;
  month: number;
  /** Libellé affiché (ex. mars 2026) */
  labelFr: string;
  aiBadge: string;
  aiHeadline: string;
  createdAt: string;
};

/** Nombre de jours affichés : série journalière pilotage + PDF. */
export const PILOTAGE_DAILY_ACTIVITY_DAYS = 14;

export type PilotageDailyActivityRow = {
  dateKey: string;
  labelFr: string;
  visitCount: number;
  revenueCents: number;
  ticketsWithAmount: number;
  avgBasketCents: number | null;
  itemsSold: number | null;
  topLabels: { text: string; count: number }[];
};

/** Agrégat hebdomadaire (lundis) pour l’explorateur pilotage. */
export type PilotageWeekSummaryRow = {
  weekKey: string;
  labelFr: string;
  visitCount: number;
  revenueCents: number;
  ticketsWithAmount: number;
  avgBasketCents: number | null;
  itemsSold: number | null;
  topLabels: { text: string; count: number }[];
};

/** Cœur du tableau (séries + cartes). */
export type PilotageCorePayload = {
  temporal: Record<TemporalViewKey, OmnipresentKpiBlock>;
  smartCards: SmartCardItem[];
  generatedAt: string;
  /** Au moins un ticket avec montant saisi (historique récent). */
  hasTicketAmounts: boolean;
  /** 14 derniers jours (jour le plus récent en premier). */
  dailyActivity: PilotageDailyActivityRow[];
};

export type RetentionFunnelSnapshot = {
  newClientsThisMonth: number;
  returnedAtLeastTwiceThisMonth: number;
  vipProfilesCount: number;
};

export type RetentionFunnelDetail = {
  newMembers: { id: string; label: string }[];
  returnedTwice: { id: string; label: string; visitsInMonth: number }[];
  vipProfiles: { id: string; label: string; lifetimeVisits: number }[];
};

export type WeekdayHeatCell = {
  /** 0 = lundi … 6 = dimanche */
  dow: number;
  count: number;
};

/** Rentabilité fidélité (mois civil en cours) pour le hero commercial. */
export type PilotageLoyaltyProfitabilityMonth = {
  revenueGrossCents: number;
  fixedVoucherRedemptionCents: number;
  revenueNetCents: number;
  newMembersCount: number;
  signupVouchersIssued: number;
  signupIssuedFixedEuroCents: number;
  revenueToFixedRedemptionRatio: number | null;
};

/** Réponse complète GET /api/banano/pilotage. */
export type PilotageDashboardPayload = PilotageCorePayload & {
  /** null si aucun objectif mensuel défini */
  monthlyFinancial: PilotageMonthlyFinancial | null;
  reports: PilotageReportListItem[];
  retentionFunnel: RetentionFunnelSnapshot;
  /** Listes pour le détail (clic entonnoir). */
  retentionFunnelDetail: RetentionFunnelDetail;
  /** Activité caisse sur les 7 derniers jours, par jour de la semaine (lundi → dimanche). */
  weekdayHeat: WeekdayHeatCell[];
  /** Points / tampons / bons sur jour glissant, semaine ISO et mois calendaire en cours. */
  loyaltyProgramKpis: LoyaltyProgramKpiBundle;
  loyaltyProfitabilityMonth: PilotageLoyaltyProfitabilityMonth | null;
  merchantTimeZone: string;
  cashDeskMetrics: PilotageCashDeskMetrics;
  calendarMonth: PilotageCalendarMonthBundle;
  automationStatus: PilotageAutomationStatusSnapshot;
  feedWall: PilotageFeedWallItem[];
  atRiskMembers: PilotageAtRiskMember[];
  merchantEstablishmentName: string;
  viewerUserId: string;
  /** Somme des montants caisse ingérés (agent sync, etc.), mois calendaire en cours, en centimes. */
  total_cash_ingested_month: number;
  /** Tickets caisse du mois (ticket_at), ventilés par terminal_id. */
  cash_terminal_month: PilotageCashTerminalRow[];
  /** Performance équipiers (staff_name) sur les tickets sync du mois. */
  cash_staff_month: PilotageCashStaffRow[];
};
