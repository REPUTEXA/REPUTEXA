import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ensureBananoTerminalPublicSlug } from '@/lib/banano/ensure-terminal-slug';
import { BananoTerminalApp } from '@/components/banano/banano-terminal-app';
import { resolveMerchantTimeZone } from '@/lib/datetime/merchant-timezone';

/** Hoisted pour ESLint (i18next/no-literal-string en JSX). */
const BANANO_TERMINAL_LAYOUT_VARIANT = 'fullscreen' as const;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function TerminalSlugPage({ params }: Props) {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/terminal/${slug}`)}`);
  }

  const canonical = await ensureBananoTerminalPublicSlug(supabase, user.id);
  if (slug !== canonical) {
    redirect(`/${locale}/terminal/${canonical}`);
  }

  const { data: tzRow } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle();
  const displayTimeZone = resolveMerchantTimeZone((tzRow?.timezone as string | null) ?? null);

  return (
    <div className="w-full min-w-0 min-h-0 p-3 sm:p-4 max-w-4xl mx-auto pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
      <BananoTerminalApp
        layoutVariant={BANANO_TERMINAL_LAYOUT_VARIANT}
        merchantLoyaltySettings={false}
        terminalPublicSlug={canonical}
        displayTimeZone={displayTimeZone}
      />
    </div>
  );
}
