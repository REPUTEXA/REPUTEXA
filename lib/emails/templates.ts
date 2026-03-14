/** Polices compatibles : Gmail, Outlook, Apple Mail */
const FONT_FALLBACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** URL publique du site pour le logo */
const LOGO_BASE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://reputexa.fr';

/**
 * Template maître Zenith : header bleu REPUTEXA (logo), contenu, CTA ou code OTP, footer gris.
 * Si otpCode est fourni, affiche un gros code à 6 chiffres (en plus du bouton optionnel).
 */
export function renderZenithEmail(
  title: string,
  content: string,
  buttonText: string,
  buttonUrl: string,
  otpCode?: string
): string {
  const opts = {
    title,
    content,
    buttonText,
    buttonUrl,
    otpCode: otpCode && /^\d{6}$/.test(otpCode) ? otpCode : undefined,
  };

  const logoImgUrl = `${LOGO_BASE}/logo.png`;
  const hasOtp = !!opts.otpCode;
  const hasButton = !!opts.buttonText && !!opts.buttonUrl;

  const ctaBlock =
    hasOtp
      ? `
    <div style="margin: 24px 0 0; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 14px; color: #64748b; font-weight: 600;">Votre code de vérification</p>
      <p style="margin:0;font-size:32px;font-weight:800;letter-spacing:0.25em;color:#0f172a;font-family:'SF Mono',Monaco,'Courier New',Consolas,monospace;">${opts.otpCode}</p>
      <p style="margin: 12px 0 0; font-size: 13px; color: #64748b;">Entrez ce code sur la page de confirmation.</p>
      ${hasButton ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 0;"><tr><td><a href="${opts.buttonUrl}" style="display:inline-block;background-color:#2563eb;color:#ffffff !important;padding:14px 28px;border-radius:12px;font-weight:600;text-decoration:none;font-family:${FONT_FALLBACK};font-size:16px;border:none;">${opts.buttonText}</a></td></tr></table>` : ''}
    </div>`
      : hasButton
      ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0 0;">
      <tr><td>
        <a href="${opts.buttonUrl}" style="display:inline-block;background-color:#2563eb;color:#ffffff !important;padding:14px 28px;border-radius:12px;font-weight:600;text-decoration:none;font-family:${FONT_FALLBACK};font-size:16px;border:none;">${opts.buttonText}</a>
      </td></tr>
    </table>`
      : '';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:${FONT_FALLBACK};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
        <tr>
          <td style="background-color:#2563eb;border-radius:16px 16px 0 0;padding:24px;text-align:center;">
            <img src="${logoImgUrl}" alt="REPUTEXA" width="160" height="40" style="display:block;height:40px;width:auto;max-width:180px;margin:0 auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:32px 24px;border-radius:0 0 16px 16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 16px;line-height:1.3;font-family:${FONT_FALLBACK};">${opts.title}</h1>
            ${opts.content}
            ${ctaBlock}
            <p style="margin:24px 0 0;font-size:13px;color:#64748b;font-family:${FONT_FALLBACK};">— L'équipe REPUTEXA</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * @deprecated Utiliser renderZenithEmail pour la cohérence. Conservé pour rétrocompatibilité.
 */
export function EmailLayout(params: {
  title: string;
  bodyHtml: string;
  ctaUrl: string;
  ctaLabel: string;
}): string {
  return renderZenithEmail(params.title, params.bodyHtml, params.ctaLabel, params.ctaUrl);
}

export function getWelcomeEmailHtml(params: {
  establishmentName: string;
  loginUrl: string;
}) {
  const content = `
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
  `.trim();
  return renderZenithEmail('Bienvenue chez REPUTEXA !', content, 'Accéder à mon dashboard', params.loginUrl);
}

/**
 * Email 1 — Bienvenue & Effet "Wow" (Immédiat après inscription)
 * Ton : prestigieux, rassurant, expert
 */
export function getWelcomeEliteEmailHtml(params: {
  firstName: string;
  whatsappSettingsUrl: string;
}) {
  const prenom = params.firstName || '';
  const content = `
    <p style="margin: 0 0 16px;">Félicitations pour avoir choisi le bouclier REPUTEXA.${prenom ? ` ${prenom},` : ''}</p>
    <p style="margin: 0 0 24px; font-weight: 600; color: #0f172a;">Pendant que vous lisez ce mail, notre IA scanne déjà vos avis pour sécuriser votre établissement.</p>
    <p style="margin: 0 0 24px;">Le cœur de l'expérience : recevez vos alertes en temps réel sur WhatsApp. Un simple clic pour rester protégé 24/7.</p>
  `.trim();
  return renderZenithEmail(
    `Bienvenue dans l'élite de la réputation${prenom ? `, ${prenom}` : ''} 🛡️`,
    content,
    'Configurer WhatsApp',
    params.whatsappSettingsUrl
  );
}

