import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** Cache long terme pour assets publics hashés par déploiement (logos, pas de HTML). */
const STATIC_ASSET_CACHE = 'public, max-age=31536000, immutable';

/** HSTS — première ligne de défense navigateur (complète TLS côté hébergeur). */
const STRICT_TRANSPORT_SECURITY = {
  key: 'Strict-Transport-Security',
  value: 'max-age=31536000; includeSubDomains; preload',
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  /** Bundling stable pour next-intl / @formatjs (évite références cassées vers vendor-chunks après rebuild partiel). */
  transpilePackages: ['next-intl'],
  async headers() {
    return [
      {
        source: '/reputexa-mark.svg',
        headers: [
          { key: 'Cache-Control', value: STATIC_ASSET_CACHE },
          STRICT_TRANSPORT_SECURITY,
        ],
      },
      {
        source: '/logo-hd.png',
        headers: [
          { key: 'Cache-Control', value: STATIC_ASSET_CACHE },
          STRICT_TRANSPORT_SECURITY,
        ],
      },
      {
        source: '/logo.png',
        headers: [
          { key: 'Cache-Control', value: STATIC_ASSET_CACHE },
          STRICT_TRANSPORT_SECURITY,
        ],
      },
      {
        source: '/:path*',
        headers: [STRICT_TRANSPORT_SECURITY],
      },
    ];
  },
  async redirects() {
    return [
      {
        /** Favoris / liens sans préfixe i18n : avec localePrefix "always", seule /{locale}/dashboard/... existe. */
        source: '/dashboard/whatsapp-review',
        destination: '/fr/dashboard/whatsapp-review',
        permanent: false,
      },
      {
        source: '/:locale/dashboard/collecte-avis',
        destination: '/:locale/dashboard/whatsapp-review?tab=collecte',
        permanent: false,
      },
    ];
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'framer-motion',
      'recharts',
      'sonner',
    ],
    /** Sentinel Vault / dump Postgres : paquets natifs aussi listés dans package.json */
    serverComponentsExternalPackages: [
      'pg',
      'pg-copy-streams',
      'passkit-generator',
      'sharp',
      'node-forge',
      '@supabase/supabase-js',
      '@supabase/ssr',
      /** SDK Twilio étend des classes Node ; le bundler webpack cassait l’héritage (« Super expression must… »). */
      'twilio',
      /** PDF serveur : mêmes symptômes d’héritage si webpack réécrit le bundle. */
      '@react-pdf/renderer',
      '@react-pdf/font',
      '@react-pdf/primitives',
    ],
  },
  eslint: {
    // Le dépôt contient encore des avertissements JSX/apostrophes sur des pages marketing ;
    // ne pas bloquer le build tant que le nettoyage n’est pas fait (tsc reste actif).
    ignoreDuringBuilds: true,
  },
};

export default withNextIntl(nextConfig);
