'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/** next-themes API values — not user-facing copy; module consts satisfy i18next/no-literal-string. */
const NT_ATTRIBUTE_CLASS = 'class';
const NT_DEFAULT_SYSTEM = 'system';

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider attribute={NT_ATTRIBUTE_CLASS} defaultTheme={NT_DEFAULT_SYSTEM} enableSystem {...props}>
      {children}
    </NextThemesProvider>
  );
}
