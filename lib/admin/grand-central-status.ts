import { parseGrandCentralAllowedIps } from '@/lib/admin/grand-central-ip';

/** Réponse API / UI Audit 360° — aucun secret. */
export type GrandCentralStatusPayload = {
  ipFilterActive: boolean;
  browserBindActive: boolean;
  gatewayReady: boolean;
};

export type GrandCentralHardeningSummary = {
  ipWallActive: boolean;
  ipRuleCount: number;
  sessionBindActive: boolean;
  alertsActive: boolean;
  anyActive: boolean;
};

/** Résumé côté serveur (aucun secret ni IP exposés). */
export function getGrandCentralHardeningSummary(): GrandCentralHardeningSummary {
  const ipList = parseGrandCentralAllowedIps();
  const ipWallActive = ipList.length > 0;
  const sessionBindActive = Boolean(process.env.GRAND_CENTRAL_BIND_SECRET?.trim());
  const alertsActive = Boolean(process.env.GRAND_CENTRAL_ALERT_SECRET?.trim());
  const anyActive = ipWallActive || sessionBindActive || alertsActive;
  return {
    ipWallActive,
    ipRuleCount: ipList.length,
    sessionBindActive,
    alertsActive,
    anyActive,
  };
}
