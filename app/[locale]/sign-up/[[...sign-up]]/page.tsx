import { SignUp } from '@clerk/nextjs';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';

type Props = {
  params: Promise<{ locale: string; 'sign-up': string[] }>;
};

export default async function SignUpPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    return null;
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-zinc-950 py-12">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-zinc-900 border border-zinc-800 shadow-xl',
          },
        }}
        afterSignUpUrl={`/${locale}/checkout`}
        signInUrl={`/${locale}/sign-in`}
      />
    </div>
  );
}
