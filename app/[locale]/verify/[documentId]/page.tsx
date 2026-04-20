import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { VerifyDocumentView } from '@/components/verify/verify-document-view';
import {
  getDocumentAttestationById,
  isDocumentAttestationUuid,
} from '@/lib/verify/document-attestation-server';

type Props = { params: Promise<{ locale: string; documentId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Verify' });
  return {
    title: t('metaTitle'),
    robots: { index: false, follow: false },
  };
}

export default async function VerifyDocumentPage({ params }: Props) {
  const { locale, documentId } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Verify' });

  const row =
    isDocumentAttestationUuid(documentId) ? await getDocumentAttestationById(documentId) : null;

  const valid = !!row;
  const issuedDisplay = row
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(row.created_at))
    : undefined;
  const fingerprint = row ? row.content_sha256.slice(0, 8) : undefined;

  const validBody = row
    ? t('validBody', {
        issuer: row.issuer_legal_name,
        date: issuedDisplay ?? '',
      })
    : '';

  return (
    <VerifyDocumentView
      valid={valid}
      issuerName={row?.issuer_legal_name}
      issuedDisplay={issuedDisplay}
      fingerprint={fingerprint}
      labels={{
        pageTitle: t('pageTitle'),
        validTitle: t('validTitle'),
        validBody,
        issuerLabel: t('issuerLabel'),
        issuedLabel: t('issuedLabel'),
        fingerprintLabel: t('fingerprintLabel'),
        invalidTitle: t('invalidTitle'),
        invalidBody: t('invalidBody'),
        laserAria: t('laserAria'),
      }}
    />
  );
}
