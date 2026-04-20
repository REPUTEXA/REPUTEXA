/**
 * POST /api/newsletter/broadcast
 * Sends the latest blog article to the Resend audience (name from `interface.resend_newsletter_audience_name` or env).
 * Called by /api/cron/newsletter after article generation.
 * Protected by CRON_SECRET.
 */

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { apiJsonError } from '@/lib/api/api-error-response';
import { newsletterSenderStrategic, newsletterSiteUrl } from '@/lib/emails/newsletter-route-settings';
import { getBrandName } from '@/src/lib/empire-settings';
import * as fs from 'fs';
import * as path from 'path';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const AUDIENCE_ID = process.env.RESEND_NEWSLETTER_AUDIENCE_ID ?? '';

type ArticleMeta = {
  title: string;
  slug: string;
  excerpt: string;
  date: string;
  readTime: string;
};

function parseLatestArticle(): ArticleMeta | null {
  const contentDir = path.join(process.cwd(), 'content', 'blog');
  if (!fs.existsSync(contentDir)) return null;

  const files = fs
    .readdirSync(contentDir)
    .filter((f) => f.endsWith('.mdx'))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const raw = fs.readFileSync(path.join(contentDir, files[0]), 'utf-8');

  const get = (key: string): string => {
    const match = raw.match(new RegExp(`^${key}:\\s*"?([^"\\n]+)"?`, 'm'));
    return match?.[1]?.trim() ?? '';
  };

  return {
    title: get('title'),
    slug: get('slug'),
    excerpt: get('excerpt'),
    date: get('date'),
    readTime: get('readTime'),
  };
}

function buildBroadcastHtml(article: ArticleMeta): string {
  const siteUrl = newsletterSiteUrl();
  const brand = getBrandName();
  const mono = brand.charAt(0).toUpperCase();
  const articleUrl = `${siteUrl}/blog/${article.slug}`;
  const unsubscribeUrl = `${siteUrl}/fr/newsletter/unsubscribe?email={{email}}`;
  const dateLabel = new Date(article.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${article.title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;max-width:560px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header — Royal Blue with centred R logo (same as welcome email) -->
          <tr>
            <td align="center" style="background:#2563eb;padding:32px 36px 28px;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
                <tr>
                  <td align="center" style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:14px;">
                    <span style="display:block;font-size:24px;font-weight:900;color:#ffffff;line-height:48px;letter-spacing:-0.02em;">R</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.12em;color:#ffffff;text-transform:uppercase;">${brand.toUpperCase()}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 12px;">

              <!-- Date label -->
              <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#2563eb;letter-spacing:0.1em;text-transform:uppercase;">
                Analyse flash · ${dateLabel}
              </p>

              <!-- Title -->
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.35;">
                ${article.title}
              </h1>

              <!-- Excerpt -->
              <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.75;">
                ${article.excerpt}
              </p>

              <!-- 3 key points — clean checklist, no dark box -->
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#1e293b;line-height:1.5;">
                    <span style="color:#2563eb;font-weight:700;margin-right:10px;">✓</span>Comment protéger votre réputation face aux attaques coordonnées
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#1e293b;line-height:1.5;">
                    <span style="color:#2563eb;font-weight:700;margin-right:10px;">✓</span>Les leviers concrets pour économiser du temps cette semaine
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#1e293b;line-height:1.5;">
                    <span style="color:#2563eb;font-weight:700;margin-right:10px;">✓</span>L'action prioritaire à mettre en place dès aujourd'hui
                  </td>
                </tr>
              </table>

              <!-- Meta -->
              <p style="margin:0 0 24px;font-size:12px;color:#94a3b8;">
                ⏱ Lecture estimée : ${article.readTime} &nbsp;·&nbsp; Rédigé par ${brand} Intelligence
              </p>

              <!-- CTA — Royal Blue button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="border-radius:12px;background:#2563eb;">
                    <a href="${articleUrl}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;border-radius:12px;">
                      Accéder à l'analyse →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:#64748b;">— L'équipe ${brand}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px 28px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.7;">
                Vous recevez cet email car vous êtes abonné au Flux Stratégique ${brand}.<br/>
                <a href="${unsubscribeUrl}" style="color:#2563eb;text-decoration:none;">Se désabonner</a> &nbsp;·&nbsp; ${brand}, France
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(request: Request) {
  // Protect with CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  if (!resend) {
    return apiJsonError(request, 'errors.resendNotConfigured', 503);
  }
  if (!AUDIENCE_ID) {
    return apiJsonError(request, 'errors.newsletterAudienceMissing', 503);
  }

  const article = parseLatestArticle();
  if (!article) {
    return apiJsonError(request, 'errors.blogArticleMissing', 404);
  }

  const html = buildBroadcastHtml(article);
  const broadcastName = `Flux Stratégique — ${article.date}`;

  try {
    // Create broadcast
    const { data: broadcast, error: createError } = await resend.broadcasts.create({
      audienceId: AUDIENCE_ID,
      from: newsletterSenderStrategic(),
      subject: `[Analyse] ${article.title}`,
      html,
      name: broadcastName,
    });

    if (createError || !broadcast?.id) {
      console.error('[newsletter/broadcast] create error:', JSON.stringify(createError, null, 2));
      return apiJsonError(request, 'errors.broadcastCreateFailed', 500);
    }

    // Send broadcast
    const { error: sendError } = await resend.broadcasts.send(broadcast.id);
    if (sendError) {
      console.error('[newsletter/broadcast] send error:', JSON.stringify(sendError, null, 2));
      return apiJsonError(request, 'errors.broadcastSendFailed', 500);
    }

    console.log(`[newsletter/broadcast] Sent broadcast "${broadcastName}" (id: ${broadcast.id})`);
    return NextResponse.json({ success: true, broadcastId: broadcast.id, article: article.title });
  } catch (err) {
    console.error('[newsletter/broadcast] Unexpected error:', err);
    return apiJsonError(request, 'errors.unexpectedError', 500);
  }
}
