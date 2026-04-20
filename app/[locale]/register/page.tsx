import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Alias /register → /signup (même logique de nettoyage session côté signup). */
export default async function RegisterPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x));
    else q.set(k, v);
  }
  const qs = q.toString();
  redirect(`/${locale}/signup${qs ? `?${qs}` : ''}`);
}
