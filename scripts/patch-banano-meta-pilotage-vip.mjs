import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const PATCH = {
  fr: {
    pilotageVipArticleTitle:
      'Récompensez votre meilleur client sur la période : un message personnalisé renforce la relation.',
    pilotageVipRankingHint:
      'Classement par somme des tickets saisis sur la période (cumul, pas un seul achat).',
    pilotageVipFooterA: 'Message WhatsApp de remerciement : activez ',
    pilotageVipFooterStrong: 'Client VIP du mois',
    pilotageVipFooterB: ' dans ',
    pilotageVipFooterLink: 'Paramètres → Relances WhatsApp',
    pilotageVipFooterC:
      '. Envoi automatique typique le 1er du mois (mois civil précédent, fuseau Paris).',
  },
  en: {
    pilotageVipArticleTitle:
      'Reward your top customer for the period: a personalized message strengthens the relationship.',
    pilotageVipRankingHint:
      'Ranking by sum of ticket amounts captured over the period (cumulative, not a single purchase).',
    pilotageVipFooterA: 'Thank-you WhatsApp: turn on ',
    pilotageVipFooterStrong: 'VIP of the month',
    pilotageVipFooterB: ' under ',
    pilotageVipFooterLink: 'Settings → WhatsApp follow-ups',
    pilotageVipFooterC:
      '. Typical automatic send on the 1st of the month (previous calendar month, Paris timezone).',
  },
};

for (const loc of ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh']) {
  const p = path.join(root, 'messages', `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const patch = loc === 'fr' ? PATCH.fr : PATCH.en;
  j.Dashboard.whatsappReviewMeta = { ...j.Dashboard.whatsappReviewMeta, ...patch };
  fs.writeFileSync(p, JSON.stringify(j));
}
console.log('Patched pilotage VIP keys into whatsappReviewMeta');
