'use client';

import { usePathname } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { Home, ListTodo, Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';

const tabClass = (active: boolean) =>
  `flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[48px] px-2 rounded-xl text-[11px] font-medium transition-colors ${
    active
      ? 'text-primary'
      : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
  }`;

export function StaffShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations('Staff.tabBar');

  const isHome = pathname === '/staff' || pathname?.endsWith('/staff');
  const isMissions = pathname?.startsWith('/staff/missions');
  const isMore = pathname?.startsWith('/staff/more');

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50 dark:bg-[#030303]">
      <main className="flex-1 min-h-0 overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/90 dark:border-zinc-800/80 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
        aria-label={t('aria')}
      >
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 pt-1.5">
          <Link href="/staff" className={tabClass(!!isHome)} prefetch>
            <Home className="h-6 w-6" aria-hidden />
            <span>{t('home')}</span>
          </Link>
          <Link href="/staff/missions" className={tabClass(!!isMissions)} prefetch>
            <ListTodo className="h-6 w-6" aria-hidden />
            <span>{t('missions')}</span>
          </Link>
          <Link href="/staff/more" className={tabClass(!!isMore)} prefetch>
            <Menu className="h-6 w-6" aria-hidden />
            <span>{t('more')}</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
