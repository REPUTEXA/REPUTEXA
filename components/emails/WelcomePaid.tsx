import React from 'react';
import { Section, Text } from '@react-email/components';
import { BaseEmailLayout } from './BaseEmailLayout';

type WelcomePaidProps = {
  planName: string;
  establishmentName: string;
  loginUrl: string;
  guideUrl: string;
};

export function WelcomePaid({ planName, establishmentName, loginUrl, guideUrl }: WelcomePaidProps) {
  return (
    <BaseEmailLayout
      title={`Merci pour votre confiance — ${planName} activé`}
      buttonText="Accéder à mon dashboard"
      buttonUrl={loginUrl}
    >
      <Text style={{ margin: '0 0 16px', fontSize: 15, color: '#334155', lineHeight: 1.6 }}>
        Bonjour{establishmentName ? ` ${establishmentName}` : ''},
      </Text>
      <Text style={{ margin: '0 0 24px', fontSize: 15, color: '#334155', lineHeight: 1.6 }}>
        Merci pour votre confiance ! Votre surveillance 24/7 est activée. Votre facture vous a été envoyée par email.
      </Text>
      <Section
        style={{
          backgroundColor: '#f8fafc',
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
          border: '1px solid #e2e8f0',
        }}
      >
        <Text style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
          Guide d&apos;utilisation
        </Text>
        <Text style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
          Découvrez comment tirer le meilleur parti de REPUTEXA avec notre guide pas à pas.
        </Text>
        <a
          href={guideUrl}
          style={{
            display: 'inline-block',
            marginTop: 12,
            color: '#2563eb',
            fontWeight: 600,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          Voir le guide →
        </a>
      </Section>
    </BaseEmailLayout>
  );
}
