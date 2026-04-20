/**
 * Dashboard.bananoAutomationCompose — gabarits WhatsApp relances + période VIP.
 * node scripts/merge-banano-automation-compose-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES = path.join(__dirname, '..', 'messages');

const fr = {
  default_middle_lost:
    "vous nous manquez vraiment, et ce n'est pas pareil sans vous. Revenez quand vous voulez, on vous accueillera avec le sourire.",
  default_middle_birth:
    "on vous souhaite une journée lumineuse, entourée de ceux que vous aimez. Passez nous voir quand l'envie vous dira.",
  default_middle_vip:
    'merci infiniment pour votre fidélité ; toute l’équipe est très heureuse de vous compter parmi nos meilleurs ambassadeurs.',
  lost_compose:
    "Bonjour {prenom}, c'est un petit message de {commerce}. {middle} Pour votre prochain passage : {reduction}. À très vite !",
  birth_compose:
    "Joyeux anniversaire {prenom} ! Ici {commerce}, {middle} {reduction} - présentez ce message en boutique, on s'en occupera avec plaisir.",
  vip_compose:
    "Bravo {prenom} ! C'est {commerce}. Sur {period}, vous totalisez {amount} sur les tickets saisis. {middle} {reduction} - présentez ce message en boutique, on s'en occupera avec plaisir.",
  fallback_prenom: 'vous',
  fallback_commerce_lost: 'notre équipe',
  fallback_commerce_short: 'Nous',
  vip_period_range: 'du {from} au {to}',
  fallback_offer_lost: 'une offre spéciale',
  fallback_gift_birth: 'Un petit cadeau vous attend',
  fallback_attention_vip: 'une petite attention vous attend',
  establishment_fallback: 'notre équipe',
  fallback_periode: 'la période concernée',
  em_dash: '—',
};

const en = {
  default_middle_lost:
    'we really miss you — it’s not the same without you. Come back whenever you like; we’ll welcome you with a smile.',
  default_middle_birth:
    'we wish you a bright day surrounded by the people you love. Stop by whenever you feel like it.',
  default_middle_vip:
    'thank you so much for your loyalty; the whole team is delighted to count you among our best ambassadors.',
  lost_compose:
    'Hello {prenom}, this is a quick note from {commerce}. {middle} For your next visit: {reduction}. See you soon!',
  birth_compose:
    'Happy birthday {prenom}! From {commerce}, {middle} {reduction} — show this message in store and we’ll take care of it with pleasure.',
  vip_compose:
    'Well done {prenom}! It’s {commerce}. On {period}, your total is {amount} on recorded tickets. {middle} {reduction} — show this message in store and we’ll take care of it with pleasure.',
  fallback_prenom: 'you',
  fallback_commerce_lost: 'our team',
  fallback_commerce_short: 'We',
  vip_period_range: '{from} – {to}',
  fallback_offer_lost: 'a special offer',
  fallback_gift_birth: 'A little gift is waiting for you',
  fallback_attention_vip: 'a small treat is waiting for you',
  establishment_fallback: 'our team',
  fallback_periode: 'the period in question',
  em_dash: '—',
};

for (const loc of ['fr', 'en', 'de', 'es', 'it', 'pt', 'ja', 'zh']) {
  const p = path.join(MESSAGES, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.Dashboard = j.Dashboard || {};
  j.Dashboard.bananoAutomationCompose = loc === 'fr' ? fr : { ...en };
  fs.writeFileSync(p, JSON.stringify(j));
  console.log('merged bananoAutomationCompose', loc);
}
