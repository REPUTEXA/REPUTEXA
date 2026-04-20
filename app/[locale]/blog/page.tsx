import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { loadMergedBlogCards, type BlogCard } from '@/lib/blog-forge/blog-listing';
import { BlogPageClient } from './blog-page-client';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'BlogPage' });
  const staticPosts = t.raw('posts') as BlogCard[];
  const posts = await loadMergedBlogCards(locale, staticPosts);

  return <BlogPageClient posts={posts} />;
}
