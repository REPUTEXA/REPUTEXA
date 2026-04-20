/**
 * Dashboard.bananoPilotageDailyApi + manual draft greeting
 * Run: node scripts/merge-banano-pilotage-api-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function pack(fr, en) {
  return { fr, en };
}

const bananoPilotageDailyApi = {
  ...pack(
    {
      unauthenticated: 'Non authentifié.',
      invalidFromTo: 'from/to invalides (AAAA-MM-JJ).',
      monthOrRangeRequired: 'Paramètre month=YYYY-MM ou from=…&to=… requis.',
      rangeTooLarge: 'Plage trop large (max. {max} jours).',
      readError: 'Lecture impossible.',
      genericError: 'Erreur',
      periodFromTo: 'Du {from} au {to}',
    },
    {
      unauthenticated: 'Not signed in.',
      invalidFromTo: 'from/to invalid (YYYY-MM-DD).',
      monthOrRangeRequired: 'Required: month=YYYY-MM or from=…&to=…',
      rangeTooLarge: 'Range too large (max. {max} days).',
      readError: 'Could not load data.',
      genericError: 'Error',
      periodFromTo: 'From {from} to {to}',
    },
  ),
};

const bananoManualWhatsappExtra = {
  ...pack(
    {
      draftGreeting: 'Bonjour {name},\n\n',
    },
    {
      draftGreeting: 'Hello {name},\n\n',
    },
  ),
};

function mergeNs(name, dict) {
  for (const loc of ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh']) {
    const p = path.join(root, 'messages', `${loc}.json`);
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.Dashboard = j.Dashboard || {};
    const payload = loc === 'fr' ? dict.fr : loc === 'en' ? dict.en : { ...dict.en };
    j.Dashboard[name] = { ...j.Dashboard[name], ...payload };
    fs.writeFileSync(p, JSON.stringify(j));
  }
}

mergeNs('bananoPilotageDailyApi', bananoPilotageDailyApi);

for (const loc of ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh']) {
  const p = path.join(root, 'messages', `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.Dashboard = j.Dashboard || {};
  const extra =
    loc === 'fr'
      ? bananoManualWhatsappExtra.fr
      : loc === 'en'
        ? bananoManualWhatsappExtra.en
        : { ...bananoManualWhatsappExtra.en };
  j.Dashboard.bananoManualWhatsapp = { ...j.Dashboard.bananoManualWhatsapp, ...extra };
  fs.writeFileSync(p, JSON.stringify(j));
}

console.log('Merged bananoPilotageDailyApi + bananoManualWhatsapp.draftGreeting');
