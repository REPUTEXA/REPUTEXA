import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { PublicPageShell } from '@/components/public-page-shell';
import {
  ArrowLeft, Calendar, Clock, Tag, TrendingUp,
  AlertTriangle, CheckCircle, ArrowRight, ExternalLink, BookOpen,
} from 'lucide-react';
import type { Section } from '@/lib/i18n/blog-articles';
import { getBlogArticles } from '@/lib/i18n/blog-articles';
import { getPublishedBySlug } from '@/lib/blog-forge/db';
import { forgeArticleForLocale } from '@/lib/blog-forge/public-article';
import { BLOG_ARTICLES_FR } from '@/lib/i18n/blog-articles/fr';
import {
  LEGACY_EN_CATEGORY_TO_KEY,
  LEGACY_FR_CATEGORY_TO_KEY,
} from '@/lib/i18n/blog-legacy-category-map';

/* ─────────────────────────────────────────────────────────────────────────────
   ARTICLES DATABASE (locale-specific bodies in lib/i18n/blog-articles)
───────────────────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────────────────
   RENDERERS
───────────────────────────────────────────────────────────────────────────── */
const CATEGORY_COLORS_BY_KEY: Record<string, string> = {
  product: 'bg-blue-500/20 text-blue-400',
  trends: 'bg-violet-500/20 text-violet-400',
  regulation: 'bg-amber-500/20 text-amber-400',
  guide: 'bg-emerald-500/20 text-emerald-400',
  useCase: 'bg-cyan-500/20 text-cyan-400',
  seoLocal: 'bg-orange-500/20 text-orange-400',
  cybersecurity: 'bg-red-500/20 text-red-400',
  studies: 'bg-pink-500/20 text-pink-400',
  international: 'bg-teal-500/20 text-teal-400',
};

function resolveCategoryKey(label: string) {
  return (
    LEGACY_FR_CATEGORY_TO_KEY[label] ??
    LEGACY_EN_CATEGORY_TO_KEY[label] ??
    'product'
  );
}

