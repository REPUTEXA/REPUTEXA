import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createClient } from '@/lib/supabase/server';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import {
  guessCrmImportMapping,
  mergeMapping,
  mappingFromAiHeaders,
  type CrmImportColumnMapping,
} from '@/lib/banano/crm-import';
import { aiMapCrmImportColumns } from '@/lib/banano/crm-import-openai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  headers: z.array(z.string()).min(1).max(200),
  sampleRows: z.array(z.array(z.any())).max(25),
  totalRows: z.number().int().min(1).max(10_000),
});

function previewMappingErrorKey(
  guessed: ReturnType<typeof guessCrmImportMapping>
): 'errors.crm_importNoColumnDetected' | 'errors.crm_importPhoneColumnMissing' | 'errors.crm_importColumnsUndetected' {
  if ('error' in guessed) {
    if (guessed.error === 'no_column_detected') return 'errors.crm_importNoColumnDetected';
    if (guessed.error === 'phone_column_missing') return 'errors.crm_importPhoneColumnMissing';
  }
  return 'errors.crm_importColumnsUndetected';
}

function shellMapping(phoneIndex: number): CrmImportColumnMapping {
  return {
    phoneIndex,
    firstNameIndex: null,
    lastNameIndex: null,
    fullNameIndex: null,
    pointsBalanceIndex: null,
    stampsBalanceIndex: null,
  };
}

function stringifyRow(r: unknown[]): string[] {
  return r.map((c) => {
    if (c == null) return '';
    if (typeof c === 'string') return c.trim();
    if (typeof c === 'number' && Number.isFinite(c)) return String(c);
    if (c instanceof Date && !Number.isNaN(c.getTime())) return c.toISOString().slice(0, 10);
    return String(c).trim();
  });
}

function buildFallbackNarrative(
  headers: string[],
  m: CrmImportColumnMapping,
  totalRows: number,
  loyaltyMode: 'points' | 'stamps',
  tm: ReturnType<typeof createServerTranslator>
): string {
  const cn = (i: number | null) => (i != null && i < headers.length ? `«${headers[i]}»` : null);
  const phoneL = cn(m.phoneIndex);
  const nameBits: string[] = [];
  if (m.firstNameIndex != null || m.lastNameIndex != null) {
    const a = [cn(m.firstNameIndex), cn(m.lastNameIndex)].filter(Boolean).join(' + ');
    if (a) nameBits.push(tm('crmImportFallback_nameFirstLast', { parts: a }));
  }
  if (m.fullNameIndex != null) {
    const col = cn(m.fullNameIndex);
    if (col) nameBits.push(tm('crmImportFallback_displayName', { col }));
  }
  const balBits: string[] = [];
  if (m.pointsBalanceIndex != null) {
    const col = cn(m.pointsBalanceIndex);
    if (col) balBits.push(tm('crmImportFallback_pointsCol', { col }));
  }
  if (m.stampsBalanceIndex != null) {
    const col = cn(m.stampsBalanceIndex);
    if (col) balBits.push(tm('crmImportFallback_stampsCol', { col }));
  }
  if (balBits.length === 0 && loyaltyMode === 'points') {
    balBits.push(tm('crmImportFallback_pointsMissing'));
  }
  if (balBits.length === 0 && loyaltyMode === 'stamps') {
    balBits.push(tm('crmImportFallback_stampsMissing'));
  }
  return [
    tm('crmImportFallback_rowCount', { count: totalRows }),
    phoneL ? tm('crmImportFallback_phone', { phone: phoneL }) : '',
    nameBits.length ? `${nameBits.join(' ; ')}.` : tm('crmImportFallback_namePending'),
    tm('crmImportFallback_balancesLine', { parts: balBits.join(' ; ') }),
    tm('crmImportFallback_mergeHint'),
  ]
    .filter(Boolean)
    .join(' ');
}

export async function POST(req: Request) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return apiJsonError(req, 'badRequest', 400);
  }

  const { headers, totalRows } = parsed.data;
  const sampleRows = parsed.data.sampleRows.map(stringifyRow);

  const { data: profile } = await supabase
    .from('profiles')
    .select('banano_loyalty_mode')
    .eq('id', user.id)
    .maybeSingle();

  const loyaltyMode =
    profile && (profile as { banano_loyalty_mode?: string }).banano_loyalty_mode === 'stamps'
      ? 'stamps'
      : 'points';

  const guessed = guessCrmImportMapping(headers, loyaltyMode);
  let mapping: CrmImportColumnMapping | null = 'error' in guessed ? null : guessed;
  const hadHeuristic = mapping != null;

  const aiResult = await aiMapCrmImportColumns({
    headers,
    sampleRows,
    totalRows,
    loyaltyMode,
  });

  if (aiResult) {
    const patch = mappingFromAiHeaders({
      headers,
      phoneHeader: aiResult.phoneHeader,
      firstNameHeader: aiResult.firstNameHeader ?? null,
      lastNameHeader: aiResult.lastNameHeader ?? null,
      fullNameHeader: aiResult.fullNameHeader ?? null,
      pointsBalanceHeader: aiResult.pointsBalanceHeader ?? null,
      stampsBalanceHeader: aiResult.stampsBalanceHeader ?? null,
    });
    if (patch.phoneIndex != null) {
      mapping = mapping
        ? mergeMapping(mapping, patch)
        : mergeMapping(shellMapping(patch.phoneIndex), patch);
    }
  }

  if (!mapping) {
    return apiJsonError(req, previewMappingErrorKey(guessed), 400);
  }

  const source: 'heuristic' | 'ai' | 'hybrid' = hadHeuristic
    ? aiResult
      ? 'hybrid'
      : 'heuristic'
    : 'ai';

  const narrative =
    aiResult?.narrative?.trim() ||
    buildFallbackNarrative(headers, mapping, totalRows, loyaltyMode, tm);

  return NextResponse.json({
    mapping,
    source,
    narrative,
    loyaltyMode,
  });
}
