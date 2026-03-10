'use client';

import { usePathname } from 'next/navigation';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

type ThemeProviderProps = Omit<React.ComponentProps<typeof NextThemesProvider>, 'forcedTheme'>;

export function ThemeProviderRouteAware({ children, ...props }: ThemeProviderProps) {
  const pathname = usePathname();
  const isDashboard = pathname?.includes('/dashboard');
  // Hors dashboard : forcer light pour que la landing reste lumineuse
  const forcedTheme = isDashboard ? undefined : 'light';

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      forcedTheme={forcedTheme}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
