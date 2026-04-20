import { readFile } from 'fs/promises';
import path from 'path';

/** Fichier terminologique / contexte produit (chemin relatif au repo). */
export const DEFAULT_BABEL_PRODUCT_CONTEXT_REL = 'lib/generated/product-ai-context.txt';

/** Repli si le fichier généré est absent : même nom à la racine du dépôt. */
export const FALLBACK_BABEL_PRODUCT_CONTEXT_REL = 'product-ai-context.txt';

let cachedProductContext = '';
/** Clé de cache : env explicite ou résolution par défaut (fichier généré puis racine). */
let cachedProductContextKey = '';

/**
 * Charge `product-ai-context.txt` (ou `BABEL_PRODUCT_CONTEXT_PATH`) une fois par processus.
 * En cas d’absence de fichier, chaîne vide (le pipeline continue).
 */
export async function loadProductAiContextForBabel(): Promise<string> {
  const envPath = process.env.BABEL_PRODUCT_CONTEXT_PATH?.trim();
  const cacheKey = envPath && envPath !== '' ? `env:${envPath}` : '__default_try_generated_then_root__';
  if (cachedProductContextKey === cacheKey) {
    return cachedProductContext;
  }
  const tryPaths =
    envPath != null && envPath !== ''
      ? [envPath]
      : [DEFAULT_BABEL_PRODUCT_CONTEXT_REL, FALLBACK_BABEL_PRODUCT_CONTEXT_REL];
  let raw = '';
  for (const p of tryPaths) {
    try {
      raw = await readFile(path.join(process.cwd(), p), 'utf8');
      break;
    } catch {
      /* essai suivant */
    }
  }
  cachedProductContextKey = cacheKey;
  const max = Number(process.env.BABEL_PRODUCT_CONTEXT_MAX_CHARS?.trim()) || 48_000;
  cachedProductContext =
    raw.length === 0
      ? ''
      : raw.length <= max
        ? raw
        : `${raw.slice(0, max)}\n\n[… contexte tronqué pour limite de prompt]`;
  return cachedProductContext;
}

/**
 * Consigne persona « Native-Perfect » (ton luxe CHR) — injectée dans les prompts Babel messages / wizard.
 */
export const BABEL_MAJORDOME_PERSONA_FR = `Tu es un Majordome de luxe natif. Ton ton est formel, élégant et expert. Évite le mot-à-mot, privilégie les expressions idiomatiques du secteur CHR (Café, Hôtel, Restaurant).`;