/**
 * Email 2 — Le Cadeau de l'Essai Gratuit (Dès l'activation des 14 jours)
 * Ton : prestigieux, valorisant
 */
export function getTrialGiftEmailHtml(params: {
  loginUrl: string;
}) {
  const content = `
    <p style="margin: 0 0 16px;">Vous avez désormais accès au <strong>Plan Zenith</strong> — notre niveau le plus élevé.</p>
    <p style="margin: 0 0 24px;">Super-pouvoirs activés :</p>
    <ul style="margin: 0 0 24px; padding-left: 20px;">
      <li style="margin-bottom: 8px;"><strong>Boost SEO IA</strong> — Optimisez votre visibilité Google Maps</li>
      <li style="margin-bottom: 8px;"><strong>Réponses Luxe indétectables</strong> — Triple rédaction, ton maître d'hôtel</li>
      <li style="margin-bottom: 8px;"><strong>Bouclier Anti-Haine</strong> — Détection et suppression des avis toxiques</li>
    </ul>
    <p style="margin: 0 0 24px; font-weight: 600; color: #2563eb;">Nous allons optimiser votre visibilité Google Maps gratuitement pendant 2 semaines.</p>
  `.trim();
  return renderZenithEmail(
    'Vos 14 jours de protection Totale commencent maintenant.',
    content,
    'Accéder à mon dashboard',
    params.loginUrl
  );
}

/**
 * Email J+11 — Votre essai se termine bientôt (premier prélèvement dans 3 jours sauf annulation)
 */
export function getTrialEndProtectionEmailHtml(params: {
  firstName: string;
  bilanText: string;
  checkoutUrl: string;
}) {
  const prenom = params.firstName || '';
  const content = `
    <p style="margin: 0 0 16px;">Bonjour${prenom ? ` ${prenom}` : ''},</p>
    <p style="margin: 0 0 24px;">Votre essai REPUTEXA se termine bientôt. Le <strong>premier prélèvement</strong> aura lieu dans <strong>3 jours</strong>, sauf si vous annulez votre abonnement depuis votre espace client.</p>
    <p style="margin: 0 0 24px;">Si vous souhaitez continuer à protéger votre réputation, aucune action n'est requise. Sinon, vous pouvez annuler en un clic à tout moment.</p>
  `.trim();
  return renderZenithEmail(
    'Votre essai se termine bientôt',
    content,
    'Gérer mon abonnement',
    params.checkoutUrl
  );
}

export function getUrgencyEmailHtml(params: {
  establishmentName: string;
  daysLeft: number;
  checkoutUrl: string;
}) {
  const content = `
    <p style="margin: 0 0 16px;">Bonjour${params.establishmentName ? ` ${params.establishmentName}` : ''},</p>
    <p style="margin: 0 0 24px;">Il ne reste plus que <strong style="color: #2563eb;">${params.daysLeft} jour${params.daysLeft > 1 ? 's' : ''}</strong> avant la fin de votre essai. Sans action, vous perdrez la protection automatique de votre e-réputation.</p>
    <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #2563eb;">
      <p style="margin: 0 0 8px; font-size: 14px;">Code promo <strong>-10%</strong> :</p>
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: 0.05em;">REPUTEXA10</p>
      <p style="margin: 8px 0 0; font-size: 13px; color: #64748b;">À utiliser sur la page de paiement.</p>
    </div>
  `.trim();
  return renderZenithEmail(
    'Votre Bouclier IA expire bientôt',
    content,
    'Activer mon abonnement — -10%',
    params.checkoutUrl
  );
}

/**
 * Email Bienvenue — 14 jours gratuits avec carte (Mail 1 immédiat après checkout Stripe)
 */
export function getWelcomeTrial14EmailHtml(params: {
  establishmentName: string;
  planName: string;
  loginUrl: string;
}) {
  const content = `
    <p style="margin: 0 0 16px;">Bonjour${params.establishmentName ? ` ${params.establishmentName}` : ''},</p>
    <p style="margin: 0 0 24px;">Bienvenue chez REPUTEXA ! Vos <strong>14 jours gratuits</strong> sur le plan <strong>${params.planName}</strong> sont activés. Aucun prélèvement aujourd'hui.</p>
    <p style="margin: 0 0 24px;">Le premier prélèvement interviendra dans 14 jours, sauf annulation de votre part. Vous pouvez annuler à tout moment depuis votre espace client.</p>
  `.trim();
  return renderZenithEmail(
    'Bienvenue — Vos 14 jours gratuits REPUTEXA',
    content,
    'Accéder à mon dashboard',
    params.loginUrl
  );
}

