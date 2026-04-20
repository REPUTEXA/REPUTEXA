import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES = path.join(__dirname, '..', 'messages');

const texts = {
  fr: "Définissez la stratégie d'envoi après livraison et le consentement checkout (boutique en ligne).",
  en: 'Set your post-delivery sending strategy and checkout consent (online store).',
  it: 'Imposta la strategia di invio dopo la consegna e il consenso al checkout (negozio online).',
  es: 'Defina la estrategia de envío tras la entrega y el consentimiento en el checkout (tienda online).',
  de: 'Legen Sie Versandstrategie nach Zustellung und Checkout-Einwilligung fest (Onlineshop).',
  pt: 'Defina a estratégia de envio após a entrega e o consentimento no checkout (loja online).',
  ja: '配送後の送信戦略とチェックアウトでの同意（オンライン店舗）を設定してください。',
  zh: '请设置发货后的发送策略与结账同意（网店）。',
};

for (const loc of Object.keys(texts)) {
  const p = path.join(MESSAGES, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.Dashboard = j.Dashboard || {};
  j.Dashboard.reviewCollection = j.Dashboard.reviewCollection || {};
  j.Dashboard.reviewCollection.section1IntroEcommerce = texts[loc];
  fs.writeFileSync(p, JSON.stringify(j) + '\n');
  console.log('section1IntroEcommerce', loc);
}
