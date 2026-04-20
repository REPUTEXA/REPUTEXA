/**
 * Affiche de conformité RGPD — PDF comptoir ou mur (@react-pdf/renderer)
 *
 * Formats : A4 (défaut), A5 (compact), A3 (lisible de loin).
 * Polices : Helvetica / Helvetica-Bold (standard PDF, pas d’embedding WOFF2 — évite les crashs fontkit).
 * Pas de QR : URLs lisibles suffisent en comptoir ; pas de dépendance qrcode.
 */

import React from 'react';
import {
  ZENITH_QUEUE_RETENTION_DAYS,
  ZENITH_RESOLICITATION_COOLDOWN_DAYS,
} from '@/lib/zenith-capture/policy';
import { getSiteUrl } from '@/lib/site-url';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Path,
  Circle,
  Line,
  Rect,
  renderToBuffer,
} from '@react-pdf/renderer';
import { REPUTEXA_PDF } from '@/lib/pdf/reputexa-react-pdf-tokens';
import {
  getSentinelPdfFooterLines,
  SentinelReactPdfFooter,
} from '@/lib/pdf/sentinel-react-pdf-footer';
import { pdfPayloadIntegritySha256Hex } from '@/lib/pdf/sentinel-pdf-integrity';

const BG = REPUTEXA_PDF.pageBg;
const INK = REPUTEXA_PDF.ink;
const BODY = REPUTEXA_PDF.body;
const MUTED = REPUTEXA_PDF.muted;
const RULE = REPUTEXA_PDF.navy;
const ACCENT_BOX = REPUTEXA_PDF.rowAlt;

const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';

/** Incrémenter à chaque révision substantielle des mentions légales affichées. */
export const COMPLIANCE_POSTER_TEXT_VERSION = 19;

export type CompliancePosterPaper = 'A4' | 'A5' | 'A3';

const PAPER_LAYOUT: Record<CompliancePosterPaper, { marginPt: number; scale: number }> = {
  A4: { marginPt: 20, scale: 1 },
  A5: { marginPt: 24, scale: 0.68 },
  A3: { marginPt: 48, scale: 1.22 },
};

function sc(scale: number, n: number): number {
  return Math.round(n * scale * 10) / 10;
}

function SepLine() {
  return <View style={{ height: 0.4, width: '100%', backgroundColor: RULE }} />;
}

type BlockProps = { icon: React.ReactElement; title: string; lines: string[]; scale: number };

