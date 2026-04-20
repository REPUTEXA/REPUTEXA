import type { SupabaseClient } from '@supabase/supabase-js';
import { sendAiQuotaWarningEmail } from '@/lib/emails/ai-quota-warning-email';

export type LlmConsumeOk = {
  allowed: true;
  count: number;
  softLimit: number;
  hardLimit: number;
  softExceeded: boolean;
};

export type LlmConsumeBlocked = {
  allowed: false;
  count: number;
  hardLimit: number;
};

export type LlmConsumeResult = LlmConsumeOk | LlmConsumeBlocked;

function envInt(name: string, fallback: number): number {
  const v = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export type LlmBudgetRowPreview = {
  period_start?: string | null;
  call_count?: number | null;
  daily_soft_limit?: number | null;
  daily_hard_limit?: number | null;
};

/**
 * Compteur affichable (jour UTC courant) — même logique que consumeLlmBudgetUnit.
 */
export function getEffectiveLlmBudgetDisplay(row: LlmBudgetRowPreview | null): {
  count: number;
  softLimit: number;
  hardLimit: number;
} {
  const softDefault = envInt('AI_LLM_DAILY_SOFT_DEFAULT', 400);
  const hardDefault = envInt('AI_LLM_DAILY_HARD_DEFAULT', 7000);
  const dayStart = utcDayStartIso();

  if (!row) {
    return { count: 0, softLimit: softDefault, hardLimit: hardDefault };
  }

  const periodStart = typeof row.period_start === 'string' ? row.period_start : dayStart;
  let count = typeof row.call_count === 'number' ? row.call_count : 0;
  let soft = typeof row.daily_soft_limit === 'number' ? row.daily_soft_limit : softDefault;
  let hard = typeof row.daily_hard_limit === 'number' ? row.daily_hard_limit : hardDefault;
  soft = Math.max(1, soft);
  hard = Math.max(soft + 1, hard);

  if (new Date(periodStart).getTime() < new Date(dayStart).getTime()) {
    count = 0;
  }

  return { count, softLimit: soft, hardLimit: hard };
}

function utcDayStartIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

/**
 * Incrémente le compteur LLM du jour (UTC) et refuse si plafond dur dépassé.
 * Appeler uniquement après auth, juste avant un appel facturable OpenAI/Anthropic.
 */
export async function consumeLlmBudgetUnit(
  admin: SupabaseClient,
  userId: string
): Promise<LlmConsumeResult> {
  const softDefault = envInt('AI_LLM_DAILY_SOFT_DEFAULT', 400);
  const hardDefault = envInt('AI_LLM_DAILY_HARD_DEFAULT', 7000);

  const { data: row, error: readErr } = await admin
    .from('ai_llm_usage_budget')
    .select('period_start, call_count, daily_soft_limit, daily_hard_limit, quota_warn_utc_day')
    .eq('user_id', userId)
    .maybeSingle();

  if (readErr) {
    console.error('[ai_llm_budget] read', readErr);
    return {
      allowed: true,
      count: 0,
      softLimit: softDefault,
      hardLimit: hardDefault,
      softExceeded: false,
    };
  }

  const dayStart = utcDayStartIso();
  const todayKey = dayStart.slice(0, 10);
  let periodStart = typeof row?.period_start === 'string' ? row.period_start : dayStart;
  let count = typeof row?.call_count === 'number' ? row.call_count : 0;
  let soft = typeof row?.daily_soft_limit === 'number' ? row.daily_soft_limit : softDefault;
  let hard = typeof row?.daily_hard_limit === 'number' ? row.daily_hard_limit : hardDefault;
  let quotaWarnUtcDay =
    typeof row?.quota_warn_utc_day === 'string' && row.quota_warn_utc_day.trim()
      ? row.quota_warn_utc_day.trim()
      : null;

  soft = Math.max(1, soft);
  hard = Math.max(soft + 1, hard);

  if (!row || new Date(periodStart).getTime() < new Date(dayStart).getTime()) {
    count = 0;
    periodStart = dayStart;
    quotaWarnUtcDay = null;
  }

  if (count >= hard) {
    return { allowed: false, count, hardLimit: hard };
  }

  const nextCount = count + 1;
  const warnThreshold = Math.max(soft + 1, Math.ceil(hard * 0.9));
  const shouldWarn = nextCount >= warnThreshold && quotaWarnUtcDay !== todayKey;
  const nextQuotaWarn = shouldWarn ? todayKey : quotaWarnUtcDay;

  if (shouldWarn) {
    void sendAiQuotaWarningEmail(userId, { used: nextCount, soft, hard }).catch(() => undefined);
  }

  const { error: upErr } = await admin.from('ai_llm_usage_budget').upsert(
    {
      user_id: userId,
      period_start: periodStart,
      call_count: nextCount,
      daily_soft_limit: soft,
      daily_hard_limit: hard,
      quota_warn_utc_day: nextQuotaWarn,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (upErr) {
    console.error('[ai_llm_budget] upsert', upErr);
  }

  return {
    allowed: true,
    count: nextCount,
    softLimit: soft,
    hardLimit: hard,
    softExceeded: nextCount > soft,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Bridage léger au-delà du soft (sans bloquer). */
export async function maybeThrottleAfterSoftExceeded(softExceeded: boolean): Promise<void> {
  if (softExceeded) {
    const ms = envInt('AI_LLM_SOFT_THROTTLE_MS', 900);
    await delay(Math.min(5000, Math.max(0, ms)));
  }
}