export function getWelcomePremiumEmailHtml(params: {
  establishmentName: string;
  planName: string;
  loginUrl: string;
}) {
  const content = `
    <p style="margin: 0 0 16px;">Bonjour${params.establishmentName ? ` ${params.establishmentName}` : ''},</p>
    <p style="margin: 0 0 24px;">Votre abonnement <strong>${params.planName}</strong> est actif. Votre facture vous a été envoyée par email.</p>
  `.trim();
  return renderZenithEmail('Bienvenue en Premium !', content, 'Accéder à mon dashboard', params.loginUrl);
}

/**
 * Email J-3 : Plus que 3 jours d'essai.
 * Utilise le template Zenith unifié.
 */
export function getTrialReminder3DaysHtml(params: {
  firstName: string;
  planName: string;
  reviewsRepliedCount: number;
  checkoutUrl: string;
}) {
  const prenom = params.firstName || 'Bonjour';
  const benefits =
    params.reviewsRepliedCount > 0
      ? `Vous avez déjà répondu à <strong>${params.reviewsRepliedCount}</strong> avis avec notre IA.`
      : 'Notre IA est prête à protéger votre réputation 24/7.';
  const content = `
    <p style="margin: 0 0 16px;">Bonjour ${prenom}, votre période d'essai arrive bientôt à son terme.</p>
    <p style="margin: 0 0 24px;">${benefits}</p>
    <p style="margin: 0 0 24px;">Ne perdez pas l'accès à la <strong>Triple Vérification</strong> et au <strong>Boost SEO</strong>.</p>
  `.trim();
  return renderZenithEmail(
    'Plus que 3 jours pour sécuriser votre réputation',
    content,
    `Activer mon plan ${params.planName}`,
    params.checkoutUrl
  );
}

/**
 * Email de récupération de mot de passe — utilise renderZenithEmail.
 */
export function getPasswordRecoveryEmailHtml(params: { resetUrl: string }) {
  const content = `
    <p style="margin: 0 0 16px;">Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.</p>
    <p style="margin: 0 0 24px; font-size: 14px; color: #64748b;">Ce lien est valide 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
  `.trim();
  return renderZenithEmail('Réinitialiser votre mot de passe', content, 'Réinitialiser mon mot de passe', params.resetUrl);
}

/**
 * Email de confirmation d'inscription — utilise renderZenithEmail.
 * Mode OTP : affiche le code à 6 chiffres (otpCode) à la place du bouton.
 */
export function getVerifyEmailHtml(params: { confirmUrl?: string; otpCode?: string }) {
  const content = params.otpCode
    ? `
    <p style="margin: 0 0 16px;">Bienvenue ! Voici votre code de vérification pour activer votre compte REPUTEXA.</p>
    <p style="margin: 0 0 24px; font-size: 14px; color: #64748b;">Ce code est valide 15 minutes. Si vous n'avez pas créé de compte, ignorez cet email.</p>
  `.trim()
    : `
    <p style="margin: 0 0 16px;">Bienvenue ! Cliquez sur le bouton ci-dessous pour activer votre compte REPUTEXA.</p>
    <p style="margin: 0 0 24px; font-size: 14px; color: #64748b;">Ce lien est valide 24 heures. Si vous n'avez pas créé de compte, ignorez cet email.</p>
  `.trim();
  return renderZenithEmail(
    'Confirmez votre adresse email',
    content,
    params.confirmUrl ? 'Confirmer mon email' : '',
    params.confirmUrl || '#',
    params.otpCode
  );
}

/** Entrée pour la comparaison du groupe (multi-établissements) */
export type GroupComparisonItem = {
  name: string;
  avgRating: number;
  totalReviews: number;
};

/**
 * Email rapport mensuel — template Zenith + teaser IA + optionnel Comparaison du Groupe.
 */
