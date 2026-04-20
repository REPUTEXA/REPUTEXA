import { createTranslator } from 'next-intl';
import { NextRequest, NextResponse } from 'next/server';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { localeForGrandCentralRequest } from '@/lib/admin/grand-central-locale';

function adminT(locale: string) {
  const messages = getServerMessagesForLocale(locale);
  return createTranslator({ locale, messages, namespace: 'Admin' });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Page 403 humaine lorsque le mur IP Grand Central bloque une navigation.
 */
export function grandCentralIpBlockedPageResponse(request: NextRequest): NextResponse {
  const locale = localeForGrandCentralRequest(request);
  const t = adminT(locale);
  const home = `/${locale}`;
  const title = t('grandCentral.ipBlockedTitle');
  const lead = t('grandCentral.ipBlockedLead');
  const hint = t('grandCentral.ipBlockedHint');
  const footer = t('grandCentral.ipBlockedFooter');
  const back = t('grandCentral.ipBlockedBackLink');
  const badge = t('grandCentral.badge');

  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="robots" content="noindex,nofollow"/>
  <title>${escapeHtml(title)} — REPUTEXA</title>
  <style>
    :root { color-scheme: dark; }
    body { margin:0; min-height:100vh; font-family: ui-sans-serif, system-ui, sans-serif;
      background: radial-gradient(1200px at 20% -20%, #1e3a5f 0%, #0a0a0b 45%, #030303 100%);
      color: #e4e4e7; display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { max-width: 420px; width: 100%; padding: 28px 24px; border-radius: 16px;
      border: 1px solid rgba(59, 130, 246, 0.25); background: rgba(9, 9, 11, 0.85);
      box-shadow: 0 20px 50px rgba(0,0,0,0.45); backdrop-filter: blur(12px); }
    .badge { display:inline-block; font-size: 10px; font-weight: 700; letter-spacing: .12em;
      text-transform: uppercase; color: #93c5fd; border: 1px solid rgba(59,130,246,.4);
      padding: 4px 10px; border-radius: 999px; margin-bottom: 14px; }
    h1 { font-size: 1.25rem; font-weight: 700; margin: 0 0 12px; letter-spacing: -0.02em; }
    p { font-size: 0.875rem; line-height: 1.55; color: #a1a1aa; margin: 0 0 12px; }
    .code { font-family: ui-monospace, monospace; font-size: 11px; color: #71717a; margin-top: 16px; }
    a { color: #93c5fd; text-decoration: none; font-weight: 600; font-size: 0.875rem; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">${escapeHtml(badge)}</span>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(lead)}</p>
    <p>${escapeHtml(hint)}</p>
    <p class="code">${escapeHtml(footer)}</p>
    <p style="margin-top:20px"><a href="${escapeHtml(home)}">${escapeHtml(back)}</a></p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 403,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function grandCentralIpBlockedApiResponse(request: NextRequest): NextResponse {
  const locale = localeForGrandCentralRequest(request);
  const t = adminT(locale);
  return NextResponse.json(
    {
      error: 'Forbidden',
      code: 'GRAND_CENTRAL_IP',
      message: t('grandCentral.ipBlockedApiMessage'),
    },
    {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
