import { getApprovedNotPublished, markPublished } from './db';
import type { BlogForgePostRow } from './types';
import { sendForgeWeeklyBroadcast } from '@/lib/newsletter/send-forge-broadcast';

/**
 * Publie l’article approuvé en attente et envoie la newsletter multilingue.
 */
export async function runBlogForgePublish(): Promise<{
  ok: boolean;
  slug?: string;
  error?: string;
  emailsSent?: number;
}> {
  const post = await getApprovedNotPublished();
  if (!post) {
    return { ok: false, error: 'nothing_to_publish' };
  }

  const ok = await markPublished(post.id);
  if (!ok) {
    return { ok: false, error: 'mark_published_failed' };
  }

  const publishedAt = new Date().toISOString();
  const postForEmail = { ...post, status: 'published' as const, published_at: publishedAt };

  let emailsSent = 0;
  try {
    emailsSent = await sendForgeWeeklyBroadcast(postForEmail);
  } catch (e) {
    console.error('[runBlogForgePublish] send', e);
    return { ok: false, slug: post.slug, error: 'send_failed', emailsSent: 0 };
  }

  return { ok: true, slug: post.slug, emailsSent };
}

export type { BlogForgePostRow };
