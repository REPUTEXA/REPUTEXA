'use client';

import { usePathname } from 'next/navigation';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

/** next-themes API values — not user-facing copy. */
const NT_ATTRIBUTE_CLASS = 'class';
const NT_DEFAULT_LIGHT = 'light';

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

/** Dark / light toggle applies only under `/[locale]/dashboard` — all other routes stay light. */
function isDashboardPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return /\/[a-z]{2}\/dashboard(\/|$)/.test(pathname);
}

export function ThemeProviderRouteAware({ children, ...props }: ThemeProviderProps) {
  const pathname = usePathname();
  const allowThemeToggle = isDashboardPath(pathname);

  return (
    <NextThemesProvider
      attribute={NT_ATTRIBUTE_CLASS}
      defaultTheme={NT_DEFAULT_LIGHT}
      enableSystem={false}
      forcedTheme={allowThemeToggle ? undefined : NT_DEFAULT_LIGHT}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
