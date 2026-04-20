/**
 * Termes clés validés pour la transcréation Babel « native-perfect » (secteur CHR / SaaS).
 * Clés stables en anglais (concept) → formulation préférée par locale.
 * Les modèles s’en servent comme ancrage ; la transcréation reste libre sur le reste du texte.
 */
export type BabelGlossaryEntry = Record<string, string>;

/** Locales gérées par le site (aligné sur SITE_LOCALE_CODES). */
export const BABEL_NATIVE_GLOSSARY: Record<string, BabelGlossaryEntry> = {
  fr: {
    Dashboard: 'Tableau de bord',
    Establishment: 'Établissement',
    Review: 'Avis',
    Subscription: 'Abonnement',
    Trial: 'Essai',
    Customer: 'Client',
    Rating: 'Note',
    Feedback: 'Retour',
    Reputation: 'Réputation',
    Analytics: 'Analytique',
  },
  en: {
    Dashboard: 'Dashboard',
    Establishment: 'Property',
    Review: 'Review',
    Subscription: 'Subscription',
    Trial: 'Trial',
    Customer: 'Customer',
    Rating: 'Rating',
    Feedback: 'Feedback',
    Reputation: 'Reputation',
    Analytics: 'Analytics',
  },
  /** UK market copy — British spelling and conventions in transcreation output. */
  'en-gb': {
    Dashboard: 'Dashboard',
    Establishment: 'Premises',
    Review: 'Review',
    Subscription: 'Subscription',
    Trial: 'Trial',
    Customer: 'Customer',
    Rating: 'Rating',
    Feedback: 'Feedback',
    Reputation: 'Reputation',
    Analytics: 'Analytics',
  },
  es: {
    Dashboard: 'Panel de control',
    Establishment: 'Establecimiento',
    Review: 'Reseña',
    Subscription: 'Suscripción',
    Trial: 'Prueba',
    Customer: 'Cliente',
    Rating: 'Valoración',
    Feedback: 'Opinión',
    Reputation: 'Reputación',
    Analytics: 'Analítica',
  },
  de: {
    Dashboard: 'Dashboard',
    Establishment: 'Betrieb',
    Review: 'Bewertung',
    Subscription: 'Abonnement',
    Trial: 'Testphase',
    Customer: 'Kunde',
    Rating: 'Bewertung',
    Feedback: 'Feedback',
    Reputation: 'Reputation',
    Analytics: 'Analysen',
  },
  it: {
    Dashboard: 'Cruscotto',
    Establishment: 'Locale',
    Review: 'Recensione',
    Subscription: 'Abbonamento',
    Trial: 'Prova',
    Customer: 'Cliente',
    Rating: 'Valutazione',
    Feedback: 'Feedback',
    Reputation: 'Reputazione',
    Analytics: 'Analitiche',
  },
  pt: {
    Dashboard: 'Painel',
    Establishment: 'Estabelecimento',
    Review: 'Avaliação',
    Subscription: 'Assinatura',
    Trial: 'Teste',
    Customer: 'Cliente',
    Rating: 'Classificação',
    Feedback: 'Feedback',
    Reputation: 'Reputação',
    Analytics: 'Análises',
  },
  ja: {
    Dashboard: 'ダッシュボード',
    Establishment: '施設',
    Review: 'レビュー',
    Subscription: 'サブスクリプション',
    Trial: 'トライアル',
    Customer: 'お客様',
    Rating: '評価',
    Feedback: 'フィードバック',
    Reputation: '評判',
    Analytics: '分析',
  },
  zh: {
    Dashboard: '控制台',
    Establishment: '门店',
    Review: '评价',
    Subscription: '订阅',
    Trial: '试用',
    Customer: '客户',
    Rating: '评分',
    Feedback: '反馈',
    Reputation: '声誉',
    Analytics: '分析',
  },
};

export function formatGlossaryForPrompt(localeCode: string): string {
  const g = BABEL_NATIVE_GLOSSARY[localeCode.toLowerCase()];
  if (!g || Object.keys(g).length === 0) {
    return '(Aucun glossaire natif indexé pour cette locale — rester naturel et cohérent avec le marché.)';
  }
  return Object.entries(g)
    .map(([concept, preferred]) => `- ${concept} → ${preferred}`)
    .join('\n');
}
