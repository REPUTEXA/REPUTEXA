import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { canSendEmail, sendEmail, DEFAULT_FROM } from '@/lib/resend';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkContactRateLimit } from '@/lib/rate-limit';
import {
  getContactEmailSubjectPrefix,
  getContactFallbackSupportEmail,
  getContactHtmlHeading,
  getContactInboxEmail,
} from '@/src/lib/empire-settings';

const CONTACT_EMAIL = getContactInboxEmail();
const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_TOTAL_SIZE = 35 * 1024 * 1024; // 35MB (Resend max 40MB after base64)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 100);
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
    const subject = String(form.get('subject') ?? '').trim();
    const message = String(form.get('message') ?? '').trim();

    if (!name || !email || !subject || !message) {
      return apiJsonError(request, 'errors.contactFieldsRequired', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiJsonError(request, 'errors.invalidEmail', 400);
    }

    // Récupérer les pièces jointes
    const rawFiles = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    if (rawFiles.length > MAX_FILES) {
      return apiJsonError(request, 'errors.contactMaxFiles', 400, { count: MAX_FILES });
    }

    const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
    let totalSize = 0;
    const allowedTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

    for (const file of rawFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return apiJsonError(request, 'errors.contactFileExceeds25Mb', 400, { name: file.name });
      }
      totalSize += file.size;
      if (totalSize > MAX_TOTAL_SIZE) {
        return apiJsonError(request, 'errors.attachmentTooLarge', 400);
      }
      const mime = (file.type || '').toLowerCase();
      if (!allowedTypes.some((t) => mime.includes(t.split('/')[1]))) {
        return apiJsonError(request, 'errors.contactAttachmentTypeInvalid', 400, { name: file.name });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      attachments.push({
        filename: sanitizeFilename(file.name),
        content: buf,
        contentType: file.type || 'application/octet-stream',
      });
    }

    if (!canSendEmail()) {
      return apiJsonError(request, 'errors.genericContactUnavailable', 503);
    }

    const contactId = crypto.randomUUID();
    const supabase = createAdminClient();
    const storagePaths: string[] = [];

    if (supabase && attachments.length > 0) {
      for (let i = 0; i < attachments.length; i++) {
        const a = attachments[i];
        const ext = a.filename.split('.').pop() || 'bin';
        const path = `${contactId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('contact-attachments')
          .upload(path, a.content, {
            contentType: a.contentType,
            upsert: false,
          });
        if (!uploadErr) {
          storagePaths.push(path);
        }
      }
    }

    if (supabase) {
      const { error: insertErr } = await supabase.from('contact_messages').insert({
        id: contactId,
        name,
        email,
        subject,
        message,
        attachment_paths: storagePaths,
      });
      if (insertErr) {
        console.error('[contact] DB insert error:', insertErr);
      }
    }

    const heading = escapeHtml(getContactHtmlHeading());

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">${heading}</h2>
        <p><strong>Nom :</strong> ${escapeHtml(name)}</p>
        <p><strong>Email :</strong> ${escapeHtml(email)}</p>
        <p><strong>Sujet :</strong> ${escapeHtml(subject)}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0;" />
        <p><strong>Message :</strong></p>
        <p style="white-space: pre-wrap; background: #f8fafc; padding: 1rem; border-radius: 8px;">${escapeHtml(message)}</p>
        ${attachments.length > 0 ? `<p style="margin-top: 1rem; color: #64748b;"><strong>Pièces jointes :</strong> ${attachments.map((a) => escapeHtml(a.filename)).join(', ')}</p>` : ''}
      </div>
    `;

    const { success, error } = await sendEmail({
      from: DEFAULT_FROM,
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `${getContactEmailSubjectPrefix()} ${subject}`,
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
      console.error('[contact] Envoi échoué:', error);
      return NextResponse.json(
        {
          error:
            "Une erreur est survenue lors de l'envoi. Réessayez ou contactez-nous à contact@reputexa.fr.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[contact]', err);
    return apiJsonError(request, 'errors.contactGenericError', 500);
  }
}
