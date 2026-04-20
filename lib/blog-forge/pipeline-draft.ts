import { pickTopicBundle } from './topic-matrix';
import { fetchNewsRadarHeadlines } from './news-radar';
import { generateFrenchArticle } from './generate-fr-article';
import { verifyFrenchArticle } from './verify-article';
import { translateArticleToAllLocales } from './translate-article';
import { upsertDraftPost, getDraftForWeek } from './db';
import { mondayUtcISODate } from './week';

/**
 * Génère le brouillon hebdomadaire (lundi de la semaine courante UTC).
 * Ne remplace pas une semaine déjà approuvée ou publiée.
 */
export async function runBlogForgeDraft(): Promise<{
  ok: boolean;
  slug?: string;
  skipped?: string;
  error?: string;
}> {
  try {
    const weekMonday = mondayUtcISODate();
    const existing = await getDraftForWeek(weekMonday);
    if (existing?.status === 'approved' || existing?.status === 'published') {
      return { ok: true, skipped: 'week_locked', slug: existing.slug };
    }

    const topic = pickTopicBundle(weekMonday);
    const headlines = await fetchNewsRadarHeadlines();
    const sourceFr = await generateFrenchArticle(topic, headlines);
    const verification = await verifyFrenchArticle(sourceFr);
    const i18n = await translateArticleToAllLocales(sourceFr);

    const row = await upsertDraftPost({
      slug: sourceFr.slug,
      week_monday: weekMonday,
      topic_meta: topic,
      verification,
      rss_headlines: headlines,
      source_fr: sourceFr,
      i18n,
    });

    if (!row) {
      return { ok: false, error: 'db_upsert_failed' };
    }
    return { ok: true, slug: row.slug };
  } catch (e) {
    console.error('[runBlogForgeDraft]', e);
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}
