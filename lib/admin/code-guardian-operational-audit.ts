import { createTranslator } from 'next-intl';

import { internalOpsMessageLocale } from '@/lib/admin/internal-ops-locale';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';

export type OperationalCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
};

export type OperationalAuditResult = {
  verdict: 'ok' | 'review';
  checks: OperationalCheck[];
  summary: string;
};

/**
 * « Cour suprême » — garde-fous statiques sur un patch proposé (sans exécution).
 * Complément possible : revue humaine + tests avant merge.
 */
export function runOperationalAuditOnProposal(
  code: string,
  contextNotes: string
): OperationalAuditResult {
  const locale = internalOpsMessageLocale();
  const messages = getServerMessagesForLocale(locale);
  const t = createTranslator({ locale, messages, namespace: 'Admin.codeGuardianOperational' });

  const ctx = contextNotes.trim();
  const checks: OperationalCheck[] = [];

  const evalDanger = /\beval\s*\(/.test(code) || /new\s+Function\s*\(/.test(code);
  checks.push({
    id: 'no-eval',
    label: t('checkNoEvalLabel'),
    ok: !evalDanger,
    detail: evalDanger ? t('checkNoEvalDetailFail') : undefined,
  });

  const childProc = /child_process|execSync|spawnSync/.test(code);
  checks.push({
    id: 'no-child',
    label: t('checkNoChildLabel'),
    ok: !childProc,
    detail: childProc ? t('checkNoChildDetailFail') : undefined,
  });

  if (/stripe|billing|checkout|subscription/i.test(ctx)) {
    const billingHints = /stripe|createClient|subscription|price|customer/i.test(code);
    checks.push({
      id: 'stripe',
      label: t('checkStripeLabel'),
      ok: billingHints,
      detail: billingHints ? undefined : t('checkStripeDetailFail'),
    });
  }

  if (/tailwind|design|UI|className/i.test(ctx)) {
    const tw = /\bclassName=/.test(code) || /\bcn\s*\(/.test(code);
    checks.push({
      id: 'tailwind',
      label: t('checkTailwindLabel'),
      ok: tw,
      detail: tw ? undefined : t('checkTailwindDetailFail'),
    });
  } else {
    checks.push({
      id: 'tailwind-na',
      label: t('checkTailwindNaLabel'),
      ok: true,
    });
  }

  const dhtml = /dangerouslySetInnerHTML/.test(code);
  checks.push({
    id: 'dhtml',
    label: t('checkDhtmlLabel'),
    ok:
      !dhtml ||
      /sanitize|DOMPurify|escapeHtml/i.test(code) ||
      /assume|trusted/i.test(ctx.toLowerCase()),
    detail: dhtml ? t('checkDhtmlDetailFail') : undefined,
  });

  const perfHint = /\.limit\s*\(/.test(code) || /unstable_cache|revalidate/i.test(code);
  if (/performance|cache|lent|requête/i.test(ctx)) {
    checks.push({
      id: 'perf',
      label: t('checkPerfLabel'),
      ok: perfHint,
      detail: perfHint ? undefined : t('checkPerfDetailFail'),
    });
  }

  const allOk = checks.every((c) => c.ok);
  return {
    verdict: allOk ? 'ok' : 'review',
    checks,
    summary: allOk ? t('summaryOk') : t('summaryReview'),
  };
}
