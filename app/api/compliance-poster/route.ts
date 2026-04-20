import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import {
  generateCompliancePosterPdfBuffer,
  parseCompliancePosterPaper,
} from '@/lib/compliance-poster-pdf-server';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

export const dynamic = 'force-dynamic';
/** @react-pdf/renderer et Web Crypto : exécution Node (pas Edge). */
export const runtime = 'nodejs';

/**
 * GET /api/compliance-poster?establishmentName=...&paper=a4|a5|a3
 *
 * Génère l'affiche de conformité RGPD en PDF.
 * Authentification requise.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('legal_compliance_accepted, language')
    .eq('id', user.id)
    .maybeSingle();

  if (profile && !(profile as { legal_compliance_accepted?: boolean }).legal_compliance_accepted) {
    return apiJsonError(request, 'compliancePoster_legalGate', 403);
  }

  const establishmentName =
    request.nextUrl.searchParams.get('establishmentName') || 'Votre établissement';
  const networkBrand = request.nextUrl.searchParams.get('networkBrand')?.trim() || null;

  const paper = parseCompliancePosterPaper(request.nextUrl.searchParams.get('paper'));
  const localeParam = request.nextUrl.searchParams.get('locale')?.toLowerCase().trim();
  const profileLang =
    (profile as { language?: string } | null)?.language?.toLowerCase().trim() ?? undefined;
  const posterLocale = normalizeAppLocale(localeParam ?? profileLang);

  try {
    const buffer = await generateCompliancePosterPdfBuffer(
      establishmentName,
      null,
      paper,
      posterLocale,
      networkBrand
    );
    const paperSlug = paper.toLowerCase();
    const filename = `affiche-conformite-${establishmentName.replace(/\s+/g, '-').slice(0, 30)}-${paperSlug}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[compliance-poster]', err);
    return apiJsonError(request, 'compliancePoster_generationFailed', 500);
  }
}
