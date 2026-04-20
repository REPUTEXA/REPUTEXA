import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ensureBananoTerminalPublicSlug } from '@/lib/banano/ensure-terminal-slug';

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * /terminal redirige vers le lien unique du commerce (évite les mélanges entre enseignes).
 */
export default async function TerminalIndexPage({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/terminal`)}`);
  }
  const slug = await ensureBananoTerminalPublicSlug(supabase, user.id);
  redirect(`/${locale}/terminal/${slug}`);
}
