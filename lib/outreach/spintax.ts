/**
 * Développe des blocs {a|b|c} — utile pour des variantes de formulation
 * (contenu toujours conforme à vos obligations légales / opt-in).
 */
export function expandSpintax(template: string, rng: () => number = Math.random): string {
  let out = template;
  let depth = 0;
  while (out.includes('{') && depth < 50) {
    depth += 1;
    out = out.replace(/\{([^{}]+)\}/, (_, inner: string) => {
      const opts = inner.split('|').map((s) => s.trim()).filter(Boolean);
      if (opts.length === 0) return '';
      const i = Math.floor(rng() * opts.length);
      return opts[i] ?? '';
    });
  }
  return out;
}
