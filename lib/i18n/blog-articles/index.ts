import type { Article } from './types';
import { BLOG_ARTICLES_FR } from './fr';
import { BLOG_ARTICLES_EN } from './en';

export type { Article, Section, Source } from './types';

export function getBlogArticles(locale: string): Record<string, Article> {
  return locale === 'fr' ? BLOG_ARTICLES_FR : BLOG_ARTICLES_EN;
}
