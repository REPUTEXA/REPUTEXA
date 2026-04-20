/**
 * Correspondances catégories historiques (corps d’articles) → clés i18n `Blog.categories.*`.
 * Les libellés FR/EN sont les chaînes exactes présentes dans les métadonnées archivées.
 */
export const LEGACY_FR_CATEGORY_TO_KEY: Record<string, string> = {
  Produit: 'product',
  Tendances: 'trends',
  Réglementation: 'regulation',
  'Guide pratique': 'guide',
  "Cas d'usage": 'useCase',
  'SEO Local': 'seoLocal',
  Cybersécurité: 'cybersecurity',
  Études: 'studies',
  International: 'international',
};

export const LEGACY_EN_CATEGORY_TO_KEY: Record<string, string> = {
  Product: 'product',
  Trends: 'trends',
  Regulation: 'regulation',
  'Practical guide': 'guide',
  'Use case': 'useCase',
  'Local SEO': 'seoLocal',
  Cybersecurity: 'cybersecurity',
  Studies: 'studies',
  International: 'international',
};
