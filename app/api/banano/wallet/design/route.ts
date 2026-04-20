import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import type { WalletDesignPayload } from '@/lib/banano/wallet-design-types';
import { isWalletThemeIllustrationId } from '@/lib/banano/wallet-theme-illustrations';
import { isWalletStampIconId } from '@/lib/wallet/presets';
import { isWalletArchetypeId } from '@/lib/wallet/archetypes';
import { parseWalletStripCropJson } from '@/lib/wallet/wallet-strip-crop';

const DESIGN_FIELDS =
  'banano_wallet_pass_background_color, banano_wallet_pass_foreground_color, banano_wallet_pass_label_color, banano_wallet_logo_text, banano_wallet_logo_url, banano_wallet_strip_image_url, banano_wallet_strip_crop_json, banano_wallet_custom_css, banano_wallet_theme_illustration_id, banano_wallet_stamp_icon_id, banano_wallet_archetype_id, banano_wallet_preview_balance_mode, banano_loyalty_mode, establishment_name';

const normMode = (v: unknown): 'stamps' | 'points' =>
  String(v ?? '').trim() === 'stamps' ? 'stamps' : 'points';

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(DESIGN_FIELDS)
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[banano/wallet/design GET]', error.message);
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }

  const row = data as Record<string, unknown> | null;
  const loyaltyMode = normMode(row?.banano_loyalty_mode);
  const previewRaw = row?.banano_wallet_preview_balance_mode;
  const preview =
    previewRaw === 'stamps' || previewRaw === 'points' ? previewRaw : null;

  const payload: WalletDesignPayload = {
    background_color: typeof row?.banano_wallet_pass_background_color === 'string'
      ? row.banano_wallet_pass_background_color
      : null,
    foreground_color: typeof row?.banano_wallet_pass_foreground_color === 'string'
      ? row.banano_wallet_pass_foreground_color
      : null,
    label_color:
      typeof row?.banano_wallet_pass_label_color === 'string'
        ? row.banano_wallet_pass_label_color
        : null,
    logo_text: typeof row?.banano_wallet_logo_text === 'string' ? row.banano_wallet_logo_text : null,
    logo_url: typeof row?.banano_wallet_logo_url === 'string' ? row.banano_wallet_logo_url : null,
    strip_image_url:
      typeof row?.banano_wallet_strip_image_url === 'string'
        ? row.banano_wallet_strip_image_url
        : null,
    custom_css: typeof row?.banano_wallet_custom_css === 'string' ? row.banano_wallet_custom_css : null,
    theme_illustration_id:
      typeof row?.banano_wallet_theme_illustration_id === 'string' &&
      isWalletThemeIllustrationId(row.banano_wallet_theme_illustration_id.trim())
        ? row.banano_wallet_theme_illustration_id.trim()
        : null,
    stamp_icon_id:
      typeof row?.banano_wallet_stamp_icon_id === 'string' &&
      isWalletStampIconId(row.banano_wallet_stamp_icon_id.trim())
        ? row.banano_wallet_stamp_icon_id.trim()
        : null,
    archetype_id:
      typeof row?.banano_wallet_archetype_id === 'string' &&
      isWalletArchetypeId(row.banano_wallet_archetype_id.trim())
        ? row.banano_wallet_archetype_id.trim()
        : null,
    preview_balance_mode: preview,
    loyalty_mode: loyaltyMode,
    strip_crop: parseWalletStripCropJson(row?.banano_wallet_strip_crop_json),
    establishment_name: String(row?.establishment_name ?? '').trim(),
  };

  return NextResponse.json(payload);
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  let body: Partial<{
    background_color: string | null;
    foreground_color: string | null;
    label_color: string | null;
    logo_text: string | null;
    logo_url: string | null;
    strip_image_url: string | null;
    custom_css: string | null;
    theme_illustration_id: string | null;
    stamp_icon_id: string | null;
    archetype_id: string | null;
    preview_balance_mode: 'stamps' | 'points' | null;
    strip_crop: { focalX: number; focalY: number; zoom: number } | null;
  }>;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const update: Record<string, unknown> = {};
  const setStr = (k: keyof typeof update, v: unknown) => {
    if (v === undefined) return;
    if (v === null) {
      update[k] = null;
      return;
    }
    if (typeof v === 'string') {
      update[k] = v.trim() === '' ? null : v.trim();
    }
  };

  setStr('banano_wallet_pass_background_color', body.background_color);
  setStr('banano_wallet_pass_foreground_color', body.foreground_color);
  setStr('banano_wallet_pass_label_color', body.label_color);
  setStr('banano_wallet_logo_text', body.logo_text);
  setStr('banano_wallet_logo_url', body.logo_url);
  setStr('banano_wallet_strip_image_url', body.strip_image_url);
  setStr('banano_wallet_custom_css', body.custom_css);
  if (body.theme_illustration_id !== undefined) {
    if (body.theme_illustration_id === null) {
      update.banano_wallet_theme_illustration_id = null;
    } else if (
      typeof body.theme_illustration_id === 'string' &&
      isWalletThemeIllustrationId(body.theme_illustration_id.trim())
    ) {
      update.banano_wallet_theme_illustration_id = body.theme_illustration_id.trim();
    }
  }
  if (body.stamp_icon_id !== undefined) {
    if (body.stamp_icon_id === null) {
      update.banano_wallet_stamp_icon_id = null;
    } else if (
      typeof body.stamp_icon_id === 'string' &&
      isWalletStampIconId(body.stamp_icon_id.trim())
    ) {
      update.banano_wallet_stamp_icon_id = body.stamp_icon_id.trim();
    }
  }
  if (body.archetype_id !== undefined) {
    if (body.archetype_id === null) {
      update.banano_wallet_archetype_id = null;
    } else if (
      typeof body.archetype_id === 'string' &&
      isWalletArchetypeId(body.archetype_id.trim())
    ) {
      update.banano_wallet_archetype_id = body.archetype_id.trim();
    }
  }
  if (body.preview_balance_mode !== undefined) {
    if (body.preview_balance_mode === null) {
      update.banano_wallet_preview_balance_mode = null;
    } else if (body.preview_balance_mode === 'stamps' || body.preview_balance_mode === 'points') {
      update.banano_wallet_preview_balance_mode = body.preview_balance_mode;
    }
  }
  if (body.strip_crop !== undefined) {
    if (body.strip_crop === null) {
      update.banano_wallet_strip_crop_json = null;
    } else if (typeof body.strip_crop === 'object' && body.strip_crop !== null) {
      const parsed = parseWalletStripCropJson(body.strip_crop);
      if (parsed) {
        update.banano_wallet_strip_crop_json = JSON.stringify(parsed);
      }
    }
  }

  if (Object.keys(update).length === 0) {
    return GET(req);
  }

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
  if (error) {
    console.error('[banano/wallet/design PATCH]', error.message);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  return GET(req);
}
