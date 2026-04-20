import type { SupabaseClient } from '@supabase/supabase-js';
import { PKPass } from 'passkit-generator';
import { expireDueBananoVouchers } from '@/lib/banano/expire-loyalty-vouchers';
import { loyaltyConfigFromProfileRow } from '@/lib/banano/loyalty-profile';
import { loadAppleWalletCertificatesFromEnv } from '@/lib/banano/apple-wallet-certificates';
import { WALLET_PASS_MINI_PNG } from '@/lib/banano/wallet-pass-placeholder-png';
import { getBrandName } from '@/src/lib/empire-settings';
import { buildWalletBarcodePayload, buildWalletMemberScanUrl, createWalletPassTranslator } from '@/lib/wallet/pass-service';
import { buildWalletStripBuffersForPassKit } from '@/lib/banano/wallet-pass-strip-images';
import { parseWalletStripCropJson, UNIVERSAL_STRIP_CROP_DEFAULT } from '@/lib/wallet/wallet-strip-crop';
import { formatWalletPassBackDate } from '@/lib/wallet/wallet-pass-dates';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { normalizeWalletPassColor } from '@/lib/banano/wallet-design-utils';
import { getWalletArchetypeById, isWalletArchetypeId } from '@/lib/wallet/archetypes';
import { resolvePublicAssetUrlForServer } from '@/lib/wallet/resolve-public-asset-url';

async function fetchImageBuffer(
  url: string | null | undefined,
  maxBytes = 8 * 1024 * 1024
): Promise<Buffer | null> {
  if (typeof url !== 'string' || url.trim().length < 8) return null;
  const u = url.trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) return null;
  try {
    const r = await fetch(u, { cache: 'no-store' });
    if (!r.ok) return null;
    const ab = await r.arrayBuffer();
    if (ab.byteLength < 32 || ab.byteLength > maxBytes) return null;
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

function walletEventLabelI18n(
  t: ReturnType<typeof createWalletPassTranslator>,
  eventType: string
): string {
  switch (eventType) {
    case 'earn_points':
      return t('eventEarnPoints');
    case 'earn_stamps':
      return t('eventEarnStamps');
    case 'redeem_points':
      return t('eventRedeemPoints');
    case 'redeem_stamps':
      return t('eventRedeemStamps');
    case 'voucher_issued':
      return t('eventVoucherIssued');
    case 'voucher_redeemed':
      return t('eventVoucherRedeemed');
    case 'staff_allowance_issued':
      return t('eventStaffIssued');
    case 'staff_allowance_debit':
      return t('eventStaffDebit');
    case 'staff_allowance_merchant_adjust':
      return t('eventStaffAdjust');
    case 'member_created':
      return t('eventMemberCreated');
    default:
      return t('eventDefault');
  }
}

function formatWalletBackValueI18n(
  note: string | null,
  iso: string,
  siteLocale: string
): string {
  const d = formatWalletPassBackDate(iso, siteLocale);
  const n = (note ?? '').replace(/\s+/g, ' ').trim();
  const short = n.length > 72 ? `${n.slice(0, 69)}…` : n;
  return short ? `${d} — ${short}` : d;
}

function memberDisplayName(
  m: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  },
  emptyLabel: string
): string {
  const d = (m.display_name ?? '').trim();
  if (d) return d;
  const a = [m.first_name, m.last_name].map((x) => (x ?? '').trim()).filter(Boolean);
  return a.length ? a.join(' ') : emptyLabel;
}

