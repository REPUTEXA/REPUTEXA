/**
 * Rate limiter in-memory (5 requêtes/minute par IP sur les routes auth).
 * En production multi-instance, remplacer par Redis (Upstash) ou similaire.
 */
const store = new Map<string, number[]>();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 5;

function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  if (realIP) return realIP;
  return 'unknown';
}

function prune(timestamps: number[]): number[] {
  const cutoff = Date.now() - WINDOW_MS;
  return timestamps.filter((t) => t > cutoff);
}

export function checkAuthRateLimit(request: Request): { ok: boolean; remaining?: number } {
  const ip = getClientIP(request);
  const key = `auth:${ip}`;
  const now = Date.now();

  let timestamps = store.get(key) ?? [];
  timestamps = prune(timestamps);

  if (timestamps.length >= MAX_REQUESTS) {
    return { ok: false };
  }

  timestamps.push(now);
  store.set(key, timestamps);

  return { ok: true, remaining: MAX_REQUESTS - timestamps.length };
}

/** Contact form: 10 requêtes / minute par IP (transcribe + submit) */
const CONTACT_WINDOW_MS = 60 * 1000;
const CONTACT_MAX_REQUESTS = 10;
const contactStore = new Map<string, number[]>();

export function checkContactRateLimit(request: Request): { ok: boolean; remaining?: number } {
  const ip = getClientIP(request);
  const key = `contact:${ip}`;
  const now = Date.now();

  let timestamps = contactStore.get(key) ?? [];
  timestamps = timestamps.filter((t) => t > now - CONTACT_WINDOW_MS);

  if (timestamps.length >= CONTACT_MAX_REQUESTS) {
    return { ok: false };
  }
  timestamps.push(now);
  contactStore.set(key, timestamps);
  return { ok: true, remaining: CONTACT_MAX_REQUESTS - timestamps.length };
}

/** Effacement données clients finaux (formulaire public) : 5 requêtes / minute / IP. */
const ERASURE_WINDOW_MS = 60 * 1000;
const ERASURE_MAX_REQUESTS = 5;
const erasureStore = new Map<string, number[]>();

export function checkClientDataErasureRateLimit(request: Request): { ok: boolean; remaining?: number } {
  const ip = getClientIP(request);
  const key = `end-client-erasure:${ip}`;
  const now = Date.now();

  let timestamps = erasureStore.get(key) ?? [];
  timestamps = timestamps.filter((t) => t > now - ERASURE_WINDOW_MS);

  if (timestamps.length >= ERASURE_MAX_REQUESTS) {
    return { ok: false };
  }
  timestamps.push(now);
  erasureStore.set(key, timestamps);
  return { ok: true, remaining: ERASURE_MAX_REQUESTS - timestamps.length };
}

/**
 * Démo tunnel WhatsApp : limite anti-abus par IP.
 * - En `development`, pas de blocage (sinon toutes les requêtes locales partagent souvent la clé `unknown` → 429).
 * - IP `unknown` (sans en-tête proxy) : plafond plus haut pour ne pas mutualiser un quota trop bas.
 */
const TUNNEL_DEMO_WINDOW_MS = 60 * 1000;
const TUNNEL_DEMO_MAX_REQUESTS = 45;
const TUNNEL_DEMO_MAX_UNKNOWN_IP = 200;
const tunnelDemoStore = new Map<string, number[]>();

/** Tableau défi public (lien équipe) : 60 requêtes / minute / IP. */
const TEAM_BOARD_WINDOW_MS = 60 * 1000;
const TEAM_BOARD_MAX_REQUESTS = 60;
const teamBoardStore = new Map<string, number[]>();

export function checkReputexaTeamBoardRateLimit(request: Request): { ok: boolean; remaining?: number } {
  const ip = getClientIP(request);
  const key = `reputexa-team:${ip}`;
  const now = Date.now();

  let timestamps = teamBoardStore.get(key) ?? [];
  timestamps = timestamps.filter((t) => t > now - TEAM_BOARD_WINDOW_MS);

  if (timestamps.length >= TEAM_BOARD_MAX_REQUESTS) {
    return { ok: false };
  }
  timestamps.push(now);
  teamBoardStore.set(key, timestamps);
  return { ok: true, remaining: TEAM_BOARD_MAX_REQUESTS - timestamps.length };
}

export function checkTunnelDemoRateLimit(request: Request): { ok: boolean; remaining?: number } {
  if (process.env.NODE_ENV === 'development') {
    return { ok: true, remaining: 999 };
  }

  const ip = getClientIP(request);
  const max = ip === 'unknown' ? TUNNEL_DEMO_MAX_UNKNOWN_IP : TUNNEL_DEMO_MAX_REQUESTS;
  const key = `tunnel-demo:${ip}`;
  const now = Date.now();

  let timestamps = tunnelDemoStore.get(key) ?? [];
  timestamps = timestamps.filter((t) => t > now - TUNNEL_DEMO_WINDOW_MS);

  if (timestamps.length >= max) {
    return { ok: false };
  }
  timestamps.push(now);
  tunnelDemoStore.set(key, timestamps);
  return { ok: true, remaining: max - timestamps.length };
}

/** Démo modale « réponses avis » (landing) — mêmes plafonds que le tunnel WhatsApp. */
const REVIEW_DEMO_WINDOW_MS = TUNNEL_DEMO_WINDOW_MS;
const REVIEW_DEMO_MAX_REQUESTS = TUNNEL_DEMO_MAX_REQUESTS;
const REVIEW_DEMO_MAX_UNKNOWN_IP = TUNNEL_DEMO_MAX_UNKNOWN_IP;
const reviewDemoStore = new Map<string, number[]>();

export function checkReviewReplyDemoRateLimit(request: Request): { ok: boolean; remaining?: number } {
  if (process.env.NODE_ENV === 'development') {
    return { ok: true, remaining: 999 };
  }

  const ip = getClientIP(request);
  const max = ip === 'unknown' ? REVIEW_DEMO_MAX_UNKNOWN_IP : REVIEW_DEMO_MAX_REQUESTS;
  const key = `review-reply-demo:${ip}`;
  const now = Date.now();

  let timestamps = reviewDemoStore.get(key) ?? [];
  timestamps = timestamps.filter((t) => t > now - REVIEW_DEMO_WINDOW_MS);

  if (timestamps.length >= max) {
    return { ok: false };
  }
  timestamps.push(now);
  reviewDemoStore.set(key, timestamps);
  return { ok: true, remaining: max - timestamps.length };
}
