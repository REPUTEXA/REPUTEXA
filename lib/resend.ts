import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM ?? 'REPUTEXA <onboarding@resend.dev>';

export const resend = apiKey ? new Resend(apiKey) : null;

export function canSendEmail(): boolean {
  return Boolean(apiKey && resend);
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
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
  });
  if (error) {
    console.error('[Resend]', error);
    return { success: false, error };
  }
  return { success: true, data };
}
