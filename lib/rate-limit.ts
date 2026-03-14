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
