import type { MetadataRoute } from 'next';
import {
  getBrandName,
  getBrandShortName,
  getManifestStaticFields,
  getPwaIcons,
} from '@/src/lib/empire-settings';

export default function manifest(): MetadataRoute.Manifest {
  const m = getManifestStaticFields();
  const icons = getPwaIcons();
  return {
    name: getBrandName(),
    short_name: getBrandShortName(),
    description: m.description,
    start_url: m.start_url,
    display: m.display as 'standalone',
    background_color: m.background_color,
    theme_color: m.theme_color,
    icons: icons.map((i) => ({
      src: i.src,
      type: i.type,
      sizes: i.sizes,
      purpose: i.purpose as 'any',
    })),
  };
}
