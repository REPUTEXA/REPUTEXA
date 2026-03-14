import React from 'react';
import { Section, Text } from '@react-email/components';
import { BaseEmailLayout } from './BaseEmailLayout';

const listStyle = {
  margin: '0 0 8px',
  paddingLeft: 20,
  fontSize: 14,
  color: '#334155',
  lineHeight: 1.6,
};

type WelcomeZenithTrialProps = {
  loginUrl: string;
  settingsUrl: string;
  trialEndDate: string;
};

export function WelcomeZenithTrial({ loginUrl, settingsUrl, trialEndDate }: WelcomeZenithTrialProps) {
  return (
    <BaseEmailLayout
      title="C'est parti ! Tes 14 jours d'accès Total Zénith commencent"
      buttonText="Accéder à mon dashboard"
      buttonUrl={loginUrl}
    >
      <Text style={{ margin: '0 0 16px', fontSize: 15, color: '#334155', lineHeight: 1.6 }}>
        Bienvenue dans l&apos;élite de la réputation. Tu as maintenant les mêmes outils que les plus grandes entreprises.
      </Text>

      <Text style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
        Tes missions pour démarrer :
      </Text>
      <Section style={{ backgroundColor: '#f1f5f9', borderRadius: 12, padding: 20, marginBottom: 24, borderLeft: '4px solid #2563eb' }}>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li style={listStyle}>
            <strong>Connecter Google Business</strong> — Paramètres → Connexions → Connecter Google
          </li>
          <li style={listStyle}>
            <strong>Configurer WhatsApp</strong> — Reçois tes alertes avis négatifs en temps réel
          </li>
          <li style={listStyle}>
            <strong>Tester le Consultant IA</strong> — Pose tes questions stratégiques 24/7
          </li>
        </ol>
      </Section>

      <Text
        style={{
          margin: '0 0 16px',
          fontSize: 13,
          color: '#64748b',
          lineHeight: 1.5,
          backgroundColor: '#f8fafc',
          padding: 12,
          borderRadius: 8,
          border: '1px solid #e2e8f0',
        }}
      >
        Ton essai se termine le <strong>{trialEndDate}</strong>. Annulation en un clic dans{' '}
        <a href={settingsUrl} style={{ color: '#2563eb', textDecoration: 'none' }}>
          tes paramètres
        </a>
        .
      </Text>
    </BaseEmailLayout>
  );
}
