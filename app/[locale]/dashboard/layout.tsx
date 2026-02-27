import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { UserButton } from '@clerk/nextjs';
import { SidebarNav } from '@/components/dashboard/sidebar-nav';
import { Search, Bell } from 'lucide-react';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function DashboardLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('Dashboard.sidebar');

  const labels = {
    overview: t('overview'),
    prospects: t('prospects'),
    settings: t('settings'),
    upgrade: t('upgrade'),
    unlockCta: t('unlockCta'),
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar sombre */}
      <aside className="fixed left-0 top-0 z-20 flex h-full w-56 flex-col border-r border-zinc-800 bg-zinc-950">
        <div className="flex h-14 items-center border-b border-zinc-800 px-5">
          <Link href="/" className="text-lg font-semibold tracking-tight text-white">
            Reputexa
          </Link>
        </div>

        {/* Établissement actif */}
        <div className="border-b border-zinc-800 px-4 py-3">
          <div className="rounded-lg bg-zinc-800/50 px-3 py-2">
            <p className="text-xs text-zinc-500">Établissement</p>
            <p className="text-sm font-medium text-white">La Bella Vista</p>
          </div>
        </div>

        <SidebarNav labels={labels} />

        {/* Plan Pro - bas de sidebar */}
        <div className="mt-auto border-t border-zinc-800 p-4">
          <div className="rounded-lg bg-zinc-800/80 p-4">
            <p className="text-sm text-white">{labels.unlockCta}</p>
            <Link
              href="/dashboard"
              className="shiny-button mt-3 flex w-full justify-center rounded-lg bg-blue-500 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
            >
              {labels.upgrade}
            </Link>
          </div>
        </div>
      </aside>

      <div className="ml-56 flex flex-1 flex-col">
        {/* Header clair */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-gray-200 bg-white px-6">
          <div className="flex-1">
            <div className="flex max-w-md items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <Search className="mr-2 h-4 w-4 text-zinc-400" />
              <input
                type="search"
                placeholder="Rechercher des avis..."
                className="w-full bg-transparent text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none"
              />
            </div>
          </div>
          <button type="button" className="rounded-lg p-2 text-zinc-500 hover:bg-gray-100">
            <Bell className="h-5 w-5" />
          </button>
          <UserButton afterSignOutUrl="/" />
        </header>

        <main className="flex-1 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