export async function buildBananoAppleWalletPass(
  admin: SupabaseClient,
  merchantUserId: string,
  memberId: string
): Promise<Buffer> {
  const certs = loadAppleWalletCertificatesFromEnv();
  const passTypeIdentifier = process.env.APPLE_PASS_TYPE_IDENTIFIER?.trim();
  const teamIdentifier = process.env.APPLE_TEAM_ID?.trim();
  if (!certs || !passTypeIdentifier || !teamIdentifier) {
    throw new Error('Certificats Apple Wallet ou identifiants Pass non configurés.');
  }

  await expireDueBananoVouchers(admin, merchantUserId);

  const { data: member, error: memErr } = await admin
    .from('banano_loyalty_members')
    .select(
      'id, first_name, last_name, display_name, points_balance, stamps_balance, crm_role, receives_staff_allowance, preferred_locale'
    )
    .eq('id', memberId)
    .eq('user_id', merchantUserId)
    .maybeSingle();

  if (memErr || !member) {
    throw new Error('Membre introuvable.');
  }

  const memberRow = member as {
    preferred_locale?: string | null;
  };
  const siteLocale = normalizeAppLocale(memberRow.preferred_locale ?? undefined);
  const t = createWalletPassTranslator(memberRow.preferred_locale ?? null);

  const { data: profileRow, error: profErr } = await admin
    .from('profiles')
    .select('*')
    .eq('id', merchantUserId)
    .maybeSingle();

  if (profErr || !profileRow) {
    throw new Error('Profil commerçant introuvable.');
  }

  const cfg = loyaltyConfigFromProfileRow(profileRow as Record<string, unknown>);
  const mode = cfg.mode;
  const commerceName = String(
    (profileRow as { establishment_name?: string | null }).establishment_name ?? 'Review WhatsApp'
  ).trim();

  const { data: events } = await admin
    .from('banano_loyalty_events')
    .select('event_type, note, created_at')
    .eq('user_id', merchantUserId)
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(5);

  const receives = Boolean((member as { receives_staff_allowance?: boolean }).receives_staff_allowance);
  const role = String((member as { crm_role?: string | null }).crm_role ?? '').trim();
  const staffEnabled = Boolean(
    (profileRow as { banano_staff_allowance_enabled?: boolean }).banano_staff_allowance_enabled
  );
  const staffEligible = staffEnabled && receives && role === 'staff';

  let staffRemainingCents = 0;
  if (staffEligible) {
    const { data: staffVouchers } = await admin
      .from('banano_loyalty_vouchers')
      .select('remaining_euro_cents, status, expires_at')
      .eq('user_id', merchantUserId)
      .eq('member_id', memberId)
      .eq('voucher_class', 'staff_allowance')
      .eq('status', 'available');

    const nowMs = Date.now();
    for (const r of staffVouchers ?? []) {
      const row = r as { remaining_euro_cents?: number | null; expires_at?: string | null };
      const exp = row.expires_at;
      if (typeof exp === 'string' && exp && new Date(exp).getTime() < nowMs) continue;
      staffRemainingCents += Math.floor(Number(row.remaining_euro_cents ?? 0));
    }
  }

  const { count: rewardVoucherCount } = await admin
    .from('banano_loyalty_vouchers')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', merchantUserId)
    .eq('member_id', memberId)
    .eq('status', 'available')
    .neq('voucher_class', 'staff_allowance');

  const rewardCount = rewardVoucherCount ?? 0;

  const points = Math.floor(Number((member as { points_balance?: number }).points_balance ?? 0));
  const stamps = Math.floor(Number((member as { stamps_balance?: number }).stamps_balance ?? 0));

  const primaryName = memberDisplayName(
    member as Record<string, string | null | undefined>,
    t('fieldMember')
  );

  const geoNotifEnabled = Boolean(
    (profileRow as { banano_wallet_geo_notifications_enabled?: boolean | null })
      .banano_wallet_geo_notifications_enabled ?? true
  );
  const geoRaw = (profileRow as { banano_wallet_geo_points?: unknown }).banano_wallet_geo_points;
  const geoArr = Array.isArray(geoRaw) ? geoRaw : [];
  let maxDist: number | undefined;
  const locs: { latitude: number; longitude: number; relevantText?: string }[] = [];
  for (const g of geoArr) {
    if (!g || typeof g !== 'object') continue;
    const o = g as Record<string, unknown>;
    const lat = Number(o.lat ?? o.latitude);
    const lon = Number(o.lon ?? o.longitude ?? o.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const text = typeof o.relevantText === 'string' ? o.relevantText.trim() : '';
    const md = Number(o.maxDistanceMeters);
    if (Number.isFinite(md) && md > 0 && maxDist == null) maxDist = md;
    locs.push({
      latitude: lat,
      longitude: lon,
      relevantText: text || t('geoNearShop', { shop: commerceName }),
    });
  }

  const passDescription = t('passDescription', { shop: commerceName });
  const appleLang = siteLocale.split('-')[0] ?? 'fr';

  const pr = profileRow as Record<string, unknown>;
  const customLogoText =
    typeof pr.banano_wallet_logo_text === 'string' ? pr.banano_wallet_logo_text.trim() : '';
  const bg = normalizeWalletPassColor(
    typeof pr.banano_wallet_pass_background_color === 'string'
      ? pr.banano_wallet_pass_background_color
      : null,
    'rgb(15, 23, 42)'
  );
  const fg = normalizeWalletPassColor(
    typeof pr.banano_wallet_pass_foreground_color === 'string'
      ? pr.banano_wallet_pass_foreground_color
      : null,
    'rgb(254, 243, 199)'
  );
  const lab = normalizeWalletPassColor(
    typeof pr.banano_wallet_pass_label_color === 'string'
      ? pr.banano_wallet_pass_label_color
      : null,
    'rgb(148, 163, 184)'
  );

  const passJson = {
    formatVersion: 1 as const,
    passTypeIdentifier,
    teamIdentifier,
    organizationName: getBrandName(),
    description: passDescription,
    serialNumber: `banano-${memberId}`,
    logoText: customLogoText.length > 0 ? customLogoText.slice(0, 64) : t('organizationLogoText'),
    backgroundColor: bg,
    foregroundColor: fg,
    labelColor: lab,
    ...(maxDist != null && maxDist > 0 ? { maxDistance: maxDist } : {}),
    storeCard: {
      headerFields: [],
      primaryFields: [],
      secondaryFields: [],
      auxiliaryFields: [],
      backFields: [],
    },
  };

  const pass = new PKPass(
    {
      'pass.json': Buffer.from(JSON.stringify(passJson), 'utf8'),
      'icon.png': WALLET_PASS_MINI_PNG,
      'icon@2x.png': WALLET_PASS_MINI_PNG,
      'logo.png': WALLET_PASS_MINI_PNG,
      'logo@2x.png': WALLET_PASS_MINI_PNG,
    },
    certs,
    {
      serialNumber: `banano-${memberId}`,
      ...(maxDist != null && maxDist > 0 ? { maxDistance: maxDist } : {}),
    }
  );

  const logoRemote =
    typeof pr.banano_wallet_logo_url === 'string' ? pr.banano_wallet_logo_url.trim() : '';
  let stripFetchUrl =
    typeof pr.banano_wallet_strip_image_url === 'string' ? pr.banano_wallet_strip_image_url.trim() : '';
  if (!stripFetchUrl) {
    const archRaw = typeof pr.banano_wallet_archetype_id === 'string' ? pr.banano_wallet_archetype_id.trim() : '';
    if (archRaw && isWalletArchetypeId(archRaw)) {
      const arch = getWalletArchetypeById(archRaw);
      if (arch) stripFetchUrl = resolvePublicAssetUrlForServer(arch.stripImageUrl);
    }
  } else if (stripFetchUrl.startsWith('/')) {
    stripFetchUrl = resolvePublicAssetUrlForServer(stripFetchUrl);
  }
  const customLogoBuf = await fetchImageBuffer(logoRemote);
  if (customLogoBuf) {
    pass.addBuffer('logo.png', customLogoBuf);
    pass.addBuffer('logo@2x.png', customLogoBuf);
  }
  const stripBuf = stripFetchUrl ? await fetchImageBuffer(stripFetchUrl, 12 * 1024 * 1024) : null;
  if (stripBuf) {
    const customStrip =
      typeof pr.banano_wallet_strip_image_url === 'string' &&
      pr.banano_wallet_strip_image_url.trim().length > 0;
    const archForStrip =
      typeof pr.banano_wallet_archetype_id === 'string' && isWalletArchetypeId(pr.banano_wallet_archetype_id.trim())
        ? getWalletArchetypeById(pr.banano_wallet_archetype_id.trim())
        : undefined;
    const stripCropParsed = parseWalletStripCropJson(pr.banano_wallet_strip_crop_json);
    const stripCropEffective =
      stripCropParsed ?? archForStrip?.defaultStripCrop ?? UNIVERSAL_STRIP_CROP_DEFAULT;
    const stripPreCrop =
      !customStrip && archForStrip?.stripPreCrop ? archForStrip.stripPreCrop : null;
    const resized = await buildWalletStripBuffersForPassKit(stripBuf, {
      crop: stripCropEffective,
      stripPreCrop,
    });
    if (resized) {
      pass.addBuffer('strip.png', resized.strip1x);
      pass.addBuffer('strip@2x.png', resized.strip2x);
      pass.addBuffer('strip@3x.png', resized.strip3x);
    } else {
      pass.addBuffer('strip.png', stripBuf);
      pass.addBuffer('strip@2x.png', stripBuf);
      pass.addBuffer('strip@3x.png', stripBuf);
    }
  }

  if (mode === 'stamps') {
    pass.primaryFields.push({
      key: 'stamps',
      label: t('fieldStamps'),
      value: String(stamps),
    });
  } else {
    pass.primaryFields.push({
      key: 'points',
      label: t('fieldPoints'),
      value: String(points),
    });
  }
  pass.secondaryFields.push({
    key: 'name',
    label: t('fieldMember'),
    value: primaryName,
  });

  if (staffEligible && staffRemainingCents > 0) {
    const euros = (staffRemainingCents / 100).toLocaleString(
      siteLocale === 'fr' ? 'fr-FR' : siteLocale === 'de' ? 'de-DE' : 'en-GB',
      {
      minimumFractionDigits: staffRemainingCents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }
    );
    pass.auxiliaryFields.push({
      key: 'staff_meal',
      label: t('fieldStaffMeal'),
      value: `${euros} €`,
      changeMessage: t('changeMessageStaffMeal'),
    });
  }

  if (rewardCount > 0) {
    pass.auxiliaryFields.push({
      key: 'reward_hint',
      label: t('fieldReward'),
      value: rewardCount > 1 ? t('rewardManyAvailable', { count: rewardCount }) : t('rewardOneAvailable'),
      changeMessage: t('changeMessageReward'),
    });
  }

  const memberScanUrl = buildWalletMemberScanUrl(memberId);
  pass.backFields.push({
    key: 'member_scan_url',
    label: t('backFieldMemberLink'),
    value: memberScanUrl,
  });

  let i = 0;
  for (const ev of events ?? []) {
    const row = ev as { event_type: string; note: string | null; created_at: string };
    pass.backFields.push({
      key: `hist_${i++}`,
      label: walletEventLabelI18n(t, row.event_type),
      value: formatWalletBackValueI18n(row.note, row.created_at, siteLocale),
    });
  }

  if (!(events ?? []).length) {
    pass.backFields.push({
      key: 'hist_empty',
      label: t('history'),
      value: t('historyEmpty'),
    });
  }

  if (geoNotifEnabled && locs.length > 0) {
    pass.setLocations(...locs);
  }

  const barcodeMessage = buildWalletBarcodePayload(memberId);
  pass.setBarcodes({
    format: 'PKBarcodeFormatQR',
    message: barcodeMessage,
    messageEncoding: 'utf-8',
    altText: t('scanAltText'),
  });

  pass.localize(appleLang, {
    description: passDescription,
  });

  return pass.getAsBuffer();
}
