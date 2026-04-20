/**
 * Met à jour Dashboard.form.placeholder dans chaque messages/*.json (démos avis culturellement localisées).
 * node scripts/patch-dashboard-demo-placeholders.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const messagesDir = path.join(root, 'messages');

const PLACEHOLDERS = {
  fr: { review: 'Super accueil, plats au top !', establishment: 'Le Bistro du Marché', city: 'Lyon' },
  en: { review: 'Outstanding service and cozy atmosphere.', establishment: 'The Riverside Café', city: 'Austin' },
  es: {
    review: 'Servicio excelente y comida deliciosa.',
    establishment: 'Taberna El Faro',
    city: 'Madrid',
  },
  de: {
    review: 'Sehr freundliches Personal, jederzeit wieder.',
    establishment: 'Café Berliner Tor',
    city: 'Berlin',
  },
  it: {
    review: 'Cucina eccellente, servizio impeccabile.',
    establishment: 'Trattoria Da Luigi',
    city: 'Milano',
  },
  pt: {
    review: 'Atendimento impecável e comida fantástica.',
    establishment: 'Restaurante O Porto',
    city: 'Lisboa',
  },
  ja: {
    review: 'とても丁寧な対応で、料理も絶品でした。',
    establishment: '喫茶 さくら',
    city: '東京都渋谷区',
  },
  zh: { review: '服务热情，环境干净，还会再来。', establishment: '金星餐厅', city: '上海市' },
};

for (const loc of Object.keys(PLACEHOLDERS)) {
  const msgPath = path.join(messagesDir, `${loc}.json`);
  if (!fs.existsSync(msgPath)) {
    console.warn('skip missing', msgPath);
    continue;
  }
  const main = JSON.parse(fs.readFileSync(msgPath, 'utf8'));
  if (!main.Dashboard) main.Dashboard = {};
  if (!main.Dashboard.form) main.Dashboard.form = {};
  if (!main.Dashboard.form.placeholder) main.Dashboard.form.placeholder = {};
  main.Dashboard.form.placeholder = { ...main.Dashboard.form.placeholder, ...PLACEHOLDERS[loc] };
  fs.writeFileSync(msgPath, JSON.stringify(main));
  console.log('patched', loc);
}
