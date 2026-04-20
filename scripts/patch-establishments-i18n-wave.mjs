/**
 * Mise à jour i18n : établissements (montants + API + e-mail suppression).
 * node scripts/patch-establishments-i18n-wave.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, '..', 'messages');

const perMonthShort = {
  fr: ' /mois',
  en: '/month',
  es: '/mes',
  de: '/Monat',
  it: '/mese',
  pt: '/mês',
  ja: '/月',
  zh: '/月',
};

const perYearShort = {
  fr: ' /an',
  en: '/year',
  es: '/año',
  de: '/Jahr',
  it: '/anno',
  pt: '/ano',
  ja: '/年',
  zh: '/年',
};

const estPatch = {
  fr: {
    savingsPerMonthLine: '· Économie : {amount}{perMonth}',
    pricePerMonthShort: '{amount}{perMonth}',
    savingsVsBase: 'Économie : {amount}{perMonth}',
    debitTodayProrata: "Débit aujourd'hui : {amount} (prorata restant du mois)",
    thenSubscriptionWillBe: 'Puis votre abonnement passera à {amount}{perMonth}',
    manualDiscountBanner: 'Remise -{discount}% pour ce nouvel établissement — {amount}{perMonth}',
    perMonthShort: perMonthShort.fr,
    perYearShort: perYearShort.fr,
    newSubscriptionMonthly: 'Nouvel abonnement mensuel',
    newSubscriptionAnnual: 'Nouvel abonnement annuel',
  },
  en: {
    savingsPerMonthLine: '· Savings: {amount}{perMonth}',
    pricePerMonthShort: '{amount}{perMonth}',
    savingsVsBase: 'Savings: {amount}{perMonth}',
    debitTodayProrata: 'Charged today: {amount} (prorated for the rest of this billing period)',
    thenSubscriptionWillBe: 'Then your subscription will be {amount}{perMonth}',
    manualDiscountBanner: '-{discount}% discount on this new location — {amount}{perMonth}',
    perMonthShort: perMonthShort.en,
    perYearShort: perYearShort.en,
    newSubscriptionMonthly: 'New monthly subscription',
    newSubscriptionAnnual: 'New annual subscription',
  },
  es: {
    savingsPerMonthLine: '· Ahorro: {amount}{perMonth}',
    pricePerMonthShort: '{amount}{perMonth}',
    savingsVsBase: 'Ahorro: {amount}{perMonth}',
    debitTodayProrata: 'Cargo hoy: {amount} (prorrateo del periodo en curso)',
    thenSubscriptionWillBe: 'Luego tu suscripción será de {amount}{perMonth}',
    manualDiscountBanner: 'Descuento del {discount}% en este nuevo establecimiento — {amount}{perMonth}',
    perMonthShort: perMonthShort.es,
    perYearShort: perYearShort.es,
    newSubscriptionMonthly: 'Nueva suscripción mensual',
    newSubscriptionAnnual: 'Nueva suscripción anual',
  },
  de: {
    savingsPerMonthLine: '· Ersparnis: {amount}{perMonth}',
    pricePerMonthShort: '{amount}{perMonth}',
    savingsVsBase: 'Ersparnis: {amount}{perMonth}',
    debitTodayProrata: 'Heute belastet: {amount} (anteilig für den laufenden Zeitraum)',
    thenSubscriptionWillBe: 'Danach beträgt Ihr Abonnement {amount}{perMonth}',
    manualDiscountBanner: '-{discount}% Rabatt für diesen neuen Standort — {amount}{perMonth}',
    perMonthShort: perMonthShort.de,
    perYearShort: perYearShort.de,
    newSubscriptionMonthly: 'Neues Monatsabo',
    newSubscriptionAnnual: 'Neues Jahresabo',
  },
  it: {
    savingsPerMonthLine: '· Risparmio: {amount}{perMonth}',
    pricePerMonthShort: '{amount}{perMonth}',
    savingsVsBase: 'Risparmio: {amount}{perMonth}',
    debitTodayProrata: 'Addebito oggi: {amount} (prorata sul periodo in corso)',
    thenSubscriptionWillBe: "Poi l'abbonamento sarà {amount}{perMonth}",
    manualDiscountBanner: 'Sconto -{discount}% su questa nuova sede — {amount}{perMonth}',
    perMonthShort: perMonthShort.it,
    perYearShort: perYearShort.it,
    newSubscriptionMonthly: 'Nuovo abbonamento mensile',
    newSubscriptionAnnual: 'Nuovo abbonamento annuale',
  },
  pt: {
    savingsPerMonthLine: '· Poupança: {amount}{perMonth}',
    pricePerMonthShort: '{amount}{perMonth}',
    savingsVsBase: 'Poupança: {amount}{perMonth}',
    debitTodayProrata: 'Débito hoje: {amount} (prorata do período em curso)',
    thenSubscriptionWillBe: 'Depois a sua subscrição será {amount}{perMonth}',
    manualDiscountBanner: 'Desconto de {discount}% neste novo estabelecimento — {amount}{perMonth}',
    perMonthShort: perMonthShort.pt,
    perYearShort: perYearShort.pt,
    newSubscriptionMonthly: 'Nova subscrição mensal',
    newSubscriptionAnnual: 'Nova subscrição anual',
  },
  ja: {
    savingsPerMonthLine: '· 節約: {amount}{perMonth}',
    pricePerMonthShort: '{amount}{perMonth}',
    savingsVsBase: '節約: {amount}{perMonth}',
    debitTodayProrata: '本日の請求: {amount}（当期の日割り）',
    thenSubscriptionWillBe: '次回以降のご利用料金は {amount}{perMonth} です',
    manualDiscountBanner: '新規拠点で {discount}% オフ — {amount}{perMonth}',
    perMonthShort: perMonthShort.ja,
    perYearShort: perYearShort.ja,
    newSubscriptionMonthly: '新しい月額プラン',
    newSubscriptionAnnual: '新しい年額プラン',
  },
  zh: {
    savingsPerMonthLine: '· 节省：{amount}{perMonth}',
    pricePerMonthShort: '{amount}{perMonth}',
    savingsVsBase: '节省：{amount}{perMonth}',
    debitTodayProrata: '今日扣款：{amount}（本期按比例计算）',
    thenSubscriptionWillBe: '之后您的订阅费用为 {amount}{perMonth}',
    manualDiscountBanner: '新店址享 {discount}% 折扣 — {amount}{perMonth}',
    perMonthShort: perMonthShort.zh,
    perYearShort: perYearShort.zh,
    newSubscriptionMonthly: '新月度订阅',
    newSubscriptionAnnual: '新年度订阅',
  },
};

const apiEstablishments = {
  fr: {
    notAuthenticated: 'Non authentifié',
    quotaReached: "Quota atteint. Augmentez votre abonnement pour ajouter des emplacements.",
    addViaStripe:
      'Pour ajouter un emplacement, augmentez votre abonnement depuis le tableau de bord (paiement Stripe).',
    addErrorGeneric: "Erreur lors de l'ajout",
    noChanges: 'Aucune modification',
    notFound: 'Établissement introuvable',
  },
  en: {
    notAuthenticated: 'Not signed in',
    quotaReached: 'Quota reached. Upgrade your subscription to add more locations.',
    addViaStripe: 'To add a location, upgrade your subscription from the dashboard (Stripe checkout).',
    addErrorGeneric: 'Something went wrong while adding',
    noChanges: 'No changes to save',
    notFound: 'Establishment not found',
  },
  es: {
    notAuthenticated: 'No autenticado',
    quotaReached: 'Cuota alcanzada. Mejore su suscripción para añadir más ubicaciones.',
    addViaStripe: 'Para añadir una ubicación, mejore su suscripción desde el panel (pago con Stripe).',
    addErrorGeneric: 'Error al añadir',
    noChanges: 'Sin cambios',
    notFound: 'Establecimiento no encontrado',
  },
  de: {
    notAuthenticated: 'Nicht angemeldet',
    quotaReached: 'Kontingent erreicht. Erweitern Sie Ihr Abonnement für weitere Standorte.',
    addViaStripe: 'Um einen Standort hinzuzufügen, erweitern Sie Ihr Abonnement im Dashboard (Stripe).',
    addErrorGeneric: 'Fehler beim Hinzufügen',
    noChanges: 'Keine Änderungen',
    notFound: 'Betrieb nicht gefunden',
  },
  it: {
    notAuthenticated: 'Non autenticato',
    quotaReached: 'Limite raggiunto. Aumenta il piano per aggiungere sedi.',
    addViaStripe: 'Per aggiungere una sede, aggiorna il piano dalla dashboard (pagamento Stripe).',
    addErrorGeneric: "Errore durante l'aggiunta",
    noChanges: 'Nessuna modifica',
    notFound: 'Stabilimento non trovato',
  },
  pt: {
    notAuthenticated: 'Não autenticado',
    quotaReached: 'Limite atingido. Atualize a subscrição para adicionar mais locais.',
    addViaStripe: 'Para adicionar um local, atualize a subscrição no painel (pagamento Stripe).',
    addErrorGeneric: 'Erro ao adicionar',
    noChanges: 'Sem alterações',
    notFound: 'Estabelecimento não encontrado',
  },
  ja: {
    notAuthenticated: '未ログインです',
    quotaReached: '上限に達しました。プランをアップグレードして拠点を追加してください。',
    addViaStripe: '拠点を追加するには、ダッシュボードからプランをアップグレードしてください（Stripe）。',
    addErrorGeneric: '追加中にエラーが発生しました',
    noChanges: '変更はありません',
    notFound: '店舗が見つかりません',
  },
  zh: {
    notAuthenticated: '未登录',
    quotaReached: '已达上限。请升级订阅以添加更多门店。',
    addViaStripe: '要添加门店，请在控制台升级订阅（Stripe 支付）。',
    addErrorGeneric: '添加时出错',
    noChanges: '没有可保存的更改',
    notFound: '未找到门店',
  },
};

const emailDeletedExtra = {
  fr: {
    emailSubject: 'Établissement supprimé — REPUTEXA',
    unnamedEstablishment: 'Cet établissement',
  },
  en: {
    emailSubject: 'Establishment removed — REPUTEXA',
    unnamedEstablishment: 'This establishment',
  },
  es: {
    emailSubject: 'Establecimiento eliminado — REPUTEXA',
    unnamedEstablishment: 'Este establecimiento',
  },
  de: {
    emailSubject: 'Betrieb entfernt — REPUTEXA',
    unnamedEstablishment: 'Dieser Betrieb',
  },
  it: {
    emailSubject: 'Stabilimento rimosso — REPUTEXA',
    unnamedEstablishment: 'Questo stabilimento',
  },
  pt: {
    emailSubject: 'Estabelecimento removido — REPUTEXA',
    unnamedEstablishment: 'Este estabelecimento',
  },
  ja: {
    emailSubject: '店舗が削除されました — REPUTEXA',
    unnamedEstablishment: 'この店舗',
  },
  zh: {
    emailSubject: '门店已删除 — REPUTEXA',
    unnamedEstablishment: '该门店',
  },
};

for (const loc of ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh']) {
  const p = path.join(messagesDir, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.Dashboard = j.Dashboard || {};
  j.Dashboard.establishments = { ...(j.Dashboard.establishments || {}), ...estPatch[loc] };
  j.ApiEstablishments = { ...(j.ApiEstablishments || {}), ...apiEstablishments[loc] };
  j.EmailTemplates = j.EmailTemplates || {};
  j.EmailTemplates.establishmentDeleted = {
    ...(j.EmailTemplates.establishmentDeleted || {}),
    ...emailDeletedExtra[loc],
  };
  fs.writeFileSync(p, `${JSON.stringify(j)}\n`);
  console.log('patched', loc);
}
