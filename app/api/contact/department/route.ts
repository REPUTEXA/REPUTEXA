import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { canSendEmail, sendEmail } from '@/lib/resend';
import { checkContactRateLimit } from '@/lib/rate-limit';
import { expandInterfaceTemplate, getEmpireSettings, getResendVerifiedBaseAddress } from '@/src/lib/empire-settings';

function departmentEmails(): Record<string, string> {
  return getEmpireSettings().interface.department_emails as Record<string, string>;
}

function departmentLabels(): Record<string, string> {
  return getEmpireSettings().interface.department_labels as Record<string, string>;
}

function departmentFromTemplates(): Record<string, string> {
  return getEmpireSettings().interface.department_from_display_templates as Record<string, string>;
}

/** Base technical address that is verified with Resend */
function baseAddress(): string {
  return process.env.RESEND_FROM_ADDRESS ?? getResendVerifiedBaseAddress();
}

function buildSenderFrom(department: string): string {
  const iface = getEmpireSettings().interface;
  const tpl =
    departmentFromTemplates()[department] ?? iface.department_fallback_from_display;
  const displayName = expandInterfaceTemplate(tpl);
  return `${displayName} <${baseAddress()}>`;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

export async function POST(request: Request) {
  try {
    const { ok: rateOk } = checkContactRateLimit(request);
    if (!rateOk) {
      return apiJsonError(request, 'errors.contactRateLimited', 429);
    }

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return apiJsonError(request, 'errors.multipartRequired', 400);
    }

    const form = await request.formData().catch(() => null);
    if (!form) {
      return apiJsonError(request, 'errors.invalidForm', 400);
    }

    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    const message = String(form.get('message') ?? '').trim();
    const department = String(form.get('department') ?? '').trim().toLowerCase();
    const extraFieldsRaw = String(form.get('extraFields') ?? '{}');

    if (!name || !email || !message || !department) {
      return apiJsonError(request, 'errors.contactFieldsRequired', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiJsonError(request, 'errors.invalidEmail', 400);
    }

    const toEmail = departmentEmails()[department];
    if (!toEmail) {
      return apiJsonError(request, 'errors.departmentUnknown', 400);
    }

    let extraFields: Record<string, string> = {};
    try {
      const parsed = JSON.parse(extraFieldsRaw);
      if (parsed && typeof parsed === 'object') extraFields = parsed;
    } catch {
      extraFields = {};
    }

    // Optional attachments (careers mainly, max 3 files)
    const rawFiles = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    const attachments: { filename: string; content: Buffer; contentType: string }[] = [];

    for (const file of rawFiles.slice(0, 3)) {
      if (file.size > MAX_FILE_SIZE) continue;
      const mime = (file.type ?? '').toLowerCase();
      if (!ALLOWED_TYPES.some((t) => mime === t)) continue;
      const buf = Buffer.from(await file.arrayBuffer());
      attachments.push({
        filename: sanitizeFilename(file.name),
        content: buf,
        contentType: file.type,
      });
    }

    if (!canSendEmail()) {
      return apiJsonError(request, 'errors.departmentContactUnavailable', 503, { email: toEmail });
    }

    const departmentLabel = departmentLabels()[department] ?? department;
    const senderFrom = buildSenderFrom(department);

    const extraRows = Object.entries(extraFields)
      .filter(([, v]) => v?.trim())
      .map(([k, v]) => `<p><strong>${escapeHtml(k)} :</strong> ${escapeHtml(v)}</p>`)
      .join('\n');

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb; margin-bottom: 1.5rem;">
          Nouveau message — Département ${escapeHtml(departmentLabel)}
        </h2>
        <p><strong>Nom :</strong> ${escapeHtml(name)}</p>
        <p><strong>Email :</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
        ${extraRows}
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0;" />
        <p><strong>Message :</strong></p>
        <p style="white-space: pre-wrap; background: #f8fafc; padding: 1rem; border-radius: 8px; line-height: 1.6;">${escapeHtml(message)}</p>
        ${
          attachments.length > 0
            ? `<p style="margin-top: 1rem; color: #64748b;">
                <strong>Pièces jointes :</strong> ${attachments.map((a) => escapeHtml(a.filename)).join(', ')}
               </p>`
            : ''
        }
      </div>
    `;

    console.log(
      `[contact/department] Sending from="${senderFrom}" to="${toEmail}" replyTo="${email}" department="${department}"`
    );

    const { success, error } = await sendEmail({
      from: senderFrom,
      to: toEmail,
      replyTo: email,
      subject: expandInterfaceTemplate(
        getEmpireSettings().interface.department_message_subject_template,
        { department: departmentLabel, name }
      ),
      html,
      attachments:
        attachments.length > 0
          ? attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              contentType: a.contentType,
            }))
          : undefined,
    });

    if (!success) {
      console.error('[contact/department] Resend error — department:', department);
      console.error('[contact/department] from:', senderFrom);
      console.error('[contact/department] to:', toEmail);
      console.error('[contact/department] replyTo:', email);
      console.error('[contact/department] error object:', JSON.stringify(error, null, 2));
      return apiJsonError(request, 'errors.departmentContactSendFailed', 500, { email: toEmail });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[contact/department] Unexpected exception:', err);
    return apiJsonError(request, 'errors.contactGenericError', 500);
  }
}
