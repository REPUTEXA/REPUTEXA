'use client';

import { usePathname } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import {
  LayoutDashboard,
  Target,
  Settings,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'overview' },
  { href: '/dashboard/prospects', icon: Target, labelKey: 'prospects' },
  { href: '/dashboard/settings', icon: Settings, labelKey: 'settings' },
];

export function SidebarNav({
  labels,
}: {
  labels: Record<string, string>;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 p-4">
      {navItems.map((item) => {
        const isActive =
          item.href === '/dashboard'
            ? pathname === '/dashboard' || pathname?.endsWith('/dashboard')
            : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isActive
                ? 'bg-blue-500 text-white'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <item.icon className="h-5 w-5" />
            {labels[item.labelKey]}
          </Link>
        );
      })}
    </nav>
  );
}
