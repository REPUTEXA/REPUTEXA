import { randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

function randomTerminalSegment(): string {
  return randomBytes(12).toString('base64url').replace(/=/g, '');
}

/**
 * Garantit un segment d’URL stable par profil pour `/terminal/[slug]`.
 * Collision extrêmement rare — boucle de secours.
 */
export async function ensureBananoTerminalPublicSlug(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: row, error: readErr } = await supabase
    .from('profiles')
    .select('banano_terminal_public_slug')
    .eq('id', userId)
    .maybeSingle();

  if (readErr) {
    throw new Error(readErr.message);
  }

  const existing = (row as { banano_terminal_public_slug?: string } | null)?.banano_terminal_public_slug?.trim();
  if (existing) return existing;

  for (let attempt = 0; attempt < 12; attempt++) {
    const slug = `rt_${randomTerminalSegment()}`;
    const { data: updated, error: upErr } = await supabase
      .from('profiles')
      .update({ banano_terminal_public_slug: slug })
      .eq('id', userId)
      .is('banano_terminal_public_slug', null)
      .select('banano_terminal_public_slug')
      .maybeSingle();

    if (!upErr && updated?.banano_terminal_public_slug) {
      return String(updated.banano_terminal_public_slug);
    }

    const { data: again } = await supabase
      .from('profiles')
      .select('banano_terminal_public_slug')
      .eq('id', userId)
      .maybeSingle();
    const got = (again as { banano_terminal_public_slug?: string } | null)?.banano_terminal_public_slug?.trim();
    if (got) return got;

    if (upErr?.code === '23505') continue;
  }

  throw new Error('Impossible d’allouer un lien terminal.');
}
