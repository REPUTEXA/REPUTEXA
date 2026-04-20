import { NextResponse } from 'next/server';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

/** Réponse JSON d’erreur localisée (`messages/*.json` → namespace `Api`). */
export function apiJsonError(
  locale: string,
  key: string,
  status: number,
  values?: Record<string, string | number | boolean>
): NextResponse {
  const t = createServerTranslator('Api', locale);
  return NextResponse.json({ error: t(key, values) }, { status });
}

/** Réponse JSON avec champ `message` localisé. */
export function apiJsonMessage(
  locale: string,
  messageKey: string,
  status: number,
  extra?: Record<string, unknown>,
  values?: Record<string, string | number | boolean>
): NextResponse {
  const t = createServerTranslator('Api', locale);
  return NextResponse.json({ message: t(messageKey, values), ...extra }, { status });
}
