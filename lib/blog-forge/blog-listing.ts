import { LEGACY_FR_CATEGORY_TO_KEY } from '@/lib/i18n/blog-legacy-category-map';
import type { Article } from '@/lib/i18n/blog-articles/types';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { listPublishedForgePosts } from './db';
import type { BlogForgePostRow } from './types';

export type BlogCard = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  categoryKey: string;
  featured?: boolean;
};

function forgePostToCard(row: BlogForgePostRow, locale: string): BlogCard {
  const loc = normalizeAppLocale(locale);
  const art: Article =
    loc === 'fr' ? row.source_fr : (row.i18n[loc] as Article | undefined) ?? row.source_fr;
  const categoryKey = LEGACY_FR_CATEGORY_TO_KEY[art.category] ?? 'trends';
  return {
    slug: art.slug,
    title: art.title,
    excerpt: art.excerpt,
    date: art.date,
    readTime: art.readTime,
    categoryKey,
  };
}

/**
 * Articles Forge publiés en tête, puis cartes statiques (messages), dédoublonnés par slug.
 */
export async function loadMergedBlogCards(locale: string, staticPosts: BlogCard[]): Promise<BlogCard[]> {
  const forgeRows = await listPublishedForgePosts(24);
  const forgeCards = forgeRows.map((r) => forgePostToCard(r, locale));
  const stripped = staticPosts.map((p) => ({ ...p, featured: false }));
  const merged = [...forgeCards, ...stripped];

  const seen = new Set<string>();
  const out: BlogCard[] = [];
  for (const p of merged) {
    if (seen.has(p.slug)) continue;
    seen.add(p.slug);
    out.push(p);
  }
  if (out.length) {
    out[0] = { ...out[0], featured: true };
  }
  return out;
}
