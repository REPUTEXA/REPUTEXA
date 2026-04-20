/**
 * Synchronise les contacts d’audience Resend (Flux stratégique) vers `public.newsletter_subscribers`.
 *
 * - Récupère tous les contacts de l’audience configurée (pagination).
 * - Pour chaque e-mail : si un profil `profiles` existe avec le même e-mail, la locale est dérivée
 *   de `locale` / `language` / `preferred_language` (codes `SITE_LOCALE_CODES`, sinon `fr`).
 * - Sinon : `NEWSLETTER_SYNC_DEFAULT_LOCALE` (défaut `fr`, ou `en`).
 * - Si `NEWSLETTER_SYNC_RESPECT_EXISTING=1` : une ligne déjà présente en base garde sa `locale`
 *   (mise à jour de `unsubscribed_at` et `updated_at` uniquement selon Resend).
 *
 * Prérequis : RESEND_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *             RESEND_NEWSLETTER_AUDIENCE_ID ou audience résolvable par nom.
 *
 * Usage :
 *   npx tsx scripts/sync-resend-to-db.ts
 *   npx tsx scripts/sync-resend-to-db.ts --dry-run
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { SITE_LOCALE_CODES } from '../lib/i18n/site-locales-catalog';

const ALLOWED = new Set<string>(SITE_LOCALE_CODES);

function normalizeNewsletterLocale(raw: string | null | undefined): string {
  const n = (raw ?? 'fr').toLowerCase().trim();
  return ALLOWED.has(n) ? n : 'fr';
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TAG = '[sync-resend-to-db]';

type ResendContact = {
  id: string;
  email: string;
  unsubscribed?: boolean;
};

function parseArgs(argv: string[]) {
  return { dryRun: argv.includes('--dry-run') };
}

function defaultLocaleFromEnv(): string {
  const raw = (process.env.NEWSLETTER_SYNC_DEFAULT_LOCALE ?? 'fr').toLowerCase().trim();
  return raw === 'en' ? 'en' : 'fr';
}

function respectExisting(): boolean {
  const v = process.env.NEWSLETTER_SYNC_RESPECT_EXISTING;
  return v === '1' || v === 'true' || v === 'yes';
}

async function resolveAudienceId(resend: Resend): Promise<string | null> {
  const fromEnv = process.env.RESEND_NEWSLETTER_AUDIENCE_ID?.trim();
  if (fromEnv) return fromEnv;

  const name =
    process.env.RESEND_NEWSLETTER_AUDIENCE_NAME?.trim() ||
    process.env.RESEND_NEWSLETTER_AUDIENCE?.trim();
  if (!name) {
    console.error(TAG, 'Définissez RESEND_NEWSLETTER_AUDIENCE_ID ou RESEND_NEWSLETTER_AUDIENCE_NAME');
    return null;
  }

  const { data, error } = await resend.audiences.list();
  if (error) {
    console.error(TAG, 'audiences.list', error);
    return null;
  }
  const match = data?.data?.find((a: { name: string }) => a.name === name);
  return match?.id ?? null;
}

async function fetchAllContacts(resend: Resend, audienceId: string): Promise<ResendContact[]> {
  const all: ResendContact[] = [];
  let after: string | undefined;

  for (;;) {
    const { data, error } = await resend.contacts.list({
      audienceId,
      limit: 100,
      ...(after ? { after } : {}),
    });

    if (error) {
      console.error(TAG, 'contacts.list', error);
      throw new Error(String(error));
    }

    const batch = (data?.data ?? []) as ResendContact[];
    all.push(...batch);

    if (batch.length < 100) break;
    after = batch[batch.length - 1]?.id;
    if (!after) break;
  }

  return all;
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!apiKey || !url || !serviceKey) {
    console.error(TAG, 'Variables manquantes : RESEND_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const resend = new Resend(apiKey);
  const audienceId = await resolveAudienceId(resend);
  if (!audienceId) {
    process.exit(1);
  }

  console.log(TAG, 'Audience:', audienceId, dryRun ? '(dry-run)' : '');

  const contacts = await fetchAllContacts(resend, audienceId);
  console.log(TAG, 'Contacts Resend:', contacts.length);

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const fallback = defaultLocaleFromEnv();
  const keepLocale = respectExisting();

  let inserted = 0;
  let updated = 0;
  let skippedLocale = 0;

  for (const c of contacts) {
    const email = c.email?.trim().toLowerCase();
    if (!email) continue;

    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('email, locale')
      .eq('email', email)
      .maybeSingle();

    let locale = fallback;

    if (keepLocale && existing?.locale) {
      locale = existing.locale;
      skippedLocale += 1;
    } else {
      const { data: prof } = await supabase
        .from('profiles')
        .select('language, locale, preferred_language')
        .eq('email', email)
        .maybeSingle();

      const raw =
        prof?.locale?.trim() ||
        prof?.language?.trim() ||
        prof?.preferred_language?.trim() ||
        '';
      if (raw) {
        locale = normalizeNewsletterLocale(raw);
      }
    }

    const unsubscribedAt = c.unsubscribed ? new Date().toISOString() : null;
    const now = new Date().toISOString();

    if (dryRun) {
      console.log(TAG, email, '→ locale', locale, c.unsubscribed ? '(unsub Resend)' : '');
      continue;
    }

    const { error } = await supabase.from('newsletter_subscribers').upsert(
      {
        email,
        locale,
        updated_at: now,
        unsubscribed_at: unsubscribedAt,
      },
      { onConflict: 'email' }
    );

    if (error) {
      console.error(TAG, 'upsert', email, error);
      continue;
    }

    if (existing) updated += 1;
    else inserted += 1;
  }

  if (!dryRun) {
    console.log(TAG, 'Terminé — insérés:', inserted, 'mis à jour:', updated, 'locales conservées (respect):', skippedLocale);
  }
}

main().catch((e) => {
  console.error(TAG, e);
  process.exit(1);
});
