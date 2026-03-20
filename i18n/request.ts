import { getRequestConfig } from 'next-intl/server';
import type { AbstractIntlMessages } from 'next-intl';
import { routing } from './routing';

/** Merge messages: requested locale over default, so missing keys fallback to defaultLocale (fr). */
function mergeMessages(
  defaultMessages: Record<string, unknown>,
  localeMessages: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const key of Object.keys(defaultMessages)) {
    const localeVal = localeMessages[key];
    const defaultVal = defaultMessages[key];
    if (localeVal != null && typeof localeVal === 'object' && !Array.isArray(localeVal) && typeof defaultVal === 'object' && defaultVal != null && !Array.isArray(defaultVal)) {
      merged[key] = mergeMessages(defaultVal as Record<string, unknown>, localeVal as Record<string, unknown>);
    } else if (localeVal !== undefined && localeVal !== '') {
      merged[key] = localeVal;
    } else {
      merged[key] = defaultVal;
    }
  }
  for (const key of Object.keys(localeMessages)) {
    if (!(key in merged)) merged[key] = localeMessages[key];
  }
  return merged;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale =
    requested && routing.locales.includes(requested as (typeof routing.locales)[number])
      ? requested
      : routing.defaultLocale;

  const defaultMessages = (await import(`../messages/${routing.defaultLocale}.json`)).default as Record<string, unknown>;
  const localeMessages = (await import(`../messages/${locale}.json`)).default as Record<string, unknown>;
  const messages = locale === routing.defaultLocale
    ? defaultMessages
    : mergeMessages(defaultMessages, localeMessages);

  return {
    locale,
    messages: messages as AbstractIntlMessages,
  };
});