export function getMonthlyReportEmailHtml(params: {
  establishmentName: string;
  monthLabel: string;
  hook: string;
  teaser: string;
  dashboardUrl: string;
  groupComparison?: GroupComparisonItem[];
}) {
  const comparisonBlock =
    params.groupComparison &&
    params.groupComparison.length > 1
      ? `
    <div style="background: #f1f5f9; border-radius: 12px; padding: 16px 20px; margin: 24px 0;">
      <h3 style="font-size: 14px; font-weight: 600; color: #0f172a; margin: 0 0 12px;">📊 Comparaison du Groupe</h3>
      <table role="presentation" style="width:100%; border-collapse: collapse;">
        ${params.groupComparison
          .sort((a, b) => b.avgRating - a.avgRating)
          .map(
            (e, i) =>
              `<tr>
                <td style="padding: 6px 0; font-size: 13px; color: #475569;">${i === 0 ? '🏆 ' : ''}${e.name}</td>
                <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${e.avgRating.toFixed(1)}/5</td>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b; text-align: right;">${e.totalReviews} avis</td>
              </tr>`
          )
          .join('')}
      </table>
    </div>`
      : '';

  const content = `
    <p style="margin: 0 0 16px;">Bonjour${params.establishmentName ? ` ${params.establishmentName}` : ''},</p>
    <p style="margin: 0 0 16px; font-weight: 600; color: #0f172a;">${params.hook}</p>
    <p style="margin: 0 0 24px;">${params.teaser}</p>
    ${comparisonBlock}
    <p style="margin: 0 0 24px; font-size: 14px; color: #64748b;">Votre rapport ${params.monthLabel} est disponible. Consultez les insights IA et le PDF complet ci-dessous.</p>
  `.trim();
  return renderZenithEmail(
    `Votre rapport mensuel — ${params.monthLabel}`,
    content,
    'Voir mon rapport',
    params.dashboardUrl
  );
}

/**
 * Email succès ajout d'établissement — confirme l'activation et récapitule le nouveau montant.
 */
export function getEstablishmentAddedEmailHtml(params: {
  establishmentName: string;
  totalNextMonth: number;
  dashboardUrl: string;
}) {
  const content = `
    <p style="margin: 0 0 16px;">Votre nouvel établissement <strong>${params.establishmentName}</strong> est activé.</p>
    <p style="margin: 0 0 24px;">Votre prochaine facture mensuelle s'élèvera à <strong>${params.totalNextMonth}€</strong>/mois.</p>
  `.trim();
  return renderZenithEmail(
    'Nouvel établissement activé',
    content,
    'Voir mes établissements',
    params.dashboardUrl
  );
}

/**
 * Email confirmation suppression d'établissement — design pro, récap structuré.
 */
export function getEstablishmentDeletedEmailHtml(params: {
  establishmentName: string;
  totalNextMonth: number;
  dashboardUrl: string;
  accessValidUntil?: string;
}) {
  const dateBlock = params.accessValidUntil
    ? `
    <tr>
      <td style="padding: 8px 0; font-size: 13px; color: #64748b;">Réduction effective à partir du</td>
      <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${params.accessValidUntil}</td>
    </tr>`
    : '';

  const content = `
    <p style="margin: 0 0 20px; font-size: 15px; color: #334155; line-height: 1.6;">Nous vous confirmons la suppression de l'établissement <strong style="color: #0f172a;">${params.establishmentName}</strong> de votre compte. L'accès aux données associées a été retiré.</p>

    <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #64748b;">Nouveau montant mensuel</td>
          <td style="padding: 8px 0; font-size: 18px; font-weight: 700; color: #2563eb; text-align: right;">${params.totalNextMonth}€<span style="font-size: 13px; font-weight: 500; color: #64748b;">/mois</span></td>
        </tr>
        ${dateBlock}
      </table>
    </div>

    <p style="margin: 0 0 24px; font-size: 14px; color: #64748b; line-height: 1.5;">La prochaine facture reflétera automatiquement cette réduction. Vous pouvez gérer vos établissements à tout moment depuis votre tableau de bord.</p>
  `.trim();
  return renderZenithEmail(
    'Suppression confirmée — Établissement retiré',
    content,
    'Accéder à mes établissements',
    params.dashboardUrl
  );
}

export function getExpirationEmailHtml(params: {
  establishmentName: string;
  planName: string;
  checkoutUrl: string;
}) {
  const content = `
    <p style="margin: 0 0 16px;">Bonjour${params.establishmentName ? ` ${params.establishmentName}` : ''},</p>
    <p style="margin: 0 0 24px;">Votre période d'essai de 14 jours est arrivée à son terme. Pour continuer à protéger votre réputation avec l'IA, activez votre abonnement en un clic.</p>
  `.trim();
  return renderZenithEmail(
    'Votre essai REPUTEXA est terminé',
    content,
    `Activer mon abonnement ${params.planName}`,
    params.checkoutUrl
  );
}
