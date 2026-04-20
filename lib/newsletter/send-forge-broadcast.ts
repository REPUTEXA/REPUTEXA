import { newsletterSenderStrategic } from '@/lib/emails/newsletter-route-settings';
import { buildWeeklyForgeBroadcastEmail } from '@/lib/emails/newsletter-emails-i18n';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';
import type { BlogForgePostRow } from '@/lib/blog-forge/types';
import type { Article } from '@/lib/i18n/blog-articles/types';
import { listActiveSubscribers } from '@/lib/blog-forge/newsletter-subscribers';
import { resend } from '@/lib/resend';

function articleForSubscriber(row: BlogForgePostRow, locale: string): Article {
  const loc = normalizeAppLocale(locale);
  if (loc === 'fr') return row.source_fr;
  return (row.i18n[loc] as Article | undefined) ?? row.source_fr;
}

/**
 * Envoie l’e-mail hebdomadaire à chaque abonné actif (locale = langue d’inscription).
 */
export async function sendForgeWeeklyBroadcast(post: BlogForgePostRow): Promise<number> {
  if (!resend) {
    console.warn('[send-forge-broadcast] RESEND_API_KEY missing');
    return 0;
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://reputexa.fr'
  ).replace(/\/$/, '');

  const subscribers = await listActiveSubscribers();
  if (subscribers.length === 0) {
    console.log('[send-forge-broadcast] No subscribers in DB — skip sends');
    return 0;
  }

  const from = newsletterSenderStrategic();
  let sent = 0;

  for (const sub of subscribers) {
    const loc = normalizeAppLocale(sub.locale);
    const article = articleForSubscriber(post, loc);
    const published = post.published_at ? new Date(post.published_at) : new Date();
    const intlTag = siteLocaleToIntlDateTag(loc);
    const dateStr = published.toLocaleDateString(intlTag, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const { subject, html } = buildWeeklyForgeBroadcastEmail({
      locale: loc,
      title: article.title,
      excerpt: article.excerpt,
      readTime: article.readTime,
      articleUrl: `${siteUrl}/${loc}/blog/${post.slug}`,
      dateLabel: dateStr,
      email: sub.email,
      siteUrl,
    });
    const { error } = await resend.emails.send({ from, to: sub.email, subject, html });
    if (!error) sent += 1;
    else console.error('[send-forge-broadcast] send', sub.email, error);
  }

  return sent;
}
