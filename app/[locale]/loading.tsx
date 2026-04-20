import { BrandPageLoader } from '@/components/brand/brand-page-loader';

/**
 * Plein écran R : affiché seulement si le chargement dépasse ~1 s (voir `BrandPageLoader`).
 */
export default function LocaleLoading() {
  return <BrandPageLoader />;
}
