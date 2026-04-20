import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, '..', 'messages', 'fr.json');
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const e = j.Dashboard.establishments;
if (e.settingsSameAsRich) e.settingsSameAsRich = e.settingsSameAsRich.replace(/&apos;/g, "'");
if (e.googleNotConnectedRich) e.googleNotConnectedRich = e.googleNotConnectedRich.replace(/&apos;/g, "'");
fs.writeFileSync(p, JSON.stringify(j));
console.log('ok');
