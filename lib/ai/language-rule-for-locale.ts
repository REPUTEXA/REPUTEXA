/**
 * Consigne « langue de la réponse » injectée dans le prompt de réponse aux avis.
 * Aligné sur les locales site (fr, en, de, es, it, pt, ja, zh).
 */
export function languageRuleForReviewReply(locale: string): string {
  const c = (locale || 'fr').trim().toLowerCase().slice(0, 5);
  const rules: Record<string, string> = {
    fr: 'Réponds intégralement en français. Vouvoiement obligatoire (vous).',
    en: 'Reply entirely in English—natural, professional hospitality tone. Address the guest as “you”.',
    de: 'Antworte vollständig auf Deutsch. Siezen.',
    es: 'Responde íntegramente en español. Trato de usted.',
    it: 'Rispondi interamente in italiano. Dare del Lei.',
    pt: 'Responda integralmente em português. Tratamento formal quando adequado.',
    ja: '全文を自然な日本語で書くこと。敬体（です・ます）で統一。',
    zh: '请全程使用简体中文撰写回复，语气礼貌自然。',
  };
  return (
    rules[c] ??
    `Write the entire reply in the language matching locale code "${c}", with the same care as the default French instructions.`
  );
}

/** Nom d’établissement de repli dans le prompt si vide (évite « notre établissement » en anglais). */
export function defaultEstablishmentNameForReviewReply(locale: string): string {
  const c = (locale || 'fr').trim().toLowerCase().slice(0, 5);
  const fallbacks: Record<string, string> = {
    auto: 'our venue',
    fr: 'notre établissement',
    en: 'our venue',
    de: 'unser Betrieb',
    es: 'nuestro establecimiento',
    it: 'la nostra struttura',
    pt: 'o nosso espaço',
    ja: '当店',
    zh: '本店',
  };
  return fallbacks[c] ?? 'our venue';
}

/**
 * Ligne de signature imposée en fin de réponse (cohérente avec la langue — pas de « La direction » en anglais).
 */
export function reviewReplySignatureInstruction(locale: string, establishmentName: string): string {
  const c = (locale || 'fr').trim().toLowerCase().slice(0, 5);
  const nom = establishmentName.trim() || defaultEstablishmentNameForReviewReply(c);

  if (c === 'auto') {
    return `Laisse une ligne vide avant la signature. Termine par UNE seule ligne de signature dans la MÊME langue que le corps de la réponse (celle imposée par les règles ci-dessus). Formules types selon la langue du texte : anglais "The team — ${nom}" (jamais « La direction » en anglais) ; français "La direction - ${nom}" ; espagnol "El equipo — ${nom}" ; allemand "Ihr Team — ${nom}" ; italien "Lo staff — ${nom}" ; portugais "A equipa — ${nom}". Aucun mélange de langues sur cette ligne.`;
  }

  const lineByLocale: Record<string, string> = {
    fr: `La direction - ${nom}`,
    en: `The team — ${nom}`,
    de: `Ihr Team — ${nom}`,
    es: `El equipo — ${nom}`,
    it: `Lo staff — ${nom}`,
    pt: `A equipa — ${nom}`,
    ja: `${nom} スタッフ一同`,
    zh: `— ${nom} 团队`,
  };

  const line = lineByLocale[c] ?? `The team — ${nom}`;

  if (c === 'fr') {
    return `Laisse une ligne vide avant la signature. Termine EXACTEMENT par cette ligne (tout en français) : "${line}"`;
  }

  return `Leave one blank line before the sign-off. End EXACTLY with this single line in the reply language (do not use French "La direction" or other French sign-offs) : "${line}"`;
}
