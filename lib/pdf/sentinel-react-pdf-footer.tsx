/**
 * Pied de page « vitré » — Sentinel REPUTEXA + empreinte SHA-256 (@react-pdf/renderer).
 */

import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { REPUTEXA_PDF } from '@/lib/pdf/reputexa-react-pdf-tokens';
import { formatSentinelGeneratedAtLocale } from '@/lib/pdf/sentinel-pdf-integrity';

export type SentinelReactPdfFooterProps = {
  /** Ligne complète (déjà localisée), ex. via `getSentinelPdfFooterLines`. */
  generatedLine: string;
  integrityLine: string;
  /** Ex. « REPUTEXA · Rapport confidentiel · Janvier 2026 · p. 1/2 » */
  pageLine?: string;
  left?: number;
  right?: number;
  bottom?: number;
  accentColor?: string;
  /** Fond sombre (page de garde) : texte clair. */
  onDarkBackground?: boolean;
};

/**
 * Charge les libellés via `messages/*.json` (pas `next-intl/server` getTranslations),
 * pour éviter un blocage dans les Route Handlers / génération PDF hors requête RSC.
 */
export function getSentinelPdfFooterLines(
  locale: string,
  generatedAt: Date,
  sha256Hex: string
): { generatedLine: string; integrityLine: string } {
  const t = createServerTranslator('Pdf', locale);
  const d = formatSentinelGeneratedAtLocale(generatedAt, locale);
  return {
    generatedLine: t('sentinelFooter.generated', { date: d }),
    integrityLine: t('sentinelFooter.integrity', { hash: sha256Hex }),
  };
}

export function SentinelReactPdfFooter({
  generatedLine,
  integrityLine,
  pageLine,
  left = 40,
  right = 40,
  bottom = 22,
  accentColor = REPUTEXA_PDF.gold,
  onDarkBackground = false,
}: SentinelReactPdfFooterProps) {
  const cMuted = onDarkBackground ? '#94a3b8' : REPUTEXA_PDF.muted;
  const cPage = onDarkBackground ? '#cbd5e1' : REPUTEXA_PDF.slate500;
  return (
    <View
      style={{
        position: 'absolute',
        bottom,
        left,
        right,
        borderTopWidth: 0.6,
        borderTopColor: accentColor,
        paddingTop: 5,
      }}
      wrap={false}
    >
      <Text
        style={{
          fontSize: 6.3,
          color: cMuted,
          textAlign: 'center',
          lineHeight: 1.28,
        }}
      >
        {generatedLine}
      </Text>
      <Text
        style={{
          fontSize: 5.8,
          color: cMuted,
          textAlign: 'center',
          marginTop: 2,
          lineHeight: 1.22,
        }}
      >
        {integrityLine}
      </Text>
      {pageLine ? (
        <Text
          style={{
            fontSize: 6.8,
            color: cPage,
            textAlign: 'center',
            marginTop: 4,
          }}
        >
          {pageLine}
        </Text>
      ) : null}
    </View>
  );
}
