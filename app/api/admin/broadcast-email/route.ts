import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, canSendEmail } from '@/lib/resend';
import { generateText, hasAiConfigured } from '@/lib/ai-service';
import { scrubAiTypography } from '@/lib/ai/human-keyboard-output';
import {
  type LocalePack,
  fingerprintFrMaster,
  signBroadcastSendToken,
  verifyBroadcastSendToken,
} from '@/lib/admin/broadcast-email-token';
import { getInfoBroadcastEmailHtml } from '@/lib/emails/info-broadcast-email';
import {
  executeBroadcastSendAll,
  translateFrToAllPacks,
} from '@/lib/admin/broadcast-email-send-all';
import { validateBroadcastScheduleAt } from '@/lib/legal/dates';
import { appendProductContextSection } from '@/lib/admin/product-ai-context';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

type Action = 'format_raw' | 'improve' | 'translate' | 'test_send' | 'send_all' | 'schedule';

function unauthorized() {
  const t = apiAdminT();
  return NextResponse.json({ error: t('unauthorized') }, { status: 401 });
}

function stripAiFence(text: string): string {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  }
  return t.trim();
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return unauthorized();
  }

  const ta = apiAdminT();

  let body: {
    action: Action;
    rawMessage?: string;
    subjectFr?: string;
    htmlFr?: string;
    aiInstruction?: string;
    packs?: Partial<Record<string, LocalePack>>;
    unlockToken?: string;
    fingerprint?: string;
    scheduled_at?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: ta('broadcastInvalidJson') }, { status: 400 });
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.fr').replace(
    /\/$/,
    ''
  );

  if (body.action === 'format_raw') {
    const raw = body.rawMessage?.trim() ?? '';
    if (!raw) {
      return NextResponse.json({ error: ta('broadcastTextRequired') }, { status: 400 });
    }
    if (!hasAiConfigured()) {
      return NextResponse.json({ error: ta('broadcastNoAiKey') }, { status: 503 });
    }
    const extra = body.aiInstruction?.trim() || '';
    const extraBlock = extra ? `\nConsignes supplémentaires : ${extra}` : '';
    const promptUser = appendProductContextSection(
      ta('broadcastFormatRawUserPrompt', { raw, extra: extraBlock }),
      10_000
    );

    try {
      const rawOut = await generateText({
        systemPrompt: ta('broadcastFormatRawSystemPrompt'),
        userContent: promptUser,
        temperature: 0.45,
        maxTokens: 8192,
        anthropicModel: process.env.LEGAL_ANTHROPIC_MODEL?.trim() || undefined,
      });
      const cleaned = stripAiFence(rawOut);
      const j = JSON.parse(cleaned) as { subject?: string; html?: string };
      const subjectFr = scrubAiTypography((j.subject ?? '').trim());
      const htmlFr = scrubAiTypography((j.html ?? '').trim());
      if (!subjectFr || !htmlFr) {
        return NextResponse.json({ error: ta('broadcastAiIncomplete') }, { status: 502 });
      }
      return NextResponse.json({ subjectFr, htmlFr });
    } catch (e) {
      const msg = e instanceof Error ? e.message : ta('broadcastAiErrorGeneric');
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (body.action === 'improve') {
    const htmlFr = body.htmlFr?.trim() ?? '';
    if (!htmlFr) {
      return NextResponse.json({ error: ta('broadcastHtmlFrRequired') }, { status: 400 });
    }
    if (!hasAiConfigured()) {
      return NextResponse.json({ error: ta('broadcastNoAiKey') }, { status: 503 });
    }
    const instruction = body.aiInstruction?.trim() || ta('broadcastImproveDefaultInstruction');
    const subjectFr = body.subjectFr?.trim() ?? '';
    const subjectLine = subjectFr
      ? ta('broadcastImproveSubjectCurrentLine', { subject: subjectFr })
      : ta('broadcastImproveSubjectDraftHint');

    const promptUser = appendProductContextSection(
      ta('broadcastImproveUserPrompt', { subjectLine, htmlFr, instruction }),
      10_000
    );

    try {
      const raw = await generateText({
        systemPrompt: ta('broadcastImproveSystemPrompt'),
        userContent: promptUser,
        temperature: 0.5,
        maxTokens: 8192,
        anthropicModel: process.env.LEGAL_ANTHROPIC_MODEL?.trim() || undefined,
      });
      const cleaned = stripAiFence(raw);
      const j = JSON.parse(cleaned) as { subject?: string; html?: string };
      const subject = scrubAiTypography((j.subject ?? subjectFr).trim());
      const html = scrubAiTypography((j.html ?? htmlFr).trim());
      return NextResponse.json({ subjectFr: subject, htmlFr: html });
    } catch (e) {
      const msg = e instanceof Error ? e.message : ta('broadcastAiErrorGeneric');
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (body.action === 'translate') {
    const htmlFr = body.htmlFr?.trim() ?? '';
    const subjectFr = body.subjectFr?.trim() ?? '';
    if (!htmlFr || !subjectFr) {
      return NextResponse.json({ error: ta('broadcastSubjectHtmlRequired') }, { status: 400 });
    }
    if (!hasAiConfigured()) {
      return NextResponse.json({ error: ta('broadcastNoAiKey') }, { status: 503 });
    }

    try {
      const packs = await translateFrToAllPacks(subjectFr, htmlFr);
      return NextResponse.json({ packs });
    } catch (e) {
      const msg = e instanceof Error ? e.message : ta('broadcastTranslationError');
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (body.action === 'test_send') {
    if (!canSendEmail()) {
      return NextResponse.json({ error: ta('broadcastResendNotConfiguredShort') }, { status: 503 });
    }
    const adminTo = process.env.ADMIN_EMAIL?.trim();
    if (!adminTo) {
      return NextResponse.json({ error: ta('broadcastAdminEmailMissing') }, { status: 503 });
    }

    const subjectFr =
      body.subjectFr?.trim() ??
      (body.packs?.fr?.subject?.trim() || '');
    const htmlFr =
      body.htmlFr?.trim() ??
      (body.packs?.fr?.html?.trim() || '');

    if (!subjectFr || !htmlFr) {
      return NextResponse.json({ error: ta('broadcastSubjectBodyRequired') }, { status: 400 });
    }

    const fp = fingerprintFrMaster(subjectFr, htmlFr);
    const dashUrl = `${siteUrl}/fr/dashboard`;
    const html = getInfoBroadcastEmailHtml({
      locale: 'fr',
      title: subjectFr,
      bodyHtml: htmlFr,
      recipientName: undefined,
      dashboardUrl: dashUrl,
    });
    const r = await sendEmail({
      to: adminTo,
      subject: ta('broadcastPreviewSubjectPrefix', { subject: subjectFr }),
      html,
    });
    if (!r.success) {
      const errMsg = r.error != null ? JSON.stringify(r.error) : ta('broadcastPreviewSendFailed');
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    const unlockToken = signBroadcastSendToken(fp);
    return NextResponse.json({ success: true, fingerprint: fp, unlockToken });
  }

  if (body.action === 'send_all') {
    if (!canSendEmail()) {
      return NextResponse.json({ error: ta('broadcastResendNotConfigured') }, { status: 503 });
    }

    const subjectFr =
      body.subjectFr?.trim() ??
      (body.packs?.fr?.subject?.trim() || '');
    const htmlFr =
      body.htmlFr?.trim() ??
      (body.packs?.fr?.html?.trim() || '');

    if (!subjectFr || !htmlFr) {
      return NextResponse.json({ error: ta('broadcastSubjectBodyFrRequired') }, { status: 400 });
    }

    const fp = fingerprintFrMaster(subjectFr, htmlFr);
    if (!body.unlockToken || !verifyBroadcastSendToken(body.unlockToken, fp)) {
      return NextResponse.json(
        { error: ta('broadcastUnlockTokenInvalid') },
        { status: 403 }
      );
    }
    if (body.fingerprint && body.fingerprint !== fp) {
      return NextResponse.json({ error: ta('broadcastFingerprintMismatch') }, { status: 400 });
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: ta('broadcastSupabaseNotConfigured') }, { status: 500 });
    }

    try {
      const { emailsSent, emailsFailed, totalUsers } = await executeBroadcastSendAll(supabase, subjectFr, htmlFr);
      console.log(`[broadcast-email] send_all — ${emailsSent} ok, ${emailsFailed} fail / ${totalUsers}`);
      return NextResponse.json({
        success: true,
        emailsSent,
        emailsFailed,
        totalUsers,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : ta('broadcastSendFailed');
      console.error('[broadcast-email] send_all', e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (body.action === 'schedule') {
    const subjectFr = body.subjectFr?.trim() ?? '';
    const htmlFr = body.htmlFr?.trim() ?? '';
    const scheduledRaw = body.scheduled_at?.trim() ?? '';

    if (!subjectFr || !htmlFr) {
      return NextResponse.json({ error: ta('broadcastSubjectBodyRequired') }, { status: 400 });
    }
    const schedVal = validateBroadcastScheduleAt(scheduledRaw);
    if (!schedVal.ok) {
      return NextResponse.json({ error: schedVal.error }, { status: 400 });
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: ta('broadcastSupabaseNotConfigured') }, { status: 500 });
    }

    const fp = fingerprintFrMaster(subjectFr, htmlFr);
    const { data: row, error: insErr } = await supabase
      .from('admin_broadcast_scheduled')
      .insert({
        subject_fr: subjectFr,
        html_fr: htmlFr,
        fingerprint: fp,
        scheduled_at: new Date(scheduledRaw).toISOString(),
        status: 'pending',
      })
      .select('id, scheduled_at')
      .single();

    if (insErr) {
      if (String(insErr.message).includes('admin_broadcast_scheduled')) {
        return NextResponse.json(
          { error: ta('broadcastScheduleTableMissing') },
          { status: 503 }
        );
      }
      console.error('[broadcast-email] schedule', insErr);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      id: row?.id,
      scheduled_at: row?.scheduled_at,
    });
  }

  return NextResponse.json({ error: ta('broadcastInvalidAction') }, { status: 400 });
}
