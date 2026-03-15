'use client';

import { usePathname } from 'next/navigation';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProviderRouteAware({ children, ...props }: ThemeProviderProps) {
  const pathname = usePathname();
  const isHome = pathname === '/' || /^\/[a-z]{2}\/?$/.test(pathname ?? '');

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      forcedTheme={isHome ? 'light' : undefined}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
