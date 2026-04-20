/**
 * Extends Dashboard.whatsappReviewMeta (shell tabs, subtitles, clients error boundary).
 * Run: node scripts/merge-banano-meta-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const META = {
  fr: {
    pageTitle: 'Avis WhatsApp',
    pageSubtitleEcommerce:
      "Boutique en ligne : collecte d'avis Zenith et webhook uniquement (sans caisse fidélité sur cette page).",
    pageSubtitleFull:
      "Collecte d'avis Zenith, caisse fidélité, pilotage, base clients et paramètres (même contenu collecte que la page dédiée).",
    tabCollecte: "Collecte d'avis",
    tabFidelite: 'Fidélité & caisse',
    tabPilotage: 'Pilotage',
    tabSentinel: 'Sentinel Live',
    tabClients: 'Base clients',
    tabParametres: 'Paramètres',
    clientsBoundaryTitle: "Base clients — erreur d'affichage",
    clientsBoundaryDescription:
      'Rechargez la page. Si le problème continue, ouvrez la console (F12) pour le détail technique.',
  },
  en: {
    pageTitle: 'Review WhatsApp',
    pageSubtitleEcommerce:
      'Online store: Zenith review collection and webhook only (no loyalty register on this page).',
    pageSubtitleFull:
      'Zenith review collection, loyalty register, cockpit, customer base and settings (same collection content as the former standalone page).',
    tabCollecte: 'Review collection',
    tabFidelite: 'Loyalty & register',
    tabPilotage: 'Cockpit',
    tabSentinel: 'Sentinel Live',
    tabClients: 'Customer base',
    tabParametres: 'Settings',
    clientsBoundaryTitle: 'Customer base — display error',
    clientsBoundaryDescription:
      'Reload the page. If it keeps happening, open the console (F12) for technical details.',
  },
  es: {
    pageTitle: 'Reseñas WhatsApp',
    pageSubtitleEcommerce:
      'Tienda online: solo captación Zenith y webhook (sin caja de fidelidad en esta página).',
    pageSubtitleFull:
      'Captación Zenith, caja de fidelidad, pilotaje, base de clientes y ajustes (mismo contenido que la página dedicada).',
    tabCollecte: 'Captación de reseñas',
    tabFidelite: 'Fidelidad y caja',
    tabPilotage: 'Pilotaje',
    tabSentinel: 'Sentinel Live',
    tabClients: 'Base de clientes',
    tabParametres: 'Ajustes',
    clientsBoundaryTitle: 'Base de clientes — error de visualización',
    clientsBoundaryDescription:
      'Recarga la página. Si sigue fallando, abre la consola (F12) para ver el detalle técnico.',
  },
  de: {
    pageTitle: 'WhatsApp-Bewertungen',
    pageSubtitleEcommerce:
      'Onlineshop: nur Zenith-Bewertungsabfrage und Webhook (keine Treuekasse auf dieser Seite).',
    pageSubtitleFull:
      'Zenith-Bewertungsabfrage, Treuekasse, Steuerung, Kundenstamm und Einstellungen (gleicher Inhalt wie die frühere eigene Seite).',
    tabCollecte: 'Bewertungsabfrage',
    tabFidelite: 'Treue & Kasse',
    tabPilotage: 'Steuerung',
    tabSentinel: 'Sentinel Live',
    tabClients: 'Kundenstamm',
    tabParametres: 'Einstellungen',
    clientsBoundaryTitle: 'Kundenstamm — Anzeigefehler',
    clientsBoundaryDescription:
      'Seite neu laden. Wenn es weiterhin auftritt, Konsole (F12) für technische Details öffnen.',
  },
  it: {
    pageTitle: 'Recensioni WhatsApp',
    pageSubtitleEcommerce:
      'Negozio online: solo raccolta recensioni Zenith e webhook (nessuna cassa fedeltà in questa pagina).',
    pageSubtitleFull:
      'Raccolta recensioni Zenith, cassa fedeltà, controllo, anagrafica clienti e impostazioni (stesso contenuto della pagina dedicata).',
    tabCollecte: 'Raccolta recensioni',
    tabFidelite: 'Fedeltà & cassa',
    tabPilotage: 'Controllo',
    tabSentinel: 'Sentinel Live',
    tabClients: 'Anagrafica clienti',
    tabParametres: 'Impostazioni',
    clientsBoundaryTitle: 'Anagrafica clienti — errore di visualizzazione',
    clientsBoundaryDescription:
      'Ricarica la pagina. Se il problema persiste, apri la console (F12) per i dettagli tecnici.',
  },
  pt: {
    pageTitle: 'Avaliações WhatsApp',
    pageSubtitleEcommerce:
      'Loja online: apenas recolha Zenith e webhook (sem caixa de fidelidade nesta página).',
    pageSubtitleFull:
      'Recolha Zenith, caixa de fidelidade, pilotagem, base de clientes e definições (mesmo conteúdo da página dedicada).',
    tabCollecte: 'Recolha de avaliações',
    tabFidelite: 'Fidelidade & caixa',
    tabPilotage: 'Pilotagem',
    tabSentinel: 'Sentinel Live',
    tabClients: 'Base de clientes',
    tabParametres: 'Definições',
    clientsBoundaryTitle: 'Base de clientes — erro de visualização',
    clientsBoundaryDescription:
      'Recarregue a página. Se continuar, abra a consola (F12) para o detalhe técnico.',
  },
  ja: {
    pageTitle: 'Banano',
    pageSubtitleEcommerce:
      'オンライン店舗：Zenith の口コミ依頼と Webhook のみ（このページではレジのポイント管理はありません）。',
    pageSubtitleFull:
      'Zenith の口コミ依頼、ポイントレジ、運用ダッシュボード、顧客台帳、設定（旧スタンドアロンページと同じ収集機能）。',
    tabCollecte: '口コミ依頼',
    tabFidelite: 'ポイント＆レジ',
    tabPilotage: '運用',
    tabSentinel: 'Sentinel Live',
    tabClients: '顧客台帳',
    tabParametres: '設定',
    clientsBoundaryTitle: '顧客台帳 — 表示エラー',
    clientsBoundaryDescription:
      'ページを再読み込みしてください。解消しない場合は (F12) でコンソールを開き、詳細を確認してください。',
  },
  zh: {
    pageTitle: 'WhatsApp 评价',
    pageSubtitleEcommerce: '线上店铺：仅 Zenith 邀评与 Webhook（本页不含收银积分）。',
    pageSubtitleFull:
      'Zenith 邀评、收银积分、运营看板、客户库与设置（与原独立页面相同的邀评内容）。',
    tabCollecte: '邀评',
    tabFidelite: '积分与收银',
    tabPilotage: '运营',
    tabSentinel: 'Sentinel Live',
    tabClients: '客户库',
    tabParametres: '设置',
    clientsBoundaryTitle: '客户库 — 显示错误',
    clientsBoundaryDescription: '请刷新页面。若仍如此，请按 F12 打开控制台查看技术详情。',
  },
};

for (const loc of Object.keys(META)) {
  const p = path.join(root, 'messages', `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.Dashboard = j.Dashboard || {};
  j.Dashboard.whatsappReviewMeta = { ...j.Dashboard.whatsappReviewMeta, ...META[loc] };
  fs.writeFileSync(p, JSON.stringify(j));
}
console.log('Merged whatsappReviewMeta shell keys for', Object.keys(META).length, 'locales');
