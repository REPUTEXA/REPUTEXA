const BASE_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #1e293b;
  max-width: 560px;
  margin: 0 auto;
`;

export function getWelcomeEmailHtml(params: {
  establishmentName: string;
  loginUrl: string;
}) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;">
  <div style="${BASE_STYLES} padding: 32px 24px;">
    <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
      <span style="font-size: 24px; font-weight: 700; color: #fff; letter-spacing: 0.05em;">REPUTEXA</span>
    </div>
    <h1 style="font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 16px;">Bienvenue chez REPUTEXA !</h1>
    <p style="margin: 0 0 16px;">Bonjour${params.establishmentName ? ` ${params.establishmentName}` : ''},</p>
    <p style="margin: 0 0 24px;">Votre essai de 14 jours est activé. Voici comment démarrer :</p>
    <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #2563eb;">
      <h2 style="font-size: 16px; font-weight: 600; margin: 0 0 12px;">Guide : Connecter Google My Business</h2>
      <ol style="margin: 0; padding-left: 20px;">
        <li style="margin-bottom: 8px;">Rendez-vous sur <a href="https://business.google.com" style="color: #2563eb;">Google Business Profile</a></li>
        <li style="margin-bottom: 8px;">Sélectionnez votre établissement ou créez votre fiche</li>
        <li style="margin-bottom: 8px;">Dans le tableau de bord REPUTEXA, allez dans Paramètres → Connexions</li>
        <li style="margin-bottom: 8px;">Cliquez sur « Connecter Google » et autorisez l'accès</li>
      </ol>
    </div>
    <p style="margin: 0 0 24px;">Une fois connecté, l'IA commencera à protéger votre réputation.</p>
    <a href="${params.loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #4f46e5); color: #fff !important; padding: 14px 28px; border-radius: 12px; font-weight: 600; text-decoration: none;">Accéder à mon dashboard</a>
    <p style="margin: 24px 0 0; font-size: 13px; color: #64748b;">— L'équipe REPUTEXA</p>
  </div>
</body>
</html>
  `.trim();
}

export function getUrgencyEmailHtml(params: {
  establishmentName: string;
  daysLeft: number;
  checkoutUrl: string;
}) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;">
  <div style="${BASE_STYLES} padding: 32px 24px; background: #0f172a; color: #e2e8f0; border-radius: 16px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 20px; font-weight: 700; color: #f59e0b;">⚠️</span>
      <h1 style="font-size: 22px; font-weight: 700; color: #fef3c7; margin: 16px 0 0;">Votre Bouclier IA expire bientôt</h1>
    </div>
    <p style="margin: 0 0 16px;">Bonjour${params.establishmentName ? ` ${params.establishmentName}` : ''},</p>
    <p style="margin: 0 0 24px;">Il ne reste plus que <strong style="color: #fcd34d;">${params.daysLeft} jour${params.daysLeft > 1 ? 's' : ''}</strong> avant la fin de votre essai. Sans action, vous perdrez la protection automatique de votre e-réputation.</p>
    <div style="background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #334155;">
      <p style="margin: 0 0 8px; font-size: 14px;">Code promo <strong style="color: #86efac;">-10%</strong> :</p>
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #86efac; letter-spacing: 0.05em;">REPUTEXA10</p>
      <p style="margin: 8px 0 0; font-size: 13px; color: #94a3b8;">À utiliser sur la page de paiement.</p>
    </div>
    <a href="${params.checkoutUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #4f46e5); color: #fff !important; padding: 14px 28px; border-radius: 12px; font-weight: 600; text-decoration: none;">Activer mon abonnement — -10%</a>
    <p style="margin: 24px 0 0; font-size: 13px; color: #64748b;">— L'équipe REPUTEXA</p>
  </div>
</body>
</html>
  `.trim();
}

export function getWelcomePremiumEmailHtml(params: {
  establishmentName: string;
  planName: string;
  loginUrl: string;
}) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;">
  <div style="${BASE_STYLES} padding: 32px 24px; background: #0f172a; color: #e2e8f0; border-radius: 16px;">
    <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
      <span style="font-size: 24px; font-weight: 700; color: #fff; letter-spacing: 0.05em;">REPUTEXA</span>
      <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Premium</p>
    </div>
    <h1 style="font-size: 22px; font-weight: 700; color: #fff; margin: 0 0 16px;">Bienvenue en Premium !</h1>
    <p style="margin: 0 0 16px;">Bonjour${params.establishmentName ? ` ${params.establishmentName}` : ''},</p>
    <p style="margin: 0 0 24px;">Votre abonnement <strong>${params.planName}</strong> est actif. Votre facture vous a été envoyée par email.</p>
    <a href="${params.loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #4f46e5); color: #fff !important; padding: 14px 28px; border-radius: 12px; font-weight: 600; text-decoration: none;">Accéder à mon dashboard</a>
    <p style="margin: 24px 0 0; font-size: 13px; color: #64748b;">— L'équipe REPUTEXA</p>
  </div>
</body>
</html>
  `.trim();
}

export function getExpirationEmailHtml(params: {
  establishmentName: string;
  planName: string;
  checkoutUrl: string;
}) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;">
  <div style="${BASE_STYLES} padding: 32px 24px;">
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
      <span style="font-size: 28px;">🔒</span>
      <h1 style="font-size: 22px; font-weight: 700; color: #b91c1c; margin: 12px 0 0;">Votre essai REPUTEXA est terminé</h1>
    </div>
    <p style="margin: 0 0 16px;">Bonjour${params.establishmentName ? ` ${params.establishmentName}` : ''},</p>
    <p style="margin: 0 0 24px;">Votre période d'essai de 14 jours est arrivée à son terme. Pour continuer à protéger votre réputation avec l'IA, activez votre abonnement en un clic.</p>
    <a href="${params.checkoutUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #4f46e5); color: #fff !important; padding: 14px 28px; border-radius: 12px; font-weight: 600; text-decoration: none;">Activer mon abonnement ${params.planName}</a>
    <p style="margin: 24px 0 0; font-size: 13px; color: #64748b;">— L'équipe REPUTEXA</p>
  </div>
</body>
</html>
  `.trim();
}
