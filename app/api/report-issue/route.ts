import { NextResponse } from 'next/server';
import { canSendEmail, sendEmail } from '@/lib/resend';
import { checkContactRateLimit } from '@/lib/rate-limit';
import { apiJsonError } from '@/lib/api/api-error-response';

const SUPPORT_EMAIL = 'support@reputexa.fr';
const SENDER_FROM = process.env.RESEND_FROM ?? 'REPUTEXA | Support <contact@reputexa.fr>';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
  critical: 'Critique',
};

const BUG_TYPE_LABELS: Record<string, string> = {
  'ai-error': "Erreur d'analyse IA",
  'sync-issue': 'Problème de synchronisation',
  'ui-bug': "Bug d'interface",
  'billing-issue': 'Problème de facturation',
  other: 'Autre',
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(request: Request) {
  try {
    const { ok: rateOk } = checkContactRateLimit(request);
    if (!rateOk) {
      return apiJsonError(request, 'auth_rateLimit', 429);
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return apiJsonError(request, 'errors.reportIssue_invalidPayload', 400);
    }

    const { bugType, priority, title, description, steps, email } = body as Record<string, string>;

    if (!bugType || !priority || !title?.trim() || !description?.trim() || !email?.trim()) {
      return apiJsonError(request, 'errors.reportIssue_allFieldsRequired', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiJsonError(request, 'auth_magicLink_invalidEmail', 400);
    }

    if (!canSendEmail()) {
      return apiJsonError(request, 'errors.resendNotConfigured', 503);
    }

    const priorityLabel = PRIORITY_LABELS[priority] ?? priority;
    const bugTypeLabel = BUG_TYPE_LABELS[bugType] ?? bugType;

    const priorityColor =
      priority === 'critical' ? '#ef4444' :
      priority === 'high' ? '#f97316' :
      priority === 'medium' ? '#f59e0b' : '#6b7280';

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
        <div style="background:#0B1221;padding:24px 32px;border-radius:12px 12px 0 0;">
          <span style="font-size:16px;font-weight:800;letter-spacing:0.08em;color:#ffffff;text-transform:uppercase;">REPUTEXA</span>
          <span style="font-size:12px;color:#64748b;margin-left:12px;">· Rapport de bug</span>
        </div>
        <div style="height:3px;background:linear-gradient(90deg,#2563eb,#3b82f6);"></div>
        <div style="padding:28px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr>
              <td style="width:50%;padding:8px 12px;background:#f8fafc;border-radius:8px;">
                <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Type</p>
                <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#1e293b;">${escapeHtml(bugTypeLabel)}</p>
              </td>
              <td style="width:8px;"></td>
              <td style="width:50%;padding:8px 12px;background:#f8fafc;border-radius:8px;">
                <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Priorité</p>
                <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:${priorityColor};">${escapeHtml(priorityLabel)}</p>
              </td>
            </tr>
          </table>

          <h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(title)}</h2>
          <p style="margin:0 0 4px;font-size:13px;color:#64748b;">
            Signalé par : <a href="mailto:${escapeHtml(email)}" style="color:#2563eb;">${escapeHtml(email)}</a>
          </p>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />

          <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Description</p>
          <p style="margin:0 0 20px;font-size:14px;color:#334155;white-space:pre-wrap;background:#f8fafc;padding:12px 16px;border-radius:8px;line-height:1.6;">${escapeHtml(description)}</p>

          ${steps?.trim() ? `
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Étapes pour reproduire</p>
          <p style="margin:0;font-size:14px;color:#334155;white-space:pre-wrap;background:#f8fafc;padding:12px 16px;border-radius:8px;line-height:1.6;">${escapeHtml(steps)}</p>
          ` : ''}
        </div>
      </div>
    `;

    const { success, error } = await sendEmail({
      from: SENDER_FROM,
      to: SUPPORT_EMAIL,
      replyTo: email,
      subject: `[Bug ${priorityLabel}] ${title}`,
      html,
    });

    if (!success) {
      console.error('[report-issue] Send failed:', JSON.stringify(error, null, 2));
      return apiJsonError(request, 'errors.reportIssue_emailSendFailed', 500, {
        supportEmail: SUPPORT_EMAIL,
      });
    }

    console.log(`[report-issue] Bug report submitted by ${email} — priority: ${priority}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[report-issue] Unexpected error:', err);
    return apiJsonError(request, 'errors.reportIssue_genericError', 500);
  }
}
