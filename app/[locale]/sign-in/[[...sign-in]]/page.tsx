import { SignIn } from '@clerk/nextjs';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';

type Props = {
  params: Promise<{ locale: string; 'sign-in': string[] }>;
};

export default async function SignInPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    return null;
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-zinc-950 py-12">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-zinc-900 border border-zinc-800 shadow-xl',
          },
        }}
        afterSignInUrl={`/${locale}/dashboard`}
        signUpUrl={`/${locale}/sign-up`}
      />
    </div>
  );
}
