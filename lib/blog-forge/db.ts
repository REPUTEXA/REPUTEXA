import { createAdminClient } from '@/lib/supabase/admin';
import type { BlogForgePostRow, ForgeVerification, TopicBundle } from './types';
import type { Article } from '@/lib/i18n/blog-articles/types';

function mapRow(data: Record<string, unknown>): BlogForgePostRow {
  return {
    id: String(data.id),
    slug: String(data.slug),
    status: data.status as BlogForgePostRow['status'],
    week_monday: String(data.week_monday),
    topic_meta: data.topic_meta as TopicBundle,
    verification: data.verification as ForgeVerification,
    rss_headlines: (data.rss_headlines as string[]) ?? [],
    source_fr: data.source_fr as Article,
    i18n: (data.i18n as BlogForgePostRow['i18n']) ?? {},
    created_at: String(data.created_at),
    approved_at: data.approved_at ? String(data.approved_at) : null,
    published_at: data.published_at ? String(data.published_at) : null,
  };
}

export async function upsertDraftPost(row: {
  slug: string;
  week_monday: string;
  topic_meta: TopicBundle;
  verification: ForgeVerification;
  rss_headlines: string[];
  source_fr: Article;
  i18n: Partial<Record<string, Article>>;
}): Promise<BlogForgePostRow | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from('blog_forge_posts')
    .upsert(
      {
        slug: row.slug,
        week_monday: row.week_monday,
        status: 'draft_pending',
        topic_meta: row.topic_meta,
        verification: row.verification,
        rss_headlines: row.rss_headlines,
        source_fr: row.source_fr,
        i18n: row.i18n,
        approved_at: null,
        published_at: null,
      },
      { onConflict: 'week_monday' }
    )
    .select()
    .single();

  if (error) {
    console.error('[blog-forge/db] upsertDraftPost', error);
    return null;
  }
  return mapRow(data as Record<string, unknown>);
}

export async function getDraftForWeek(weekMonday: string): Promise<BlogForgePostRow | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from('blog_forge_posts')
    .select('*')
    .eq('week_monday', weekMonday)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function getLatestByStatus(
  status: BlogForgePostRow['status']
): Promise<BlogForgePostRow | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from('blog_forge_posts')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function approveWeekPost(weekMonday: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { error } = await admin
    .from('blog_forge_posts')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('week_monday', weekMonday)
    .eq('status', 'draft_pending');
  return !error;
}

export async function markPublished(id: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const allowDraft =
    process.env.BLOG_FORGE_PUBLISH_WITHOUT_APPROVAL === '1' ||
    process.env.BLOG_FORGE_PUBLISH_WITHOUT_APPROVAL === 'true';
  const { error } = await admin
    .from('blog_forge_posts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', allowDraft ? ['approved', 'draft_pending'] : ['approved']);
  return !error;
}

export async function getApprovedNotPublished(): Promise<BlogForgePostRow | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from('blog_forge_posts')
    .select('*')
    .eq('status', 'approved')
    .is('published_at', null)
    .order('week_monday', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function listPublishedForgePosts(limit = 24): Promise<BlogForgePostRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from('blog_forge_posts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error || !data?.length) return [];
  return data.map((r) => mapRow(r as Record<string, unknown>));
}

export async function getPublishedBySlug(slug: string): Promise<BlogForgePostRow | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from('blog_forge_posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}
