import type { Article } from '@/lib/i18n/blog-articles/types';

export type BlogForgeStatus = 'draft_pending' | 'approved' | 'published';

export type TopicBundle = {
  domain: string;
  angle: string;
  sector: string;
  weekIndex: number;
};

export type ForgeVerification = {
  verified: boolean;
  notes?: string;
  concerns?: string[];
};

export type BlogForgePostRow = {
  id: string;
  slug: string;
  status: BlogForgeStatus;
  week_monday: string;
  topic_meta: TopicBundle;
  verification: ForgeVerification;
  rss_headlines: string[];
  source_fr: Article;
  i18n: Partial<Record<string, Article>>;
  created_at: string;
  approved_at: string | null;
  published_at: string | null;
};

export type { Article };
