/**
 * Remplace le nom produit visible « Banano » par « Review WhatsApp » (libellés localisés).
 * Run: node scripts/patch-review-whatsapp-branding.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const messagesDir = path.join(root, 'messages');

const PACK = {
  fr: {
    sidebar: 'Avis WhatsApp',
    title: 'Avis WhatsApp — REPUTEXA',
    description:
      "Espace Zenith : sollicitation d'avis WhatsApp, fidélité, pilotage et base clients (terminal et intégrations).",
    appleTitle: 'Avis WhatsApp',
    pageTitle: 'Avis WhatsApp',
    errorTitle: 'Avis WhatsApp — erreur',
    terminalSeoTitle: 'REPUTEXA — Terminal',
    terminalSeoDescription:
      "Mode tablette : caisse fidélité, interface plein écran. Ajoutez à l'écran d'accueil depuis le navigateur.",
    terminalAppleWebTitle: 'REPUTEXA Terminal',
  },
  en: {
    sidebar: 'Review WhatsApp',
    title: 'Review WhatsApp — REPUTEXA',
    description:
      'Zenith hub: WhatsApp review requests, loyalty register, cockpit and customer base (terminal & integrations).',
    appleTitle: 'Review WhatsApp',
    pageTitle: 'Review WhatsApp',
    errorTitle: 'Review WhatsApp — error',
    terminalSeoTitle: 'REPUTEXA — Terminal',
    terminalSeoDescription:
      'Tablet mode: loyalty register, full-screen interface. Add to home screen from your browser.',
    terminalAppleWebTitle: 'REPUTEXA Terminal',
  },
  de: {
    sidebar: 'WhatsApp-Bewertungen',
    title: 'WhatsApp-Bewertungen — REPUTEXA',
    description:
      'Zenith-Bereich: WhatsApp-Bewertungsanfragen, Treuekasse, Steuerung und Kundenstamm (Terminal & Integrationen).',
    appleTitle: 'WhatsApp-Bewertungen',
    pageTitle: 'WhatsApp-Bewertungen',
    errorTitle: 'WhatsApp-Bewertungen — Fehler',
    terminalSeoTitle: 'REPUTEXA — Terminal',
    terminalSeoDescription:
      'Tablet-Modus: Treuekasse, Vollbild. Über den Browser zum Startbildschirm hinzufügen.',
    terminalAppleWebTitle: 'REPUTEXA Terminal',
  },
  es: {
    sidebar: 'Reseñas WhatsApp',
    title: 'Reseñas WhatsApp — REPUTEXA',
    description:
      'Espacio Zenith: solicitudes de reseña por WhatsApp, fidelidad, pilotaje y base de clientes (terminal e integraciones).',
    appleTitle: 'Reseñas WhatsApp',
    pageTitle: 'Reseñas WhatsApp',
    errorTitle: 'Reseñas WhatsApp — error',
    terminalSeoTitle: 'REPUTEXA — Terminal',
    terminalSeoDescription:
      'Modo tableta: caja de fidelidad, pantalla completa. Añádelo a la pantalla de inicio desde el navegador.',
    terminalAppleWebTitle: 'REPUTEXA Terminal',
  },
  it: {
    sidebar: 'Recensioni WhatsApp',
    title: 'Recensioni WhatsApp — REPUTEXA',
    description:
      'Area Zenith: richieste di recensione WhatsApp, cassa fedeltà, controllo e anagrafica (terminale e integrazioni).',
    appleTitle: 'Recensioni WhatsApp',
    pageTitle: 'Recensioni WhatsApp',
    errorTitle: 'Recensioni WhatsApp — errore',
    terminalSeoTitle: 'REPUTEXA — Terminal',
    terminalSeoDescription:
      'Modalità tablet: cassa fedeltà, schermo intero. Aggiungi alla home dal browser.',
    terminalAppleWebTitle: 'REPUTEXA Terminal',
  },
  pt: {
    sidebar: 'Avaliações WhatsApp',
    title: 'Avaliações WhatsApp — REPUTEXA',
    description:
      'Área Zenith: pedidos de avaliação WhatsApp, fidelidade, pilotagem e base de clientes (terminal e integrações).',
    appleTitle: 'Avaliações WhatsApp',
    pageTitle: 'Avaliações WhatsApp',
    errorTitle: 'Avaliações WhatsApp — erro',
    terminalSeoTitle: 'REPUTEXA — Terminal',
    terminalSeoDescription:
      'Modo tablet: caixa de fidelidade, ecrã inteiro. Adicione ao ecrã inicial a partir do navegador.',
    terminalAppleWebTitle: 'REPUTEXA Terminal',
  },
  ja: {
    sidebar: 'WhatsAppレビュー',
    title: 'WhatsAppレビュー — REPUTEXA',
    description:
      'Zenith：WhatsAppでの口コミ依頼、ポイントレジ、運用、顧客台帳（端末・連携）。',
    appleTitle: 'WhatsAppレビュー',
    pageTitle: 'WhatsAppレビュー',
    errorTitle: 'WhatsAppレビュー — エラー',
    terminalSeoTitle: 'REPUTEXA — ターミナル',
    terminalSeoDescription:
      'タブレット向け：ポイントレジ、全画面表示。ブラウザからホーム画面に追加できます。',
    terminalAppleWebTitle: 'REPUTEXA ターミナル',
  },
  zh: {
    sidebar: 'WhatsApp 评价',
    title: 'WhatsApp 评价 — REPUTEXA',
    description: 'Zenith：WhatsApp 邀评、收银积分、运营看板与客户库（终端与对接）。',
    appleTitle: 'WhatsApp 评价',
    pageTitle: 'WhatsApp 评价',
    errorTitle: 'WhatsApp 评价 — 错误',
    terminalSeoTitle: 'REPUTEXA — 终端',
    terminalSeoDescription: '平板模式：积分收银、全屏界面。可通过浏览器添加到主屏幕。',
    terminalAppleWebTitle: 'REPUTEXA 终端',
  },
};

/** Libellés paramètres (PIN) qui mentionnaient « Banano ». */
const SETTINGS_PATCH = {
  fr: {
    toastBananoPinOk: 'Code PIN (avis WhatsApp) mis à jour.',
    bananoPinTitle: "Code PIN (avis WhatsApp / terminal)",
    bananoPinSubtitle:
      "Accès patron sur le terminal fidélité et collecte d'avis. Distinct du code équipier (4 chiffres).",
    bananoPinUnset:
      "Vous définirez ce code à la première ouverture d'Avis WhatsApp sur cet appareil. Il apparaîtra ici une fois enregistré.",
  },
  en: {
    toastBananoPinOk: 'Review WhatsApp PIN updated.',
    bananoPinTitle: 'Review WhatsApp PIN (terminal)',
    bananoPinSubtitle:
      'Owner access on the loyalty / review terminal. Separate from the staff code (4 digits).',
    bananoPinUnset:
      'You will set this code the first time you open Review WhatsApp on this device. It will show here once saved.',
  },
  de: {
    toastBananoPinOk: 'PIN für WhatsApp-Bewertungen aktualisiert.',
    bananoPinTitle: 'PIN (WhatsApp-Bewertungen / Terminal)',
    bananoPinSubtitle:
      'Inhaber-Zugang am Treue- und Bewertungs-Terminal. Getrennt vom Mitarbeitercode (4 Ziffern).',
    bananoPinUnset:
      'Sie legen diesen Code beim ersten Öffnen von WhatsApp-Bewertungen auf diesem Gerät fest. Er erscheint hier nach dem Speichern.',
  },
  es: {
    toastBananoPinOk: 'PIN de Reseñas WhatsApp actualizado.',
    bananoPinTitle: 'PIN (Reseñas WhatsApp / terminal)',
    bananoPinSubtitle:
      'Acceso del titular en el terminal de fidelidad y reseñas. Distinto del código del equipo (4 cifras).',
    bananoPinUnset:
      'Definirá este PIN la primera vez que abra Reseñas WhatsApp en este dispositivo. Aparecerá aquí al guardarlo.',
  },
  it: {
    toastBananoPinOk: 'PIN Recensioni WhatsApp aggiornato.',
    bananoPinTitle: 'PIN (Recensioni WhatsApp / terminale)',
    bananoPinSubtitle:
      'Accesso titolare sul terminale fedeltà e recensioni. Distinto dal codice staff (4 cifre).',
    bananoPinUnset:
      'Imposterai questo PIN al primo avvio di Recensioni WhatsApp su questo dispositivo. Comparirà qui dopo il salvataggio.',
  },
  pt: {
    toastBananoPinOk: 'PIN Avaliações WhatsApp atualizado.',
    bananoPinTitle: 'PIN (Avaliações WhatsApp / terminal)',
    bananoPinSubtitle:
      'Acesso do proprietário no terminal de fidelidade e avaliações. Distinto do código da equipa (4 dígitos).',
    bananoPinUnset:
      'Definirá este PIN na primeira abertura de Avaliações WhatsApp neste dispositivo. Aparecerá aqui após guardar.',
  },
  ja: {
    toastBananoPinOk: 'WhatsAppレビューのPINを更新しました。',
    bananoPinTitle: 'PIN（WhatsAppレビュー / 端末）',
    bananoPinSubtitle:
      'ポイント・口コミ端末のオーナー用。スタッフコード（4桁）とは別です。',
    bananoPinUnset:
      'この端末で初めてWhatsAppレビューを開くときに設定します。保存後にここに表示されます。',
  },
  zh: {
    toastBananoPinOk: '已更新 WhatsApp 评价的 PIN。',
    bananoPinTitle: 'PIN（WhatsApp 评价 / 终端）',
    bananoPinSubtitle: '积分与邀评终端的店主入口。与员工码（4 位）不同。',
    bananoPinUnset: '首次在此设备打开 WhatsApp 评价时设置。保存后会显示在此处。',
  },
};

for (const loc of Object.keys(PACK)) {
  const p = path.join(messagesDir, `${loc}.json`);
  if (!fs.existsSync(p)) continue;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const b = PACK[loc];
  j.Dashboard = j.Dashboard || {};
  j.Dashboard.sidebar = { ...(j.Dashboard.sidebar || {}), whatsappReview: b.sidebar };
  j.Dashboard.whatsappReviewMeta = {
    ...(j.Dashboard.whatsappReviewMeta || {}),
    title: b.title,
    description: b.description,
    appleTitle: b.appleTitle,
    pageTitle: b.pageTitle,
    terminalSeoTitle: b.terminalSeoTitle,
    terminalSeoDescription: b.terminalSeoDescription,
    terminalAppleWebTitle: b.terminalAppleWebTitle,
  };
  j.Dashboard.whatsappReviewError = {
    ...(j.Dashboard.whatsappReviewError || {}),
    title: b.errorTitle,
  };
  const sp = SETTINGS_PATCH[loc];
  if (sp) {
    j.Dashboard.settings = { ...(j.Dashboard.settings || {}), ...sp };
  }
  fs.writeFileSync(p, JSON.stringify(j));
  console.log('branding', loc);
}
