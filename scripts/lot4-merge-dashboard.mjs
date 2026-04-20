/**
 * Merges scripts/lot4/{locale}.json (Dashboard.adminGrowthWarRoom, adminIaForgeClient, adminSecurityPerfection)
 * into messages/{locale}.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const locales = ['fr', 'en', 'de', 'es', 'it', 'pt', 'ja', 'zh'];

for (const loc of locales) {
  const patchPath = path.join(root, 'scripts', 'lot4', `${loc}.json`);
  const messagesPath = path.join(root, 'messages', `${loc}.json`);
  const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));
  const j = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
  if (!j.Dashboard) j.Dashboard = {};
  j.Dashboard.adminGrowthWarRoom = patch.adminGrowthWarRoom;
  j.Dashboard.adminIaForgeClient = patch.adminIaForgeClient;
  j.Dashboard.adminSecurityPerfection = patch.adminSecurityPerfection;
  fs.writeFileSync(messagesPath, JSON.stringify(j, null, 2) + '\n', 'utf8');
  console.log('merged', loc);
}
