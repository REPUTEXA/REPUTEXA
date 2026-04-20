/**
 * Brouillon de message « consultant » à partir des données prospect.
 * Ne cite pas de concurrent ni de tiers par nom — uniquement contexte public (avis, note, ville).
 */
export function buildConsultantOutreachDraft(input: {
  establishmentName: string;
  city: string;
  category: string;
  rating: number;
  lastReviewExcerpt?: string | null;
  lastReviewAuthor?: string | null;
  lastReviewRelative?: string | null;
  locale: string;
}): { subject: string; bodyPlain: string } {
  const loc = input.locale.slice(0, 2).toLowerCase();
  const excerpt = (input.lastReviewExcerpt ?? '').trim().slice(0, 200);

  type P = typeof input & { excerpt: string };

  const templates: Record<string, { subject: (n: string) => string; body: (p: P) => string }> = {
    fr: {
      subject: (n) => `Visibilité locale — ${n}`,
      body: (p) =>
        `Bonjour,\n\nJe m’intéresse à ${p.establishmentName} (${p.city}). Votre note publique est d’environ ${p.rating}/5.\n` +
        (p.excerpt
          ? `Un avis récent${p.lastReviewRelative ? ` (${p.lastReviewRelative})` : ''}${p.lastReviewAuthor ? ` — « ${p.lastReviewAuthor} »` : ''} mentionne : « ${p.excerpt}${p.excerpt.length >= 200 ? '…' : ''} »\n`
          : '') +
        `\nNous aidons les ${p.category.toLowerCase()} à structurer les réponses aux avis et à renforcer la preuve sociale, sans promesse irréaliste sur les plateformes.\n\nSouhaitez-vous que je vous envoie un court audit (gratuit) sur votre situation actuelle ?\n\nCordialement`,
    },
    it: {
      subject: (n) => `Visibilità locale — ${n}`,
      body: (p) =>
        `Buongiorno,\n\nSeguo ${p.establishmentName} (${p.city}). La valutazione pubblica è circa ${p.rating}/5.\n` +
        (p.excerpt
          ? `Una recensione recente${p.lastReviewRelative ? ` (${p.lastReviewRelative})` : ''}${p.lastReviewAuthor ? ` — « ${p.lastReviewAuthor} »` : ''} cita: « ${p.excerpt}${p.excerpt.length >= 200 ? '…' : ''} »\n`
          : '') +
        `\nAiutiamo le attività come la vostra (${p.category}) a organizzare le risposte alle recensioni e a rafforzare la prova sociale, senza promesse irrealistiche.\n\nVolete che le invii una breve analisi gratuita?\n\nCordiali saluti`,
    },
    es: {
      subject: (n) => `Visibilidad local — ${n}`,
      body: (p) =>
        `Hola,\n\nHe visto ${p.establishmentName} (${p.city}). La valoración pública ronda ${p.rating}/5.\n` +
        (p.excerpt
          ? `Una reseña reciente${p.lastReviewRelative ? ` (${p.lastReviewRelative})` : ''}${p.lastReviewAuthor ? ` — « ${p.lastReviewAuthor} »` : ''} menciona: « ${p.excerpt}${p.excerpt.length >= 200 ? '…' : ''} »\n`
          : '') +
        `\nAyudamos a negocios como el suyo (${p.category}) a estructurar respuestas a reseñas y reforzar prueba social, sin promesas irreales.\n\n¿Le envío un breve análisis gratuito?\n\nSaludos`,
    },
    de: {
      subject: (n) => `Lokale Sichtbarkeit — ${n}`,
      body: (p) =>
        `Guten Tag,\n\nich habe ${p.establishmentName} (${p.city}) gesehen. Die öffentliche Bewertung liegt bei etwa ${p.rating}/5.\n` +
        (p.excerpt
          ? `Eine aktuelle Bewertung${p.lastReviewRelative ? ` (${p.lastReviewRelative})` : ''}${p.lastReviewAuthor ? ` — « ${p.lastReviewAuthor} »` : ''} erwähnt: « ${p.excerpt}${p.excerpt.length >= 200 ? '…' : ''} »\n`
          : '') +
        `\nWir unterstützen Betriebe wie Ihren (${p.category}) bei strukturierten Antworten auf Bewertungen und stärkerer Social Proof — ohne unrealistische Versprechen.\n\nSoll ich Ihnen eine kurze kostenlose Analyse senden?\n\nMit freundlichen Grüßen`,
    },
    en: {
      subject: (n) => `Local visibility — ${n}`,
      body: (p) =>
        `Hello,\n\nI’ve been looking at ${p.establishmentName} (${p.city}). Your public rating is around ${p.rating}/5.\n` +
        (p.excerpt
          ? `A recent review${p.lastReviewRelative ? ` (${p.lastReviewRelative})` : ''}${p.lastReviewAuthor ? ` — “${p.lastReviewAuthor}”` : ''} mentions: “${p.excerpt}${p.excerpt.length >= 200 ? '…' : ''}”\n`
          : '') +
        `\nWe help businesses like yours (${p.category}) structure review responses and strengthen social proof — without unrealistic platform promises.\n\nWould you like a short free audit?\n\nBest regards`,
    },
  };

  const t = templates[loc] ?? templates.en;
  const excerptTrim = excerpt;
  return {
    subject: t.subject(input.establishmentName),
    bodyPlain: t.body({ ...input, excerpt: excerptTrim }),
  };
}
