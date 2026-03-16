/** Polices compatibles : Gmail, Outlook, Apple Mail */
const FONT_FALLBACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** URL publique du site pour le logo */
const LOGO_BASE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://reputexa.fr';

/** Support URL par défaut */
const SUPPORT_URL = `${LOGO_BASE.replace(/\/$/, '')}/fr/contact`;

/** Lien secondaire optionnel affiché sous le CTA (ex. annulation essai). */
export type ZenithEmailSecondaryLink = { text: string; url: string };

/**
 * Template maître Zenith : header bleu REPUTEXA (logo HD), contenu, CTA, lien secondaire optionnel, footer.
 * Si otpCode est fourni, affiche un gros code à 6 chiffres (en plus du bouton optionnel).
 */
export function renderZenithEmail(
  title: string,
  content: string,
  buttonText: string,
  buttonUrl: string,
  otpCode?: string,
  supportUrl?: string,
  secondaryLink?: ZenithEmailSecondaryLink
): string {
  const opts = {
    title,
    content,
    buttonText,
    buttonUrl,
    otpCode: otpCode && /^\d{6}$/.test(otpCode) ? otpCode : undefined,
    supportUrl: supportUrl ?? null,
    secondaryLink: secondaryLink ?? null,
  };

  const logoImgUrl = `${LOGO_BASE}/logo-hd.png`;
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
          <td style="background-color:#2563eb;border-radius:16px 16px 0 0;padding:28px 24px;text-align:center;">
            <img src="${logoImgUrl}" alt="REPUTEXA" width="200" height="48" style="display:block;height:48px;width:auto;max-width:200px;margin:0 auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:36px 28px;border-radius:0 0 16px 16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 16px;line-height:1.3;font-family:${FONT_FALLBACK};">${opts.title}</h1>
            ${opts.content}
            ${ctaBlock}
            ${opts.secondaryLink ? `<p style="margin:16px 0 0;font-size:13px;color:#64748b;font-family:${FONT_FALLBACK};">Pas convaincu ? <a href="${opts.secondaryLink.url}" style="color:#2563eb;text-decoration:none;">${opts.secondaryLink.text}</a></p>` : ''}
            <p style="margin:24px 0 0;font-size:13px;color:#64748b;font-family:${FONT_FALLBACK};">— L'équipe REPUTEXA</p>
            ${opts.supportUrl ? `<p style="margin:12px 0 0;font-size:12px;color:#94a3b8;"><a href="${opts.supportUrl}" style="color:#2563eb;text-decoration:none;">Besoin d'aide ? Contactez le support</a></p>` : ''}
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

/** Plan actuellement choisi pour la fin de l'essai (pulse/vision = déjà choisi, zenith = par défaut). */
export type TrialReminderPlanSlug = 'vision' | 'pulse' | 'zenith';

/**
 * Template TrialEndingSoon — J-3 : essai Zenith se termine dans 3 jours.
 * CTA = page Paramètres / Facturation (dashboardBillingUrl) ; texte dynamique si l'utilisateur a déjà choisi PULSE/VISION.
 */
export function getTrialEndingSoonEmailHtml(params: {
  firstName: string;
  daysLeft: number;
  /** URL de la page de gestion d'abonnement (ex. /fr/dashboard/settings). */
  dashboardBillingUrl: string;
  /** Date de fin d'essai formatée (ex. "29 mars 2026"). */
  trialEndDate: string;
  /** Nom du plan (ex. "Zénith"). */
  planName: string;
  /** Montant affiché (ex. "179€"). */
  planPrice: string;
  /** Plan déjà choisi pour la fin de l'essai (si l'utilisateur a cliqué sur Passer à PULSE/VISION). */
  currentPlanSlug?: TrialReminderPlanSlug;
}) {
  const prenom = params.firstName || '';
  const chosenPulseOrVision = params.currentPlanSlug === 'pulse' || params.currentPlanSlug === 'vision';
  const chosenPlanLabel = params.currentPlanSlug === 'pulse' ? 'PULSE' : params.currentPlanSlug === 'vision' ? 'VISION' : null;

  const introBlock = chosenPulseOrVision && chosenPlanLabel
    ? `<p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">Bonjour${prenom ? ` ${prenom}` : ''},</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">Tu as choisi de passer sur le plan <strong>${chosenPlanLabel}</strong> à la fin de ton essai. Tu peux encore changer d'avis ici.</p>`
    : `<p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">Bonjour${prenom ? ` ${prenom}` : ''},</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">Ton essai gratuit <strong>ZENITH</strong> se termine dans <strong>${params.daysLeft} jour${params.daysLeft > 1 ? 's' : ''}</strong>.</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">Tu préfères <strong>Vision</strong> ou <strong>Pulse</strong> ? Choisis ton plan définitif ou annule en un clic depuis ton espace abonnement — tout est sur une seule page, sans quitter Reputexa.</p>`;

  const chargeSentence = `<p style="margin: 0 0 16px; font-size: 14px; color: #475569; line-height: 1.6;">Si tu ne modifies pas ton choix d'ici là, ton abonnement <strong>${params.planName}</strong> s'activera automatiquement le <strong>${params.trialEndDate}</strong> pour un montant de <strong>${params.planPrice}</strong>.</p>`;

  const sentenceAboveButton = chosenPulseOrVision
    ? `<p style="margin: 0 0 24px; font-size: 15px; color: #334155; line-height: 1.6;">Pour modifier ton choix de plan, clique sur le bouton ci-dessous.</p>`
    : `<p style="margin: 0 0 24px; font-size: 15px; color: #334155; line-height: 1.6;">Tu profites actuellement du plan ZÉNITH. Si tu souhaites continuer avec une offre plus adaptée à ton budget (PULSE ou VISION), clique sur le bouton ci-dessous pour valider ton choix avant la fin de l'essai.</p>`;

  const content = `
    ${introBlock}
    ${chargeSentence}
    ${sentenceAboveButton}
  `.trim();

  return renderZenithEmail(
    'Ton essai ZENITH se termine dans 3 jours',
    content,
    'Choisir mon plan définitif (PULSE / VISION)',
    params.dashboardBillingUrl,
    undefined,
    SUPPORT_URL,
    { text: 'Annuler mon essai immédiatement', url: params.dashboardBillingUrl }
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

/**
 * Mail Payant (WelcomePaid) — Envoyé après checkout.session.completed sans essai.
 * Avantages adaptés au plan : Vision (essentiel + IA), Pulse (+ rapports, réactivité), Zenith (élite, consultant, gestion totale).
 */
export function getWelcomePaidHtml(params: {
  planName: string;
  establishmentName: string;
  loginUrl: string;
  supportUrl?: string;
}) {
  const plan = (params.planName || '').toLowerCase();
  let benefitsHtml = '';
  if (plan.includes('zenith')) {
    benefitsHtml = `
      <ul style="margin: 0 0 24px; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.7;">
        <li style="margin-bottom: 8px;"><strong>Consultant IA 24/7</strong> — Posez vos questions stratégiques</li>
        <li style="margin-bottom: 8px;"><strong>Gestion totale</strong> — Multi-établissements, Boost SEO, Bouclier avis toxiques</li>
        <li style="margin-bottom: 8px;"><strong>IA de capture</strong> — Sollicitez les avis par WhatsApp</li>
      </ul>`;
  } else if (plan.includes('pulse')) {
    benefitsHtml = `
      <ul style="margin: 0 0 24px; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.7;">
        <li style="margin-bottom: 8px;"><strong>Rapports détaillés</strong> — PDF mensuel + Recap WhatsApp hebdo</li>
        <li style="margin-bottom: 8px;"><strong>Réactivité</strong> — Alertes avis négatifs en temps réel</li>
        <li style="margin-bottom: 8px;"><strong>Bouclier avis toxiques</strong> — Détection et signalement auto</li>
      </ul>`;
  } else {
    benefitsHtml = `
      <ul style="margin: 0 0 24px; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.7;">
        <li style="margin-bottom: 8px;"><strong>L'essentiel</strong> — Réponses IA illimitées en langue locale</li>
        <li style="margin-bottom: 8px;"><strong>IA intelligente</strong> — Rédaction automatique des réponses</li>
        <li style="margin-bottom: 8px;"><strong>Rapport PDF mensuel</strong> — Suivi de votre e-réputation</li>
      </ul>`;
  }
  const content = `
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">Bonjour${params.establishmentName ? ` ${params.establishmentName}` : ''},</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">Merci pour votre confiance. Votre abonnement <strong>${params.planName}</strong> est actif. Votre surveillance 24/7 est activée.</p>
    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #0f172a;">Vos avantages :</p>
    ${benefitsHtml}
    <p style="margin: 0 0 24px; font-size: 13px; color: #64748b;">Votre facture vous a été envoyée par email.</p>
  `.trim();
  const supportUrl = params.supportUrl ?? SUPPORT_URL;
  return renderZenithEmail(
    `Bienvenue — ${params.planName} activé`,
    content,
    'Accéder à mon dashboard',
    params.loginUrl,
    undefined,
    supportUrl
  );
}

/**
 * Mail Essai (WelcomeZenithTrial) — Envoyé après checkout.session.completed avec trial.
 * Texte exact : "Bienvenue dans l'élite... Tes 3 missions...". Date de fin = maintenant + 14 jours.
 */
export function getWelcomeZenithTrialHtml(params: {
  loginUrl: string;
  settingsUrl?: string;
  supportUrl?: string;
}) {
  const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const formattedEnd = trialEndDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const settingsUrl = params.settingsUrl ?? `${LOGO_BASE.replace(/\/$/, '')}/fr/dashboard/settings`;

  const content = `
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">Bienvenue dans l'élite de la réputation. Tu as maintenant les mêmes outils que les plus grandes entreprises.</p>
    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #0f172a;">Tes 3 missions pour démarrer :</p>
    <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #2563eb;">
      <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.8;">
        <li style="margin-bottom: 8px;"><strong>Connecter Google Business</strong> — Paramètres → Connexions → Connecter Google</li>
        <li style="margin-bottom: 8px;"><strong>Configurer WhatsApp</strong> — Reçois tes alertes avis négatifs en temps réel</li>
        <li style="margin-bottom: 8px;"><strong>Tester le Consultant IA</strong> — Pose tes questions stratégiques 24/7</li>
      </ol>
    </div>
    <p style="margin: 0 0 24px; font-size: 13px; color: #64748b; line-height: 1.5; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
      Ton essai se termine le <strong>${formattedEnd}</strong>. Annulation en un clic dans <a href="${settingsUrl}" style="color: #2563eb; text-decoration: none;">tes paramètres</a>.
    </p>
  `.trim();
  const supportUrl = params.supportUrl ?? SUPPORT_URL;
  return renderZenithEmail(
    "C'est parti ! Tes 14 jours d'accès Total Zénith commencent.",
    content,
    'Accéder à mon dashboard',
    params.loginUrl,
    undefined,
    supportUrl
  );
}

/**
 * Email de bienvenue essai Zénith (14 jours) — design sombre premium, déclenché au checkout trialing.
 * Objet : 🚀 C'est parti ! Tes 14 jours d'accès Total Zénith commencent.
 */
export function getZenithTrialWelcomeEmailHtml(params: {
  customerName: string;
  trialEndDate: string;
  dashboardUrl: string;
  settingsUrl?: string;
}): string {
  const { customerName, trialEndDate, dashboardUrl } = params;
  const settingsUrl = params.settingsUrl ?? `${LOGO_BASE.replace(/\/$/, '')}/fr/dashboard/settings`;
  const logoImgUrl = `${LOGO_BASE}/logo-hd.png`;
  const displayName = customerName?.trim() || 'toi';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:${FONT_FALLBACK};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
        <tr>
          <td style="background:#1e293b;border-radius:20px 20px 0 0;padding:32px 28px;text-align:center;border:1px solid rgba(148,163,184,0.2);border-bottom:none;">
            <img src="${logoImgUrl}" alt="REPUTEXA" width="200" height="48" style="display:block;height:48px;width:auto;max-width:200px;margin:0 auto;border:0;outline:none;text-decoration:none;" />
            <p style="margin:20px 0 0;font-size:14px;font-weight:600;color:#c4b5fd;letter-spacing:0.08em;text-transform:uppercase;">Plan Zénith — Essai 14 jours</p>
          </td>
        </tr>
        <tr>
          <td style="background:#1e293b;padding:36px 28px;border-radius:0 0 20px 20px;border:1px solid rgba(148,163,184,0.2);border-top:none;">
            <h1 style="font-size:24px;font-weight:700;color:#f8fafc;margin:0 0 20px;line-height:1.3;font-family:${FONT_FALLBACK};">🚀 C'est parti ! Tes 14 jours d'accès Total Zénith commencent.</h1>
            <p style="margin:0 0 24px;font-size:16px;color:#cbd5e1;line-height:1.6;">Bienvenue dans l'élite de la réputation, <strong style="color:#f8fafc;">${displayName}</strong>. Tu as maintenant les mêmes outils que les plus grandes entreprises.</p>

            <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#e2e8f0;letter-spacing:0.02em;">Tes 3 missions prioritaires</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
              <tr><td style="padding:16px 20px;background:rgba(99,102,241,0.15);border-radius:12px;border-left:4px solid #8b5cf6;margin-bottom:12px;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#a78bfa;">🔍 Analyse</p>
                <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.5;">Connecte ton Google Business pour voir l'IA analyser tes avis.</p>
              </td></tr>
              <tr><td style="padding:12px 0 0 0;height:8px;"></td></tr>
              <tr><td style="padding:16px 20px;background:rgba(99,102,241,0.15);border-radius:12px;border-left:4px solid #8b5cf6;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#a78bfa;">📲 Réactivité</p>
                <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.5;">Configure tes alertes WhatsApp pour ne plus rien rater.</p>
              </td></tr>
              <tr><td style="padding:12px 0 0 0;height:8px;"></td></tr>
              <tr><td style="padding:16px 20px;background:rgba(99,102,241,0.15);border-radius:12px;border-left:4px solid #8b5cf6;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#a78bfa;">🧠 Stratégie</p>
                <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.5;">Pose ta première question à ton Consultant IA dédié.</p>
              </td></tr>
            </table>

            <div style="background:rgba(148,163,184,0.1);border-radius:12px;padding:20px;margin-bottom:28px;border:1px solid rgba(148,163,184,0.2);">
              <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">Ton essai se termine le <strong style="color:#e2e8f0;">${trialEndDate}</strong>. Si tu n'es pas convaincu, tu peux annuler en un clic dans <a href="${settingsUrl}" style="color:#a78bfa;text-decoration:none;font-weight:600;">tes paramètres</a>. Zéro stress, zéro engagement forcé.</p>
            </div>

            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
              <tr><td>
                <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#d97706 0%,#b45309 100%);color:#ffffff !important;padding:16px 32px;border-radius:12px;font-weight:700;text-decoration:none;font-family:${FONT_FALLBACK};font-size:16px;box-shadow:0 4px 14px rgba(217,119,6,0.4);">Accéder à mon Dashboard Zénith</a>
              </td></tr>
            </table>

            <p style="margin:28px 0 0;font-size:13px;color:#64748b;">— L'équipe REPUTEXA</p>
            <p style="margin:8px 0 0;font-size:12px;"><a href="${SUPPORT_URL}" style="color:#94a3b8;text-decoration:none;">Besoin d'aide ? Contactez le support</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

/** Données pour l'email d'onboarding Reputexa — déclenché uniquement sur invoice.paid */
export type ReputexaOnboardingEmailData = {
  customerName: string;
  planName: string;
  planSlug: 'vision' | 'pulse' | 'zenith';
  trialEndDate: string | null;
  invoiceUrl: string | null;
  interval: 'month' | 'year';
  isTrial: boolean;
  dashboardUrl: string;
  settingsUrl: string;
  unsubscribeUrl?: string;
};

/**
 * Email d'onboarding Reputexa unique — même structure que les autres emails (renderZenithEmail).
 * Déclenché exclusivement sur invoice.paid. Contenu dynamique : plan, cycle, facture.
 */
export function getReputexaOnboardingEmailHtml(data: ReputexaOnboardingEmailData): string {
  const {
    customerName,
    planSlug,
    trialEndDate,
    invoiceUrl,
    interval,
    isTrial,
    dashboardUrl,
    settingsUrl,
  } = data;
  const displayName = customerName?.trim() || 'toi';

  const isPulse = planSlug === 'pulse';
  const isVision = planSlug === 'vision';

  let headline = '';
  let intro = '';
  let missionsHtml = '';

  if (isVision) {
    headline = "Bravo pour ce premier pas.";
    intro = `${displayName}, tu as fait le choix de prendre ta réputation en main. Vision te donne l'essentiel : réponses IA illimitées et tableau de bord pour ne plus laisser un avis sans réponse.`;
    missionsHtml = `
    <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #64748b;">
      <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.8;">
        <li style="margin-bottom: 8px;"><strong>🔍 Premier pas</strong> — Connecte ton Google Business dans Paramètres pour que l'IA analyse tes avis.</li>
      </ol>
    </div>`;
  } else if (isPulse) {
    headline = "Tu es prêt à réagir en temps réel.";
    intro = `${displayName}, Pulse ajoute la puissance des alertes et de l'analyse de sentiment. Reste réactif et garde le contrôle.`;
    missionsHtml = `
    <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #2563eb;">
      <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.8;">
        <li style="margin-bottom: 8px;"><strong>🔍 Analyse</strong> — Connecte ton Google Business pour voir l'IA analyser tes avis.</li>
        <li style="margin-bottom: 8px;"><strong>📲 Réactivité</strong> — Configure tes alertes WhatsApp pour ne plus rien rater.</li>
      </ol>
    </div>`;
  } else {
    headline = "Bienvenue dans l'élite de la réputation.";
    intro = `${displayName}, tu as maintenant les mêmes outils que les plus grandes entreprises. Zénith, c'est la Triple Vérification, le Boost SEO et ton Consultant IA dédié.`;
    missionsHtml = `
    <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #2563eb;">
      <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.8;">
        <li style="margin-bottom: 8px;"><strong>🔍 Analyse</strong> — Connecte ton Google Business pour voir l'IA analyser tes avis.</li>
        <li style="margin-bottom: 8px;"><strong>📲 Réactivité</strong> — Configure tes alertes WhatsApp pour ne plus rien rater.</li>
        <li style="margin-bottom: 8px;"><strong>🧠 Stratégie</strong> — Pose ta première question à ton Consultant IA dédié.</li>
      </ol>
    </div>`;
  }

  const yearMessage =
    interval === 'year'
      ? `<p style="margin: 0 0 24px; font-size: 15px; color: #334155; line-height: 1.6;">Merci pour ton engagement sur la durée : tu bénéficies de -20% sur l'année. On est à tes côtés pour les 12 prochains mois.</p>`
      : '';

  const trialBlock =
    isTrial && trialEndDate
      ? `<div style="margin: 0 0 16px; padding: 16px 20px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f0fdf4; border-left: 4px solid #22c55e;">
    <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #166534;">🎁 Ton essai Zénith est 100% libre</p>
    <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.6;">Tu peux annuler en un clic à tout moment depuis <a href="${settingsUrl}" style="color: #2563eb; text-decoration: none;">tes paramètres</a> pour ne pas être prélevé. Si tu adores Reputexa mais que tu préfères un plan plus léger (PULSE ou VISION) à la fin de l'essai, tu pourras changer d'offre très simplement avant la fin des 14 jours.</p>
    </div>
    <p style="margin: 0 0 8px; font-size: 13px; color: #64748b; line-height: 1.5;">Ton essai se termine le <strong>${trialEndDate}</strong>.</p>
    <p style="margin: 0 0 24px; font-size: 13px; color: #64748b;">Pas convaincu ? <a href="${settingsUrl}" style="color: #2563eb; text-decoration: none;">Annuler mon essai immédiatement</a></p>`
      : '';

  const invoiceBlock =
    invoiceUrl
      ? `<p style="margin: 0 0 24px; font-size: 14px; color: #64748b;"><a href="${invoiceUrl}" style="color: #2563eb; text-decoration: none;">Voir ma facture</a></p>`
      : '';

  const content = `
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${intro}</p>
    ${yearMessage}
    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #0f172a;">Tes prochaines étapes</p>
    ${missionsHtml}
    ${trialBlock}
    ${invoiceBlock}
  `.trim();

  return renderZenithEmail(
    headline,
    content,
    'Accéder à mon dashboard',
    dashboardUrl,
    undefined,
    SUPPORT_URL
  );
}

/**
 * Email facture mensuelle récurrente (billing_reason === 'subscription_cycle').
 * Objet : "Votre facture Reputexa - {mois} {année}"
 */
export function getMonthlyInvoiceEmailHtml(data: {
  monthYear: string;
  invoiceUrl: string;
}) {
  const content = `
    <p style="margin: 0 0 24px; font-size: 15px; color: #334155; line-height: 1.6;">Merci de votre fidélité. Votre paiement a bien été traité.</p>
  `.trim();
  return renderZenithEmail(
    `Votre facture Reputexa — ${data.monthYear}`,
    content,
    'Télécharger la facture',
    data.invoiceUrl
  );
}

/**
 * Email alerte échec de paiement (invoice.payment_failed).
 * CTA principal : Portail de facturation Stripe, lien secondaire : Paramètres / Facturation.
 */
export function getPaymentFailedEmailHtml(data: { portalUrl: string; dashboardBillingUrl: string }): string {
  const content = `
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">Oups, votre paiement a échoué. Votre accès à Reputexa risque d'être suspendu si le règlement n'est pas effectué.</p>
    <p style="margin: 0 0 24px; font-size: 14px; color: #475569; line-height: 1.6;">Cliquez sur le bouton ci-dessous pour accéder à votre portail de facturation sécurisé Stripe, où vous pouvez mettre à jour votre carte et régler les factures en attente.</p>
  `.trim();
  return renderZenithEmail(
    'Paiement échoué — Mettez à jour votre moyen de paiement',
    content,
    'Ouvrir mon portail de facturation',
    data.portalUrl,
    undefined,
    undefined,
    { text: 'Gérer mon abonnement dans Reputexa', url: data.dashboardBillingUrl }
  );
}

/**
 * Email 3D Secure requis (invoice.payment_action_required).
 * Invite l'utilisateur à valider son paiement via le lien de facture Stripe.
 */
export function getPaymentActionRequiredEmailHtml(data: { invoiceUrl: string }): string {
  const content = `
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">Action requise : votre banque demande une validation supplémentaire pour finaliser votre paiement (3D Secure).</p>
    <p style="margin: 0 0 24px; font-size: 14px; color: #475569; line-height: 1.6;">Cliquez sur le bouton ci-dessous pour ouvrir la page Stripe sécurisée, valider l'opération (code SMS / app bancaire), puis revenir sur Reputexa.</p>
  `.trim();
  return renderZenithEmail(
    'Action requise : Validez votre paiement',
    content,
    'Valider mon paiement sécurisé',
    data.invoiceUrl
  );
}

/** Textes de l'email de confirmation de choix de plan (FR / EN). */
const PLAN_SELECTION_EMAIL: Record<string, { title: string; hello: string; confirm: string; noChange: string; charge: string; closing: string; cta: string }> = {
  fr: {
    title: 'Confirmation de votre choix de plan',
    hello: 'Bonjour,',
    confirm: 'Nous vous confirmons que votre choix pour le plan <strong>{planName}</strong> a bien été enregistré pour la suite de votre abonnement.',
    noChange: '<strong>Ce qui change pour vous :</strong> Absolument rien pour l\'instant. Vous conservez l\'intégralité de vos accès au plan ZÉNITH à titre gracieux jusqu\'à la fin de votre période d\'essai, le <strong>{trialEndDate}</strong>.',
    charge: 'Le premier prélèvement de <strong>{planPrice}</strong> n\'interviendra qu\'à cette date, sur le plan que vous venez de sélectionner.',
    closing: 'Nous restons à votre entière disposition pour vous accompagner dans la croissance de votre établissement.',
    cta: 'Accéder à mon dashboard',
  },
  en: {
    title: 'Plan selection confirmed',
    hello: 'Hello,',
    confirm: 'We confirm that your choice of the <strong>{planName}</strong> plan has been recorded for your future subscription.',
    noChange: '<strong>What changes for you:</strong> Nothing for now. You keep full access to the ZENITH plan at no charge until the end of your trial period on <strong>{trialEndDate}</strong>.',
    charge: 'The first charge of <strong>{planPrice}</strong> will only occur on that date, for the plan you have just selected.',
    closing: 'We remain at your disposal to support the growth of your business.',
    cta: 'Go to my dashboard',
  },
};

/**
 * Email de confirmation du choix de plan futur (PULSE ou VISION après essai ZÉNITH).
 * Ton institutionnel, vouvoiement. locale: fr | en | it | es | de (it/es/de utilisent fr pour l’instant).
 */
export function getPlanSelectionConfirmationEmailHtml(data: {
  planName: string;
  planPrice: string;
  trialEndDate: string;
  locale?: string;
}) {
  const { planName, planPrice, trialEndDate, locale = 'fr' } = data;
  const t = PLAN_SELECTION_EMAIL[locale] ?? PLAN_SELECTION_EMAIL.fr;
  const isZenithFuturePlan = planName.toLowerCase().includes('zenith');
  const lossNote =
    !isZenithFuturePlan
      ? `<p style="margin: 8px 0 16px; font-size: 14px; color: #475569; line-height: 1.6;">💡 <em>En passant sur ce plan à la fin de votre essai, vous n'aurez plus accès aux fonctionnalités exclusives du plan ZÉNITH mais uniquement à celles du plan ${planName}.</em></p>`
      : '';

  const content = `
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${t.hello}</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${t.confirm.replace('{planName}', planName)}</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${t.noChange.replace('{trialEndDate}', trialEndDate)}</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${t.charge.replace('{planPrice}', planPrice)}</p>
    ${lossNote}
    <p style="margin: 8px 0 24px; font-size: 15px; color: #334155; line-height: 1.6;">${t.closing}</p>
  `.trim();
  const base = (LOGO_BASE || '').replace(/\/$/, '');
  const dashboardPath = ['fr', 'en', 'it', 'es', 'de'].includes(locale) ? locale : 'fr';
  return renderZenithEmail(
    t.title,
    content,
    t.cta,
    `${base}/${dashboardPath}/dashboard`,
    undefined,
    SUPPORT_URL
  );
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
    params.otpCode ? '' : (params.confirmUrl ? 'Confirmer mon email' : ''),
    params.otpCode ? '' : (params.confirmUrl || '#'),
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

/**
 * Email de confirmation d'upgrade — envoyé quand le plan change (Stripe Portal).
 */
export function getUpgradeConfirmationEmailHtml(params: {
  planName: string;
  establishmentName: string;
  dashboardUrl: string;
}) {
  const content = `
    <p style="margin: 0 0 16px;">Bonjour${params.establishmentName ? ` ${params.establishmentName}` : ''},</p>
    <p style="margin: 0 0 24px;">Votre abonnement a été mis à niveau vers le plan <strong>${params.planName}</strong>. Les nouvelles fonctionnalités sont immédiatement accessibles.</p>
    <p style="margin: 0 0 24px;">Le prorata a été calculé automatiquement. Vous trouverez le détail sur votre prochaine facture Stripe.</p>
  `.trim();
  return renderZenithEmail(
    'Confirmation de mise à niveau',
    content,
    'Accéder au dashboard',
    params.dashboardUrl
  );
}

/**
 * Email de confirmation de downgrade — données conservées, accès limités à {quantity} emplacement(s).
 */
export function getDowngradeConfirmationEmailHtml(params: {
  quantity: number;
  dashboardUrl: string;
}) {
  const content = `
    <p style="margin: 0 0 16px;">Votre abonnement a été mis à jour.</p>
    <p style="margin: 0 0 24px;">Vos données sont conservées, mais vos accès sont désormais limités à <strong>${params.quantity} emplacement(s)</strong>. Les établissements au-delà de ce quota sont temporairement désactivés et réactivés automatiquement si vous augmentez à nouveau votre forfait.</p>
    <p style="margin: 0 0 24px;">Un crédit a été appliqué à votre compte Stripe pour la partie non utilisée de votre ancien forfait.</p>
  `.trim();
  return renderZenithEmail(
    'Changement de forfait — vos données sont conservées',
    content,
    'Voir mon dashboard',
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
