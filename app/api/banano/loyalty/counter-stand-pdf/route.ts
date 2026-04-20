import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { getSiteUrl } from '@/lib/site-url';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { ensureBananoTerminalPublicSlug } from '@/lib/banano/ensure-terminal-slug';

/**
 * PDF « chevalet » A5 : QR vers la page publique d'inscription Wallet (/banano/join/[slug]).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('establishment_name, language, role')
    .eq('id', user.id)
    .maybeSingle();

  if (pErr || !profile) {
    return apiJsonError(request, 'serverError', 500);
  }

  if ((profile as { role?: string }).role === 'merchant_staff') {
    return apiJsonError(request, 'forbidden', 403);
  }

  let slug: string;
  try {
    slug = await ensureBananoTerminalPublicSlug(supabase, user.id);
  } catch (e) {
    console.error('[counter-stand-pdf] slug', e);
    return apiJsonError(request, 'serverError', 500);
  }

  const locale = normalizeAppLocale((profile as { language?: string }).language ?? 'fr');
  const base = getSiteUrl().replace(/\/+$/, '');
  const joinUrl = `${base}/${locale}/banano/join/${encodeURIComponent(slug)}`;

  const establishmentName = ((profile as { establishment_name?: string }).establishment_name ?? '').trim() || 'REPUTEXA';

  let dataUrl: string;
  try {
    dataUrl = await QRCode.toDataURL(joinUrl, {
      margin: 2,
      width: 400,
      errorCorrectionLevel: 'M',
    });
  } catch (e) {
    console.error('[counter-stand-pdf] qrcode', e);
    return apiJsonError(request, 'serverError', 500);
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
  const pageW = pdf.internal.pageSize.getWidth();

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(establishmentName, pageW / 2, 16, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('Scan : carte Wallet (Apple / Google) et fidélité', pageW / 2, 24, { align: 'center' });

  const imgSize = 72;
  const x = (pageW - imgSize) / 2;
  pdf.addImage(dataUrl, 'PNG', x, 30, imgSize, imgSize);

  pdf.setFontSize(7.5);
  pdf.setTextColor(80, 80, 80);
  const urlLines = pdf.splitTextToSize(joinUrl, pageW - 16);
  pdf.text(urlLines, pageW / 2, 30 + imgSize + 8, { align: 'center' });

  pdf.setFontSize(7);
  pdf.setTextColor(120, 120, 120);
  pdf.text('REPUTEXA · Impression conseillée A5 ou A4 (100 %, sans « Ajuster à la page »).', pageW / 2, 128, {
    align: 'center',
  });

  const buf = pdf.output('arraybuffer');
  const safeName = establishmentName.replace(/[^\w\d\-]+/g, '_').slice(0, 40) || 'commerce';

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reputexa-chevalet-${safeName}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
