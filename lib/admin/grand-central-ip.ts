import type { NextRequest } from 'next/server';

/**
 * Grand Central — extraction IP client (Vercel / Cloudflare / proxy).
 */
export function getGrandCentralClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return normalizeIp(first);
  }
  const real = request.headers.get('x-real-ip')?.trim();
  if (real) return normalizeIp(real);
  const cf = request.headers.get('cf-connecting-ip')?.trim();
  if (cf) return normalizeIp(cf);
  return null;
}

export function normalizeIp(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  if (s.startsWith('::ffff:')) return s.slice(7);
  return s;
}

function parseIPv4ToUint32(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const p = [m[1], m[2], m[3], m[4]].map((x) => parseInt(x, 10));
  if (p.some((x) => x > 255 || Number.isNaN(x))) return null;
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}

function ipv4MatchesCidr(ip: string, cidr: string): boolean {
  const parts = cidr.split('/');
  if (parts.length !== 2) return false;
  const base = normalizeIp(parts[0] ?? '');
  const bits = parseInt(parts[1] ?? '', 10);
  if (!base || Number.isNaN(bits) || bits < 0 || bits > 32) return false;
  const ipNum = parseIPv4ToUint32(ip);
  const baseNum = parseIPv4ToUint32(base);
  if (ipNum === null || baseNum === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

/**
 * Une entrée de liste : IP exacte (v4/v6) ou CIDR IPv4 (ex. 203.0.113.0/24).
 */
export function clientIpMatchesAllowRule(clientIp: string, rule: string): boolean {
  const r = normalizeIp(rule);
  if (!r || !clientIp) return false;
  if (r.includes('/') && !clientIp.includes(':')) {
    return ipv4MatchesCidr(clientIp, r);
  }
  return clientIp === r;
}

export function parseGrandCentralAllowedIps(): string[] {
  const raw = process.env.ADMIN_ALLOWED_IPS?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Si ADMIN_ALLOWED_IPS est vide, aucune contrainte IP (rétrocompatible / dev).
 */
export function isGrandCentralIpAllowed(request: NextRequest): boolean {
  const allowed = parseGrandCentralAllowedIps();
  if (allowed.length === 0) return true;
  const ip = getGrandCentralClientIp(request);
  if (!ip) return false;
  const normalizedClient = normalizeIp(ip);
  return allowed.some((rule) => clientIpMatchesAllowRule(normalizedClient, rule));
}

export function grandCentralUsesIpAllowlist(): boolean {
  return parseGrandCentralAllowedIps().length > 0;
}

/** Appels machine-à-machine (cron, scripts) avec Authorization Bearer. */
export function bypassGrandCentralIpForTrustedAutomation(request: NextRequest): boolean {
  const auth = request.headers.get('authorization')?.trim();
  const cron = process.env.CRON_SECRET?.trim();
  if (cron && auth === `Bearer ${cron}`) return true;
  const adminSec = process.env.ADMIN_SECRET?.trim();
  if (adminSec && auth === `Bearer ${adminSec}`) return true;
  return false;
}
