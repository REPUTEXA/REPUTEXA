import type { Metadata } from 'next';
import { headers } from 'next/headers';
import localFont from 'next/font/local';
import { Toaster } from 'sonner';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'REPUTEXA - Your 24/7 Customer Relationship Director',
  description: 'Automate feedback, prevent negative reviews, and elevate your restaurant brand with AI. The ultimate reputation shield for restaurant owners.',
  openGraph: {
    title: 'REPUTEXA - Your 24/7 Customer Relationship Director',
    description: 'Automate feedback, prevent negative reviews, and elevate your restaurant brand with AI.',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const locale = headersList.get('x-next-intl-locale') ?? 'en';
  const dir = ['ar', 'he'].includes(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
