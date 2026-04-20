/**
 * Historique : des blocs admin UI avaient été ajoutés sous Dashboard.* alors que le code
 * résout Admin.* (useTranslations / createTranslator). Déplace ces clés vers Admin pour
 * toutes les locales messages/*.json.
 *
 * Usage : npx tsx scripts/move-admin-ui-namespaces-dashboard-to-admin.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { SITE_LOCALE_CODES } from '../lib/i18n/site-locales-catalog';

const KEYS = [
  'legalWorkspace',
  'saasPulse',
  'statsCards',
  'securityHubCard',
  'perfProbeStrip',
  'babelExpansionClient',
  'investorDashboardRoadmap',
  'investorSubscriberDirectory',
  'investorCopilotBar',
] as const;

const root = process.cwd();

for (const locale of SITE_LOCALE_CODES) {
  const filePath = path.join(root, 'messages', `${locale}.json`);
  const data = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  const dash = data.Dashboard as Record<string, unknown> | undefined;
  if (!dash) throw new Error(`${locale}: missing Dashboard`);

  const admin = { ...(data.Admin as Record<string, unknown>) };

  for (const key of KEYS) {
    if (dash[key] === undefined) {
      throw new Error(`${locale}: Dashboard.${key} missing — abort`);
    }
    if (admin[key] !== undefined) {
      throw new Error(`${locale}: Admin.${key} already exists — resolve conflict manually`);
    }
    admin[key] = dash[key];
    delete dash[key];
  }

  data.Admin = admin;
  data.Dashboard = dash;
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`[move-admin-ns] ${locale}.json OK`);
}
