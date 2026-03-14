import React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Section,
  Text,
} from '@react-email/components';

const LOGO_URL =
  process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://reputexa.fr';
const PRIMARY_COLOR = '#2563eb';

type BaseEmailLayoutProps = {
  title: string;
  children: React.ReactNode;
  buttonText?: string;
  buttonUrl?: string;
};

export function BaseEmailLayout({ title, children, buttonText, buttonUrl }: BaseEmailLayoutProps) {
  return (
    <Html lang="fr">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      </Head>
      <Body style={{ margin: 0, padding: 0, backgroundColor: '#f8fafc', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px' }}>
          <Section style={{ backgroundColor: PRIMARY_COLOR, borderRadius: '16px 16px 0 0', padding: 24, textAlign: 'center' }}>
            <Img
              src={`${LOGO_URL}/logo.png`}
              alt="REPUTEXA"
              width={160}
              height={40}
              style={{ display: 'block', height: 40, width: 'auto', maxWidth: 180, margin: '0 auto' }}
            />
          </Section>
          <Section style={{ backgroundColor: '#ffffff', padding: '32px 24px', borderRadius: '0 0 16px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <Text style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 16px', lineHeight: 1.3 }}>
              {title}
            </Text>
            {children}
            {buttonText && buttonUrl && (
              <Section style={{ marginTop: 24, textAlign: 'center' }}>
                <Button
                  href={buttonUrl}
                  style={{
                    backgroundColor: PRIMARY_COLOR,
                    color: '#ffffff',
                    padding: '14px 28px',
                    borderRadius: 12,
                    fontWeight: 600,
                    fontSize: 16,
                    textDecoration: 'none',
                  }}
                >
                  {buttonText}
                </Button>
              </Section>
            )}
            <Text style={{ marginTop: 24, fontSize: 13, color: '#64748b' }}>— L&apos;équipe REPUTEXA</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
