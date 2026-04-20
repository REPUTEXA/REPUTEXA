/** Types partagés pilotage opérationnel (caisse, calendrier, mur d’activité). */

export type PilotageCashDeskMetrics = {
  fromIso: string;
  toExclusiveIso: string;
  walletRevenueCents: number;
  loyalWalletRevenueCents: number;
  casualWalletRevenueCents: number;
  walletVisitCount: number;
  visitsWithAmountCount: number;
  visitsWithStaffCount: number;
  avgBasketWalletCents: number | null;
  avgBasketLoyalMemberCents: number | null;
  avgBasketCasualMemberCents: number | null;
  loyalVisitEventCount: number;
  casualVisitEventCount: number;
  uniqueWalletMembersWithVisit: number;
};

export type PilotageCalendarCell = {
  dateKey: string;
  dayNum: number;
  visitCount: number;
  stampCount: number;
  revenueCents: number;
  isInMonth: boolean;
};

export type PilotageCalendarMonthBundle = {
  year: number;
  month: number;
  monthLabel: string;
  cells: PilotageCalendarCell[];
};

export type PilotageAutomationStatusSnapshot = {
  birthdayMessagesSentToday: number;
  pushAttributedRevenueMonthCents: number;
  pushSendsCountMonth: number;
  automationStatsMonthStart: string;
  relanceRulesEnabled: {
    lost_client: boolean;
    birthday: boolean;
    vip_of_month: boolean;
    new_client_welcome: boolean;
  };
  relanceSendsMonth: {
    lost_client: number;
    birthday: number;
    vip_of_month: number;
    new_client_welcome: number;
  };
};

export type PilotageAtRiskMember = {
  memberId: string;
  displayLabel: string;
  phoneE164: string | null;
  daysSinceVisit: number | null;
  lifetimeVisits: number;
  lastVisitAt: string | null;
};

export type PilotageFeedWallItem = {
  id: string;
  createdAt: string;
  eventType: string;
  memberId: string;
  memberLabel: string;
  amountCents: number | null;
  summaryLine: string;
};
