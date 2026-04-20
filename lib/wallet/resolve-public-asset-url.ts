/**
 * URL absolue pour fetch serveur (PassKit, Sharp) à partir d’un chemin public `/...`.
 */
export function resolvePublicAssetUrlForServer(pathOrUrl: string): string {
  const t = pathOrUrl.trim();
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    'http://localhost:3000';
  const path = t.startsWith('/') ? t : `/${t}`;
  return `${origin}${path}`;
}
