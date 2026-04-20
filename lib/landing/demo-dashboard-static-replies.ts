/**
 * Variantes statiques (fallback client + API hors clés) — sans import OpenAI/Anthropic.
 */
import type { DemoDashboardExample, DemoReviewTone } from '@/lib/landing/demo-dashboard-data';

export type DemoStaticReplyOption = {
  text: string;
  engine: 'openai';
  styleKey: 'empathy' | 'direct' | 'followup';
};

export function staticCandidates(ex: DemoDashboardExample, locale: string): string[] {
  const tone: DemoReviewTone = ex.reviewTone ?? 'negative';
  const base = ex.response.trim();
  const fr = locale === 'fr';
  let contact = '';
  if (ex.phone) {
    contact = fr
      ? ` Vous pouvez nous joindre au ${ex.phone} pour ajuster la suite avec vous.`
      : ` You can reach us at ${ex.phone} so we can follow up personally.`;
  } else if (ex.email) {
    contact = fr
      ? ` Écrivez-nous sur ${ex.email} : nous suivrons votre dossier personnellement.`
      : ` Email us at ${ex.email} and we'll personally follow up.`;
  }

  if (tone === 'positive') {
    return [
      base,
      fr
        ? `${base} Toute l'équipe vous remercie chaleureusement — au plaisir de vous accueillir à nouveau.`
        : `${base} The whole team thanks you — we'd love to welcome you back soon.`,
      base + contact,
    ];
  }

  if (tone === 'hateful') {
    const platform = ex.platformLabel ?? (fr ? 'Google Avis' : 'Google Reviews');
    const who = ex.reviewer;
    const loc = ex.city ? (fr ? `à ${ex.city}` : `in ${ex.city}`) : '';
    return fr
      ? [
          `Objet : Demande de retrait / modération — avis non conforme (${platform})\n\nMadame, Monsieur,\n\nNous sollicitons la modération d'un avis publié sur la fiche « ${ex.business} » ${loc}, attribué à « ${who} », contenant des propos personnellement offensants et sans rapport factuel vérifiable avec une expérience client.\n\nConformément aux règles de contenu de la plateforme concernant le harcèlement et les attaques personnelles, nous demandons le retrait ou la suppression de cet avis.\n\nNous restons disponibles pour tout élément utile à traiter ce dossier.\n\nCordialement,\nGérant · ${ex.business}`,
          `Objet : Signalement avis abusif — ${ex.business}\n\nBonjour,\n\nL'avis suivant, émanant de « ${who} », enfreint manifestement les standards communautaires : ton diffamatoire, accusations non étayées et vocabulaire injurieux à notre encontre.\n\nNous prions ${platform} d'examiner ce contenu sous l'angle des politiques anti-harcèlement et de désinformation.\n\nMerci de votre traitement rapide de cette demande.\n\nRespectueusement,\n${ex.business}`,
          `Objet : Demande d'examen urgent — contenu préjudiciable\n\nÀ l'attention du service modération ${platform},\n\nLa fiche « ${ex.business} » ${loc} fait l'objet d'un avis violent de la part de « ${who} » nuisant à notre activité locale.\n\nNous demandons une revue manuelle et la suppression si les contenus s'avèrent contraires à vos conditions d'utilisation.\n\nPièces / historique client : joignables sur demande.\n\nCordialement,\nDirection · ${ex.business}${contact}`,
        ]
      : [
          `Subject: Removal / moderation request — policy-violating review (${platform})\n\nDear Trust & Safety team,\n\nWe request moderation of a review on "${ex.business}" ${loc}, attributed to "${who}", containing personally abusive language and unverifiable, harmful allegations.\n\nUnder your harassment and off-topic attack policies, please remove or strike this content.\n\nBest regards,\nOwner · ${ex.business}`,
          `Subject: Abusive review report — ${ex.business}\n\nHello,\n\nThe review from "${who}" violates community standards: defamatory tone, unsupported accusations, and abusive wording toward our staff.\n\nPlease review under your harassment and misinformation rules.\n\nThank you for prompt handling.\n\nRespectfully,\n${ex.business}`,
          `Subject: Urgent review appeal — harmful content\n\nTo ${platform} moderation,\n\nOur listing "${ex.business}" ${loc} received a hostile review from "${who}" that materially harms our local business.\n\nWe ask for human review and removal if the content breaches your terms.\n\nAdditional context available on request.\n\nSincerely,\nManagement · ${ex.business}${contact}`,
        ];
  }

  return [
    base,
    fr
      ? `${base} Nous prenons votre retour très au sérieux et l'utilisons pour ajuster nos procédures en interne.`
      : `${base} We take your feedback seriously and use it to refine how we operate.`,
    base + contact,
  ];
}

export function getStaticDemoReplyOptions(
  ex: DemoDashboardExample,
  locale: string
): DemoStaticReplyOption[] {
  const staticOpts = staticCandidates(ex, locale);
  return [
    { text: staticOpts[0]!, engine: 'openai', styleKey: 'empathy' },
    { text: staticOpts[1]!, engine: 'openai', styleKey: 'direct' },
    { text: staticOpts[2]!, engine: 'openai', styleKey: 'followup' },
  ];
}
