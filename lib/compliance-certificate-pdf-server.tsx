/**
 * Certificat de conformité « collecte d'avis » — PDF marchand (@react-pdf/renderer)
 */

import React from 'react';
import { Document, Page, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { getSiteUrl } from '@/lib/site-url';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { getComplianceCertificateStrings } from '@/lib/legal/compliance-certificate-content';
import type { PrivacyJurisdiction } from '@/lib/legal/privacy-jurisdiction';
import { REPUTEXA_PDF } from '@/lib/pdf/reputexa-react-pdf-tokens';
import {
  getSentinelPdfFooterLines,
  SentinelReactPdfFooter,
} from '@/lib/pdf/sentinel-react-pdf-footer';
import { pdfPayloadIntegritySha256Hex } from '@/lib/pdf/sentinel-pdf-integrity';

const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const INK = REPUTEXA_PDF.ink;
const BODY = REPUTEXA_PDF.body;
const MUTED = REPUTEXA_PDF.muted;

export type ComplianceCertificateSnapshot = {
  establishmentName: string;
  merchantEmail: string | null;
  legalVersion: number;
  legalEffectiveDate: string;
  lastGuardianAt: string | null;
  guardianStatus: string;
  complianceAcceptedVersion: number | null;
};

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString(locale === 'en' ? 'en-GB' : locale === 'de' ? 'de-DE' : 'fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export async function generateComplianceCertificatePdfBuffer(
  snapshot: ComplianceCertificateSnapshot,
  locale: string,
  privacyJurisdiction: PrivacyJurisdiction = 'eu_gdpr'
): Promise<Buffer> {
  const loc = normalizeAppLocale(locale);
  const s = getComplianceCertificateStrings(loc, privacyJurisdiction);
  const base = getSiteUrl().replace(/\/$/, '');
  const legalUrl = `${base}/${loc}/legal/confidentialite`;
  const displayName = snapshot.establishmentName?.trim() || '—';
  const generatedAt = new Date();
  const integritySha256Hex = await pdfPayloadIntegritySha256Hex({
    kind: 'compliance-certificate',
    v: 1,
    snapshot,
    locale: loc,
    privacyJurisdiction,
  });

  const sentinelLines = getSentinelPdfFooterLines(loc, generatedAt, integritySha256Hex);

  return renderToBuffer(
    <Document>
      <Page size="A4" style={{ padding: 0, fontFamily: FONT, color: BODY, backgroundColor: REPUTEXA_PDF.pageBg }}>
        <View
          style={{
            backgroundColor: REPUTEXA_PDF.navy,
            paddingHorizontal: 40,
            paddingTop: 28,
            paddingBottom: 18,
            marginBottom: 22,
          }}
          wrap={false}
        >
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 9, color: REPUTEXA_PDF.gold, letterSpacing: 0.8 }}>REPUTEXA</Text>
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 17, color: REPUTEXA_PDF.white, marginTop: 8 }}>{s.docTitle}</Text>
          <Text style={{ fontSize: 10, color: '#cbd5e1', marginTop: 6 }}>{s.subtitle}</Text>
          <View style={{ height: 2, backgroundColor: REPUTEXA_PDF.gold, marginTop: 14, width: 48 }} />
        </View>
        <View style={{ paddingHorizontal: 40, paddingBottom: 56 }}>

        <Text style={{ fontSize: 10, marginBottom: 4 }}>
          <Text style={{ fontFamily: FONT_BOLD }}>{s.issuedFor}: </Text>
          {displayName}
        </Text>
        {snapshot.merchantEmail ? (
          <Text style={{ fontSize: 9, color: MUTED, marginBottom: 16 }}>{snapshot.merchantEmail}</Text>
        ) : (
          <Text style={{ fontSize: 9, color: MUTED, marginBottom: 16 }} />
        )}

        <Text style={{ fontFamily: FONT_BOLD, fontSize: 11, color: INK, marginBottom: 6 }}>{s.sectionPurpose}</Text>
        <Text style={{ fontSize: 9.5, lineHeight: 1.45, marginBottom: 14 }}>{s.sectionPurposeBody}</Text>

        <Text style={{ fontFamily: FONT_BOLD, fontSize: 11, color: INK, marginBottom: 6 }}>{s.sectionStack}</Text>
        <View style={{ marginBottom: 14 }}>
          {[s.bulletConsent, s.bulletVersioning, s.bulletGuardian, s.bulletPoster].map((line, i) => (
            <Text key={i} style={{ fontSize: 9.5, lineHeight: 1.4, marginBottom: 4 }}>
              • {line}
            </Text>
          ))}
        </View>

        <Text style={{ fontFamily: FONT_BOLD, fontSize: 11, color: INK, marginBottom: 6 }}>{s.sectionLegalRef}</Text>
        <View
          style={{
            backgroundColor: REPUTEXA_PDF.cardBg,
            borderWidth: 1,
            borderColor: REPUTEXA_PDF.border,
            borderRadius: 4,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <Text style={{ fontSize: 9.5 }}>
            {s.versionLabel}:{' '}
            <Text style={{ fontFamily: FONT_BOLD }}>{`${s.versionPrefix}${snapshot.legalVersion}`}</Text>
          </Text>
          <Text style={{ fontSize: 9.5, marginTop: 4 }}>
            {s.effectiveLabel}: {snapshot.legalEffectiveDate || '—'}
          </Text>
          <Text style={{ fontSize: 9.5, marginTop: 4 }}>
            {s.guardianLabel}: {formatDate(snapshot.lastGuardianAt, loc)} ({snapshot.guardianStatus})
          </Text>
          <Text style={{ fontSize: 9.5, marginTop: 4 }}>
            {s.consentAcceptedLabel}:{' '}
            {snapshot.complianceAcceptedVersion != null ? `v${snapshot.complianceAcceptedVersion}` : '—'}
          </Text>
          <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 8 }}>
            {s.policyUrlLabel} {legalUrl}
          </Text>
        </View>

        <Text style={{ fontFamily: FONT_BOLD, fontSize: 11, color: INK, marginBottom: 6 }}>{s.sectionAuthorities}</Text>
        <Text style={{ fontSize: 9, lineHeight: 1.4, marginBottom: 8 }}>{s.authoritiesBody}</Text>
        <Text style={{ fontSize: 9, lineHeight: 1.4, marginBottom: 14, fontFamily: FONT_BOLD, color: INK }}>
          {s.authorityComplaintLine}
        </Text>

        <Text
          style={{
            fontSize: 8.5,
            lineHeight: 1.35,
            color: MUTED,
            borderTopWidth: 1,
            borderTopColor: REPUTEXA_PDF.border,
            paddingTop: 10,
          }}
        >
          {s.disclaimer}
        </Text>
        <Text style={{ fontSize: 8, color: MUTED, marginTop: 10 }}>{s.footerGenerated}</Text>
        </View>
        <SentinelReactPdfFooter
          generatedLine={sentinelLines.generatedLine}
          integrityLine={sentinelLines.integrityLine}
          pageLine={`REPUTEXA · ${s.docTitle} · ${formatDate(generatedAt.toISOString(), loc)} UTC`}
          left={36}
          right={36}
          bottom={20}
        />
      </Page>
    </Document>
  );
}
