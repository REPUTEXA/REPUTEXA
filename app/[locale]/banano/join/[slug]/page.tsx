import { BananoPublicJoinForm } from '@/components/banano/banano-public-join-form';
import { createAdminClient } from '@/lib/supabase/admin';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function BananoPublicJoinPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).trim();

  let establishmentName: string | null = null;
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .from('profiles')
      .select('establishment_name')
      .eq('banano_terminal_public_slug', slug)
      .maybeSingle();
    establishmentName = (data as { establishment_name?: string } | null)?.establishment_name ?? null;
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-zinc-100">
      <BananoPublicJoinForm slug={slug} establishmentName={establishmentName} />
    </div>
  );
}