function Callout({ type, text, label }: { type: string; text: string; label?: string }) {
  const styles: Record<string, { bg: string; icon: React.ReactNode; labelColor: string }> = {
    stat: { bg: 'bg-[#2563eb]/10 border-[#2563eb]/30', icon: <TrendingUp className="w-4 h-4 text-[#2563eb]" />, labelColor: 'text-[#2563eb]' },
    warning: { bg: 'bg-amber-500/10 border-amber-500/30', icon: <AlertTriangle className="w-4 h-4 text-amber-400" />, labelColor: 'text-amber-400' },
    tip: { bg: 'bg-emerald-500/10 border-emerald-500/30', icon: <CheckCircle className="w-4 h-4 text-emerald-400" />, labelColor: 'text-emerald-400' },
    key: { bg: 'bg-violet-500/10 border-violet-500/30', icon: <CheckCircle className="w-4 h-4 text-violet-400" />, labelColor: 'text-violet-400' },
  };
  const s = styles[type] ?? styles.key;
  return (
    <div className={`my-6 flex gap-3 rounded-xl border p-4 ${s.bg}`}>
      <div className="shrink-0 mt-0.5">{s.icon}</div>
      <div>
        {label && <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${s.labelColor}`}>{label}</p>}
        <p className="text-sm text-gray-200 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function ArticleSection({ section }: { section: Section }) {
  return (
    <div className="mb-10">
      {section.heading && (
        <h2 className="font-display text-xl font-bold text-white mb-4 mt-8 leading-snug">{section.heading}</h2>
      )}
      {section.lead && (
        <p className="text-gray-300 leading-relaxed mb-4 font-medium italic">{section.lead}</p>
      )}
      {section.paragraphs?.map((p, i) => (
        <p key={i} className="text-gray-300 leading-relaxed mb-4">{p}</p>
      ))}
      {section.callout && <Callout {...section.callout} />}
      {section.numbered && (
        <ol className="space-y-5 my-6">
          {section.numbered.map((item, i) => (
            <li key={i} className="flex gap-4">
              <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-[#2563eb] text-white text-xs font-bold mt-0.5">{i + 1}</span>
              <div>
                <p className="font-semibold text-white mb-1">{item.title}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {section.bullets && (
        <ul className="space-y-3 my-6">
          {section.bullets.map((b, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-[#2563eb]" />
              <div>
                <span className="text-gray-200 text-sm leading-relaxed">{b.text}</span>
                {b.sub && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{b.sub}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────────────── */
type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function BlogArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'BlogArticle' });
  const forgeRow = await getPublishedBySlug(slug);
  const ARTICLES = getBlogArticles(locale);
  const article = forgeRow ? forgeArticleForLocale(forgeRow, locale) : ARTICLES[slug];
  if (!article) notFound();

  const related = Object.values(ARTICLES).filter((a) => a.slug !== slug).slice(0, 3);
  const catLabel = (label: string) =>
    t(`categories.${resolveCategoryKey(label)}` as Parameters<typeof t>[0]);

  return (
    <PublicPageShell title="" subtitle="">
      <div className="max-w-3xl mx-auto">

        {/* Back */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          {t('backToBlog')}
        </Link>

        {/* Header — niveau presse */}
        <header className="mb-8">
          {/* Editorial line */}
          <p className="text-xs font-bold uppercase tracking-widest text-[#2563eb] mb-3">
            {article.editorial}
          </p>

          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight mb-4">
            {article.title}
          </h1>

          <p className="text-gray-400 text-base leading-relaxed border-l-2 border-[#2563eb] pl-4 mb-5">
            {article.excerpt}
          </p>

          {/* Meta bar */}
          <div className="flex flex-wrap items-center gap-3 text-xs pb-5 border-b border-white/10">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ${CATEGORY_COLORS_BY_KEY[resolveCategoryKey(article.category)] ?? 'bg-gray-500/20 text-gray-400'}`}
            >
              <Tag className="w-2.5 h-2.5" />
              {catLabel(article.category)}
            </span>
            <span className="text-gray-600">·</span>
            <span className="flex items-center gap-1.5 text-gray-500">
              <Calendar className="w-3.5 h-3.5" />
              {article.date}
            </span>
            {article.updatedDate && (
              <span className="text-gray-600 italic">
                {t('updatedPrefix')} {article.updatedDate}
              </span>
            )}
            <span className="text-gray-600">·</span>
            <span className="flex items-center gap-1.5 text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              {article.readTime} {t('readTimeSuffix')}
            </span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-500 font-medium">{article.author}</span>
          </div>
        </header>

        {/* Intro — italique accroche */}
        <p className="text-lg text-gray-200 leading-relaxed font-light mb-10 pl-5 border-l-2 border-white/20 italic">
          {article.intro}
        </p>

        {/* Sections */}
        {article.sections.map((section, i) => (
          <ArticleSection key={i} section={section} />
        ))}

        {/* Conclusion */}
        <div className="mt-10 mb-10 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="font-display text-lg font-bold text-white mb-3">{t('conclusionTitle')}</h2>
          <p className="text-gray-300 leading-relaxed">{article.conclusion}</p>
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-[#2563eb]/30 bg-gradient-to-br from-[#2563eb]/10 to-transparent p-7 text-center mb-14">
          <p className="text-sm font-medium text-gray-400 mb-1">{t('ctaLead')}</p>
          <h3 className="font-display text-xl font-bold text-white mb-4">{article.cta}</h3>
          <Link
            href="/free-trial"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2563eb] text-white font-semibold hover:bg-[#1d4ed8] transition-colors"
          >
            {t('ctaButton')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Sources */}
        <div className="mb-14">
          <div className="flex items-center gap-2 mb-5">
            <BookOpen className="w-4 h-4 text-gray-500" />
            <h2 className="font-display text-base font-bold text-gray-400 uppercase tracking-widest text-xs">
              {t('sourcesTitle')}
            </h2>
          </div>
          <div className="space-y-3">
            {article.sources.map((src, i) => (
              <div key={i} className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.05] transition-colors group">
                <span className="shrink-0 mt-0.5 text-xs font-bold text-gray-600 w-5 text-right">{i + 1}.</span>
                <div className="min-w-0">
                  {src.url ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-[#2563eb] hover:text-blue-400 font-medium leading-snug group-hover:underline underline-offset-2 transition-colors"
                    >
                      {src.label}
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                    </a>
                  ) : (
                    /* Référence académique — texte pur, pas de lien */
                    <span className="text-sm text-gray-400 font-medium leading-snug italic">
                      {src.label}
                    </span>
                  )}
                  {src.note && (
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{src.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {article.methodology && (
            <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">{t('methodologyNote')}</p>
              <p className="text-xs text-gray-600 leading-relaxed">{article.methodology}</p>
            </div>
          )}
          <p className="mt-4 text-xs text-gray-700 leading-relaxed">{t('methodologyDisclaimer')}</p>
        </div>

        {/* Related articles */}
        <div className="border-t border-white/10 pt-10">
          <h2 className="font-display text-base font-bold text-white mb-5">{t('relatedTitle')}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {related.map((a) => (
              <Link
                key={a.slug}
                href={`/blog/${a.slug}`}
                className="group rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/[0.07] transition-all"
              >
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium mb-2 ${CATEGORY_COLORS_BY_KEY[resolveCategoryKey(a.category)] ?? 'bg-gray-500/20 text-gray-400'}`}
                >
                  {catLabel(a.category)}
                </span>
                <p className="text-sm font-semibold text-white leading-snug group-hover:text-[#2563eb] transition-colors mb-1">{a.title}</p>
                <p className="text-xs text-gray-500">{a.readTime}</p>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </PublicPageShell>
  );
}

export function generateStaticParams() {
  return Object.keys(BLOG_ARTICLES_FR).map((slug) => ({ slug }));
}
