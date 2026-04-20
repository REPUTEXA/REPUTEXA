/**
 * Parse les paramètres d’auth dans l’URL (fragment + query, la query prime — aligné sur gotrue-js).
 */
export function parseAuthParamsFromHref(href: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const url = new URL(href);
    if (url.hash?.startsWith('#')) {
      try {
        const hp = new URLSearchParams(url.hash.slice(1));
        hp.forEach((value, key) => {
          result[key] = value;
        });
      } catch {
        /* ignore */
      }
    }
    url.searchParams.forEach((value, key) => {
      result[key] = value;
    });
  } catch {
    /* ignore */
  }
  return result;
}

/** Retire code / tokens / erreurs d’auth de l’URL (sans perdre `next`, etc.). */
export function stripAuthParamsFromBrowserUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.hash = '';
  const stripKeys = [
    'code',
    'token_hash',
    'type',
    'error',
    'error_description',
    'error_code',
    'access_token',
    'refresh_token',
    'expires_in',
    'expires_at',
    'token_type',
    'provider_token',
    'provider_refresh_token',
  ];
  for (const k of stripKeys) {
    url.searchParams.delete(k);
  }
  window.history.replaceState(window.history.state, '', url.toString());
}
