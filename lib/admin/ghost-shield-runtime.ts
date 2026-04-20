/**
 * Bouclier Ghost — motifs d’injection testés sur la query string uniquement (GET).
 * Sans modification des fichiers du dépôt ; charge des motifs depuis legal_config + défauts.
 * Ne remplace pas un WAF managé ni une revue humaine.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
export const GHOST_SHIELD_RUNTIME_KEY = 'ghost_shield_runtime';

/** Suffisant pour dériver des motifs sans dépendre de ghost-protocol-audit (évite cycle). */
type ShieldFindingLike = { pillar: string; severity: string };

export type GhostShieldRuntimeStored = {
  patterns: string[];
  updatedAt: string;
  /** Derniers runIds ayant contribué (debug) */
  sources?: string[];
};

/** Motifs par défaut (URL / query) — conservateurs, inspirés des sondes formulaire / XSS. */
export const GHOST_SHIELD_DEFAULT_SOURCES: string[] = [
  String.raw`(?i)(<script[\s/>]|</script|on\w+\s*=|javascript:|data:text/html|\bunion\s+select\b|;\s*drop\s+table)`,
];

const MAX_PATTERNS = 28;
const MAX_PATTERN_LEN = 220;
const CACHE_MS = 45_000;

type ShieldCache = { at: number; regexes: RegExp[] };
const g: { shield?: ShieldCache } = {};

function compileAll(sources: string[]): RegExp[] {
  const out: RegExp[] = [];
  for (const s of sources) {
    if (typeof s !== 'string' || s.length < 4 || s.length > MAX_PATTERN_LEN) continue;
    try {
      out.push(new RegExp(s));
    } catch {
      /* motif invalide ignoré */
    }
  }
  return out;
}

function mergeUnique(base: string[], extra: string[]): string[] {
  return Array.from(new Set([...base, ...extra])).slice(0, MAX_PATTERNS);
}

/** Dérive des motifs additionnels à partir des findings (piliers à risque seulement). */
export function deriveRuntimePatternSourcesFromFindings(findings: ShieldFindingLike[]): string[] {
  const out: string[] = [];
  for (const f of findings) {
    if (f.severity !== 'critical' && f.severity !== 'warning') continue;
    if (f.pillar === 'ai_prompt_injection') {
      out.push(
        String.raw`(?i)(\bignore\b.{0,48}\b(instructions?|prompt)\b|\bsystem\b\s*:\s*oublie\b|\bjailbreak\b)`
      );
    }
  }
  return Array.from(new Set(out));
}

export async function mergeRuntimeShieldPatterns(
  admin: SupabaseClient,
  findings: ShieldFindingLike[],
  runId: string
): Promise<{ added: number; total: number }> {
  const derived = deriveRuntimePatternSourcesFromFindings(findings);
  const { data } = await admin
    .from('legal_config')
    .select('value')
    .eq('key', GHOST_SHIELD_RUNTIME_KEY)
    .maybeSingle();

  const raw = data?.value as GhostShieldRuntimeStored | null;
  const prev = Array.isArray(raw?.patterns) ? raw!.patterns.filter((p) => typeof p === 'string') : [];
  const before = new Set(mergeUnique([...GHOST_SHIELD_DEFAULT_SOURCES], prev));
  let added = 0;
  for (const d of derived) {
    if (!before.has(d)) added++;
    before.add(d);
  }
  const merged = Array.from(before).slice(0, MAX_PATTERNS);

  const sources = Array.isArray(raw?.sources) ? raw!.sources.slice(-8) : [];
  sources.push(runId.slice(0, 48));

  await admin.from('legal_config').upsert({
    key: GHOST_SHIELD_RUNTIME_KEY,
    value: {
      patterns: merged,
      updatedAt: new Date().toISOString(),
      sources,
    } as GhostShieldRuntimeStored,
    base_language: 'en',
    updated_at: new Date().toISOString(),
  });

  g.shield = undefined;
  return { added, total: merged.length };
}

/**
 * Charge les regex (cache court). Utilisable depuis le middleware Edge.
 */
export async function loadGhostShieldRegexesCached(): Promise<RegExp[]> {
  const now = Date.now();
  if (g.shield && now - g.shield.at < CACHE_MS) {
    return g.shield.regexes;
  }

  let sources = [...GHOST_SHIELD_DEFAULT_SOURCES];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    try {
      const sb = createClient(url, key);
      const { data } = await sb
        .from('legal_config')
        .select('value')
        .eq('key', GHOST_SHIELD_RUNTIME_KEY)
        .maybeSingle();
      const v = data?.value as GhostShieldRuntimeStored | null;
      if (v && Array.isArray(v.patterns)) {
        for (const p of v.patterns) {
          if (typeof p === 'string' && p.length >= 4 && p.length <= MAX_PATTERN_LEN) {
            sources.push(p);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  sources = Array.from(new Set(sources)).slice(0, MAX_PATTERNS);
  const regexes = compileAll(sources);
  g.shield = { at: now, regexes };
  return regexes;
}

/**
 * true si la query string correspond à un motif (attaques courantes dans l’URL).
 */
export async function ghostShieldBlocksSearchParams(request: NextRequest): Promise<boolean> {
  const q = request.nextUrl.search;
  if (!q || q.length < 3) return false;
  let haystack = q.slice(1);
  try {
    haystack = decodeURIComponent(haystack);
  } catch {
    /* query mal formée : on teste la slice brute */
  }
  if (haystack.length > 40_000) return true;
  const regexes = await loadGhostShieldRegexesCached();
  return regexes.some((re) => re.test(haystack));
}
