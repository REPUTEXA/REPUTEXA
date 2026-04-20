/** Clé `Api.errors.ia.*` pour les échecs appel OpenAI (quota, saturation, panne). */

export type OpenAiIaFailureKey = 'quotaOrRateLimit' | 'providerTemporaryError';

export function classifyOpenAiIaFailure(err: unknown): OpenAiIaFailureKey {
  const e = err as { status?: number; code?: string; message?: string } | null | undefined;
  const status = e?.status;
  const code = e?.code;
  if (status === 429) return 'quotaOrRateLimit';
  if (code === 'insufficient_quota' || code === 'rate_limit_exceeded') return 'quotaOrRateLimit';
  const msg = (e?.message ?? String(err)).toLowerCase();
  if (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('too many requests')
  ) {
    return 'quotaOrRateLimit';
  }
  return 'providerTemporaryError';
}
