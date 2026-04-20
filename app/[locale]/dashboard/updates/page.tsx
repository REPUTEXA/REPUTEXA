import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeAttachments } from '@/lib/updates/normalize-attachments';
import { pickLocalizedString } from '@/lib/i18n/pick-localized-string';
import { UpdatesList, type Update } from '@/components/dashboard/updates-list';
import { AdminUpdatesForm } from '@/components/dashboard/admin-updates-form';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Dashboard.updatesPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function UpdatesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Dashboard.updatesPage' });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="px-4 sm:px-6 md:px-8 py-6">
        <p className="text-sm text-slate-500">{t('notAuthenticated')}</p>
      </div>
    );
  }

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin';

  // Fetch DONE suggestions (with AI-generated content)
  const { data: doneSuggestions } = await supabase
    .from('app_suggestions')
    .select('id, title, update_content, update_title_i18n, update_content_i18n, completed_at')
    .eq('status', 'DONE')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(50);

  // Fetch manual admin updates (from app_updates table)
  const { data: manualUpdates } = await supabase
    .from('app_updates')
    .select('id, title, content, title_i18n, content_i18n, attachments, created_at, publish_at')
    .order('publish_at', { ascending: false })
    .limit(50);

  // Combine and sort by date (most recent first)
  const fromSuggestions: Update[] = (doneSuggestions ?? []).map((s) => {
    const titleI18n = s.update_title_i18n as Record<string, string> | null | undefined;
    const contentI18n = s.update_content_i18n as Record<string, string> | null | undefined;
    const rawContent = (s.update_content as string | null) ?? '';
    const contentResolved = pickLocalizedString(contentI18n, locale, rawContent);
    return {
      id: s.id,
      title: pickLocalizedString(titleI18n, locale, s.title ?? ''),
      content: contentResolved.trim() ? contentResolved : null,
      completedAt: (s.completed_at ?? new Date().toISOString()) as string,
      source: 'suggestion' as const,
    };
  });

  const fromManual: Update[] = (manualUpdates ?? []).map((u) => {
    const publishAt = (u.publish_at ?? u.created_at ?? new Date().toISOString()) as string;
    const titleI18n = u.title_i18n as Record<string, string> | null | undefined;
    const contentI18n = u.content_i18n as Record<string, string> | null | undefined;
    const rawContent = (u.content as string) ?? '';
    const contentResolved = pickLocalizedString(contentI18n, locale, rawContent);
    return {
      id: u.id,
      title: pickLocalizedString(titleI18n, locale, u.title ?? ''),
      content: contentResolved.trim() ? contentResolved : null,
      attachments: normalizeAttachments(u.attachments),
      completedAt: publishAt,
      publishAt,
      source: 'manual' as const,
    };
  });

  const updates = [...fromSuggestions, ...fromManual].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8 space-y-8 max-w-[900px] mx-auto">
      <header>
        <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-zinc-100 tracking-tight">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{t('intro')}</p>
      </header>

      {/* Admin: manual update creation form */}
      {isAdmin && <AdminUpdatesForm />}

      {/* Timeline */}
      <UpdatesList updates={updates} locale={locale} isAdmin={isAdmin} />
    </div>
  );
}