function InfoBlock({ icon, title, lines, scale }: BlockProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: sc(scale, 9) }}>
      <View style={{ width: sc(scale, 34), alignItems: 'center', paddingTop: 2, marginRight: sc(scale, 10) }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: FONT_BOLD,
            fontSize: sc(scale, 10.5),
            color: INK,
            marginBottom: sc(scale, 4),
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          {title}
        </Text>
        {lines.map((line, i) => (
          <Text
            key={i}
            style={{
              fontFamily: FONT,
              fontSize: sc(scale, 10.8),
              color: BODY,
              lineHeight: 1.38,
              marginBottom: 1,
            }}
          >
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

function establishmentNameFontSize(name: string, scale: number): number {
  const n = name.length;
  let base = 36;
  if (n > 34) base = 24;
  else if (n > 26) base = 28;
  else if (n > 18) base = 31;
  return Math.max(15, Math.round(base * scale));
}

type PosterTranslate = ReturnType<typeof createServerTranslator>;

type PosterProps = {
  name: string;
  privacyUrl: string;
  erasureUrl: string;
  paper: CompliancePosterPaper;
  networkBrand?: string | null;
  generatedLine: string;
  integrityLine: string;
  t: PosterTranslate;
};

function PosterDocument({
  name,
  privacyUrl,
  erasureUrl,
  paper,
  networkBrand,
  generatedLine,
  integrityLine,
  t,
}: PosterProps) {
  const { marginPt, scale } = PAPER_LAYOUT[paper];
  const printHint =
    paper === 'A4' ? t('printHint_A4') : paper === 'A5' ? t('printHint_A5') : t('printHint_A3');
  const nameSize = establishmentNameFontSize(name, scale);
  const iconScale = scale;
  const net = networkBrand?.trim();
  const vosDonneesLines = [
    ...(net ? [t('vosDonneesNetworkLine', { net })] : []),
    t('vosDonnees1'),
    t('vosDonnees2'),
    t('vosDonnees3'),
    t('vosDonnees4'),
  ];
  const lock = (
    <Svg width={sc(iconScale, 30)} height={sc(iconScale, 30)} viewBox="0 0 24 24">
      <Rect x="3" y="11" width="18" height="11" rx="2" stroke={INK} strokeWidth={0.75} fill="none" />
      <Path d="M7 11V7a5 5 0 0110 0v4" stroke={INK} strokeWidth={0.75} fill="none" />
      <Circle cx="12" cy="16.4" r="1.25" stroke={INK} strokeWidth={0.75} fill="none" />
      <Line x1="12" y1="17.65" x2="12" y2="19.3" stroke={INK} strokeWidth={0.75} />
    </Svg>
  );
  const bubble = (
    <Svg width={sc(iconScale, 30)} height={sc(iconScale, 31)} viewBox="0 0 26 28">
      <Circle cx="13" cy="10.5" r="9" stroke={INK} strokeWidth={0.75} fill="none" />
      <Path d="M8 18.5 L4.5 24 L13.5 18.5" stroke={INK} strokeWidth={0.75} fill="none" />
    </Svg>
  );
  const hourglass = (
    <Svg width={sc(iconScale, 30)} height={sc(iconScale, 33)} viewBox="0 0 24 28">
      <Line x1="2" y1="2" x2="22" y2="2" stroke={INK} strokeWidth={0.75} />
      <Line x1="2" y1="26" x2="22" y2="26" stroke={INK} strokeWidth={0.75} />
      <Line x1="2" y1="2" x2="12" y2="14" stroke={INK} strokeWidth={0.75} />
      <Line x1="22" y1="2" x2="12" y2="14" stroke={INK} strokeWidth={0.75} />
      <Line x1="12" y1="14" x2="2" y2="26" stroke={INK} strokeWidth={0.75} />
      <Line x1="12" y1="14" x2="22" y2="26" stroke={INK} strokeWidth={0.75} />
      <Line x1="5.5" y1="21.5" x2="18.5" y2="21.5" stroke={INK} strokeWidth={1.2} />
    </Svg>
  );

  return (
    <Document title={t('docTitle', { name })} subject={t('docSubject')} creator="REPUTEXA">
      <Page
        size={paper}
        style={{
          backgroundColor: BG,
          padding: marginPt,
          fontFamily: FONT,
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight:
              paper === 'A4' ? 802 : paper === 'A3' ? 1190.55 - marginPt * 2 : paper === 'A5' ? 595.28 - marginPt * 2 : undefined,
          }}
        >
          <View style={{ flexShrink: 0 }}>
            <View style={{ marginBottom: sc(scale, 6) }}>
              <Text
                style={{
                  fontFamily: FONT_BOLD,
                  fontSize: sc(scale, 7.5),
                  color: MUTED,
                  letterSpacing: 0.35,
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  marginBottom: sc(scale, 5),
                }}
              >
                {t('kicker')}
              </Text>

              <Text
                style={{
                  fontFamily: FONT_BOLD,
                  fontSize: nameSize,
                  color: INK,
                  textAlign: 'center',
                  letterSpacing: 0.4,
                  lineHeight: 1.15,
                }}
              >
                {name.trim().toUpperCase() || t('placeholderEstablishment')}
              </Text>
            </View>

            <SepLine />

            <View style={{ paddingVertical: sc(scale, 8) }}>
              <Text
                style={{
                  fontFamily: FONT_BOLD,
                  fontSize: sc(scale, 11.2),
                  color: INK,
                  textAlign: 'center',
                  lineHeight: 1.32,
                }}
              >
                {t('leadWhatsApp')}
              </Text>
              <Text
                style={{
                  fontFamily: FONT,
                  fontSize: sc(scale, 9.2),
                  color: MUTED,
                  textAlign: 'center',
                  marginTop: sc(scale, 4),
                  lineHeight: 1.32,
                }}
              >
                {t('objectiveBlock')}
              </Text>
            </View>

            <SepLine />
          </View>

          <View style={{ flexShrink: 0, flexGrow: 1, justifyContent: 'center' }}>
            <View style={{ paddingTop: sc(scale, 9), paddingBottom: sc(scale, 2) }}>
              <InfoBlock icon={lock} scale={scale} title={t('vosDonneesTitle')} lines={vosDonneesLines} />

              <InfoBlock
                icon={bubble}
                scale={scale}
                title={t('sollicitationsTitle')}
                lines={[t('sollicitations1'), t('sollicitations2'), t('sollicitations3')]}
              />

              <InfoBlock
                icon={hourglass}
                scale={scale}
                title={t('dureeTitle')}
                lines={[
                  t('duree1'),
                  t('duree2', { queueDays: ZENITH_QUEUE_RETENTION_DAYS }),
                  t('duree3', { cooldownDays: ZENITH_RESOLICITATION_COOLDOWN_DAYS }),
                  t('duree4'),
                ]}
              />
            </View>

            <View
              style={{
                backgroundColor: ACCENT_BOX,
                borderLeftWidth: 3,
                borderLeftColor: INK,
                paddingVertical: sc(scale, 8),
                paddingHorizontal: sc(scale, 12),
                marginBottom: sc(scale, 4),
              }}
            >
              <Text
                style={{
                  fontFamily: FONT_BOLD,
                  fontSize: sc(scale, 11.8),
                  color: INK,
                  textAlign: 'center',
                  lineHeight: 1.38,
                }}
              >
                {t('stopBanner')}
              </Text>
            </View>
          </View>

          <View style={{ flexShrink: 0 }} wrap={false}>
            <SepLine />

            <View style={{ paddingTop: sc(scale, 6), paddingBottom: sc(scale, 4) }} wrap={false}>
              <Text
                style={{
                  fontFamily: FONT_BOLD,
                  fontSize: sc(scale, 8.5),
                  color: INK,
                  marginBottom: sc(scale, 4),
                }}
              >
                {t('pourAllerPlusLoin')}
              </Text>
              <Text
                style={{
                  fontFamily: FONT,
                  fontSize: sc(scale, 8),
                  color: BODY,
                  lineHeight: 1.32,
                  marginBottom: sc(scale, 2),
                }}
              >
                {t('politiqueUnique')}
              </Text>
              <Text
                style={{
                  fontFamily: FONT_BOLD,
                  fontSize: sc(scale, 7.5),
                  color: INK,
                  lineHeight: 1.3,
                  marginBottom: sc(scale, 5),
                }}
              >
                {privacyUrl}
              </Text>
              <Text
                style={{
                  fontFamily: FONT,
                  fontSize: sc(scale, 8),
                  color: BODY,
                  lineHeight: 1.32,
                  marginBottom: sc(scale, 2),
                }}
              >
                {t('demandeEffacement')}
              </Text>
              <Text style={{ fontFamily: FONT_BOLD, fontSize: sc(scale, 7.5), color: INK, lineHeight: 1.3 }}>
                {erasureUrl}
              </Text>
            </View>

            <SepLine />

            <View style={{ alignItems: 'center', paddingTop: sc(scale, 5) }} wrap={false}>
              <Svg width={sc(scale, 18)} height={sc(scale, 18)} viewBox="0 0 22 22">
                <Circle cx="11" cy="11" r="9.5" stroke={MUTED} strokeWidth={0.55} fill="none" />
                <Path
                  d="M7.5 6.5 L7.5 15.5 M7.5 6.5 L12 6.5 C14.2 6.5 14.2 10.5 12 10.5 L7.5 10.5 M11.5 10.5 L14.5 15.5"
                  stroke={MUTED}
                  strokeWidth={0.75}
                  fill="none"
                />
              </Svg>
              <Text
                style={{
                  fontFamily: FONT_BOLD,
                  fontSize: sc(scale, 7.5),
                  color: MUTED,
                  letterSpacing: 0.5,
                  marginTop: sc(scale, 2),
                }}
              >
                {t('brandWordmark')}
              </Text>
              <Text
                style={{
                  fontFamily: FONT,
                  fontSize: sc(scale, 6.2),
                  color: MUTED,
                  textAlign: 'center',
                  marginTop: sc(scale, 2),
                  lineHeight: 1.28,
                }}
              >
                {t('footerTechnical', {
                  printHint,
                  version: String(COMPLIANCE_POSTER_TEXT_VERSION),
                })}
              </Text>
            </View>
          </View>
        </View>
        <SentinelReactPdfFooter
          generatedLine={generatedLine}
          integrityLine={integrityLine}
          pageLine={t('sentinelPageLine', { version: String(COMPLIANCE_POSTER_TEXT_VERSION) })}
          left={marginPt + 4}
          right={marginPt + 4}
          bottom={10}
        />
      </Page>
    </Document>
  );
}

export function parseCompliancePosterPaper(raw: string | null | undefined): CompliancePosterPaper {
  const u = raw?.trim().toUpperCase();
  if (u === 'A5' || u === 'A3') return u;
  return 'A4';
}

export async function generateCompliancePosterPdfBuffer(
  establishmentName: string,
  _logoDataUrl?: string | null,
  paper: CompliancePosterPaper = 'A4',
  legalLocale: string = 'fr',
  networkBrand?: string | null
): Promise<Buffer> {
  const loc = normalizeAppLocale(legalLocale);
  const t = createServerTranslator('CompliancePoster', loc);
  const base = getSiteUrl().replace(/\/$/, '');
  const privacyUrl = `${base}/${loc}/legal/confidentialite`;
  const erasureUrl = `${base}/${loc}/data-rights/client`;

  const displayName = establishmentName?.trim() || t('defaultEstablishmentName');
  const net = networkBrand?.trim() || null;
  const sentinelGeneratedAt = new Date();
  const sentinelSha256Hex = await pdfPayloadIntegritySha256Hex({
    kind: 'compliance-poster',
    v: COMPLIANCE_POSTER_TEXT_VERSION,
    establishmentName: displayName,
    privacyUrl,
    erasureUrl,
    paper,
    networkBrand: net,
  });

  const sentinelLines = getSentinelPdfFooterLines(loc, sentinelGeneratedAt, sentinelSha256Hex);

  return renderToBuffer(
    <PosterDocument
      name={displayName}
      privacyUrl={privacyUrl}
      erasureUrl={erasureUrl}
      paper={paper}
      networkBrand={net}
      generatedLine={sentinelLines.generatedLine}
      integrityLine={sentinelLines.integrityLine}
      t={t}
    />
  );
}
