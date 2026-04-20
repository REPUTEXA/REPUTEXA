/**
 * GET /api/compliance/certificate?locale=fr&country=GB
 * Certificat PDF « diligence » pour la collecte d'avis — compte marchand authentifié.
 * `country` ou `privacy_jurisdiction` (uk|eu) ou en-tête Vercel `x-vercel-ip-country` :
 * pour GB/UK le PDF applique UK GDPR + DPA 2018 et le canal de plainte ICO.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiJsonError } from '@/lib/api/api-error-response';
import { generateComplianceCertificatePdfBuffer } from '@/lib/compliance-certificate-pdf-server';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { profileLocaleFromDatabase } from '@/lib/i18n/profile-locale';
import { fetchCurrentPublishedLegal } from '@/lib/legal/current-published';
import { privacyJurisdictionFromRequest } from '@/lib/legal/privacy-jurisdiction';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'legal_compliance_accepted, language, locale, preferred_language, establishment_name, legal_compliance_accepted_legal_version',
    )
    .eq('id', user.id)
    .maybeSingle();

  const prof = profile as {
    legal_compliance_accepted?: boolean;
    language?: string;
    locale?: string;
    preferred_language?: string;
    establishment_name?: string;
    legal_compliance_accepted_legal_version?: number | null;
  } | null;

  if (!prof?.legal_compliance_accepted) {
    return apiJsonError(request, 'complianceCertificate_legalGate', 403);
  }

  const localeParam = request.nextUrl.searchParams.get('locale')?.toLowerCase().trim();
  const posterLocale = normalizeAppLocale(localeParam ?? profileLocaleFromDatabase(prof));
  const privacyJurisdiction = privacyJurisdictionFromRequest(request);

  const admin = createAdminClient();
  let legalVersion = 0;
  let effectiveDate = '';
  let lastGuardianAt: string | null = null;
  let guardianStatus = '—';

  if (admin) {
    const published = await fetchCurrentPublishedLegal(admin);
    legalVersion = published?.version ?? 0;
    effectiveDate = published?.effective_date ?? '';
    const { data: g } = await admin.from('legal_guardian_state').select('last_run_at, last_status').eq('id', 1).maybeSingle();
    if (g) {
      lastGuardianAt = (g as { last_run_at?: string }).last_run_at ?? null;
      guardianStatus = String((g as { last_status?: string }).last_status ?? '—');
    }
  }

  const establishmentName =
    prof.establishment_name?.trim() || user.user_metadata?.establishment_name?.toString() || 'Votre établissement';

  try {
    const buffer = await generateComplianceCertificatePdfBuffer(
      {
        establishmentName,
        merchantEmail: user.email ?? null,
        legalVersion,
        legalEffectiveDate: effectiveDate,
        lastGuardianAt,
        guardianStatus,
        complianceAcceptedVersion: prof.legal_compliance_accepted_legal_version ?? null,
      },
      posterLocale,
      privacyJurisdiction
    );

    const safeName = establishmentName.replace(/\s+/g, '-').slice(0, 28);
    const filename = `reputexa-certificat-conformite-${safeName}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[compliance/certificate]', err);
    return apiJsonError(request, 'compliancePoster_generationFailed', 500);
  }
}
