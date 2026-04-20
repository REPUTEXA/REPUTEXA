import { Resend } from 'resend';
import { getInterfaceEmailSenderDefault } from '@/src/lib/empire-settings';

const apiKey = process.env.RESEND_API_KEY;

/** Expéditeur par défaut : `RESEND_FROM` ou `interface.email_sender_default` dans `targets/settings.json`. */
export const DEFAULT_FROM = process.env.RESEND_FROM ?? getInterfaceEmailSenderDefault();
const from = DEFAULT_FROM;

export const resend = apiKey ? new Resend(apiKey) : null;

export function canSendEmail(): boolean {
  return Boolean(apiKey && resend);
}

export type EmailAttachment = {
  filename: string;
  content: Buffer | Uint8Array | string;
  contentType?: string;
};

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}) {
  if (!resend) {
    console.warn('[Resend] RESEND_API_KEY not set, email not sent');
    return { success: false, error: 'Resend not configured' };
  }
  const { data, error } = await resend.emails.send({
    from: params.from ?? from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    replyTo: params.replyTo,
    attachments: params.attachments?.map((a) => {
      const buf = Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content);
      return {
        filename: a.filename,
        content: buf.toString('base64'),
        contentType: a.contentType,
      };
    }),
  });
  if (error) {
    console.error('[Resend]', error);
    return { success: false, error };
  }
  console.log('[Resend] Email sent to', params.to, 'subject:', params.subject);
  return { success: true, data };
}
