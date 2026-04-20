import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

export async function upsertNewsletterSubscriber(email: string, locale: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const loc = normalizeAppLocale(locale);
  const clean = email.trim().toLowerCase();
  const { error } = await admin.from('newsletter_subscribers').upsert(
    {
      email: clean,
      locale: loc,
      updated_at: new Date().toISOString(),
      unsubscribed_at: null,
    },
    { onConflict: 'email' }
  );
  if (error) {
    console.error('[newsletter_subscribers] upsert', error);
    return false;
  }
  return true;
}

export async function markNewsletterUnsubscribed(email: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const clean = email.trim().toLowerCase();
  const now = new Date().toISOString();
  const { data: updated } = await admin
    .from('newsletter_subscribers')
    .update({ unsubscribed_at: now, updated_at: now })
    .eq('email', clean)
    .select('email');

  if (updated?.length) return true;

  const { error } = await admin.from('newsletter_subscribers').insert({
    email: clean,
    locale: 'fr',
    created_at: now,
    updated_at: now,
    unsubscribed_at: now,
  });
  return !error;
}

export type SubscriberRow = { email: string; locale: string };

export async function listActiveSubscribers(): Promise<SubscriberRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from('newsletter_subscribers')
    .select('email, locale')
    .is('unsubscribed_at', null);
  if (error || !data?.length) return [];
  return data as SubscriberRow[];
}
