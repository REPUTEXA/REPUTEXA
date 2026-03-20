import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateCompliancePosterPdfBuffer } from '@/lib/compliance-poster-pdf-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/compliance-poster?establishmentName=...
 *
 * Génère l'affiche de conformité RGPD en PDF.
 * Authentification requise.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const establishmentName =
    request.nextUrl.searchParams.get('establishmentName') || 'Votre établissement';

  try {
    const buffer = await generateCompliancePosterPdfBuffer(establishmentName, null);
    const filename = `affiche-conformite-${establishmentName.replace(/\s+/g, '-').slice(0, 30)}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[compliance-poster]', err);
    return NextResponse.json({ error: 'Erreur lors de la génération.' }, { status: 500 });
  }
}
