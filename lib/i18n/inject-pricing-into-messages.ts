import { expandPricingTokensInString } from '@/lib/i18n/pricing-message-format';

function walk(node: unknown, locale: string): unknown {
  if (typeof node === 'string') {
    return expandPricingTokensInString(node, locale);
  }
  if (Array.isArray(node)) {
    return node.map((x) => walk(x, locale));
  }
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = walk(v, locale);
    }
    return out;
  }
  return node;
}

export function injectPricingIntoMessages<T>(messages: T, locale: string): T {
  return walk(messages, locale) as T;
}
