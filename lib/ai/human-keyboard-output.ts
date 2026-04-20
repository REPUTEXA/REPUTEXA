/**
 * Post-traitement des sorties IA pour un rendu "tapé au clavier" :
 * évite les glyphes typographiques souvent utilisés par les LLM (tiret cadratin, etc.).
 */

/** Fragment de prompt à injecter dans les chartes anti-détection. */
export const HUMAN_KEYBOARD_CHARTER_SNIPPET = `
STYLE CLAVIER (OBLIGATOIRE pour tout le texte que tu produis) :
- Aucun tiret long (em dash), aucun demi-cadratin. Aucune incise avec tiret ou " - " : utilise des virgules, des points ou des parenthèses.
- Points de suspension : trois caractères ... et jamais le glyphe unique "…".
- Guillemets droits " et apostrophe droite ' si tu en utilises.
- Pas d'espace insécable ; espaces normales.
`.trim();

/** Même charte, en anglais (prompts OpenAI multilingues). */
export const HUMAN_KEYBOARD_CHARTER_SNIPPET_EN = `
KEYBOARD STYLE (mandatory for all text you produce):
- No em dash or en dash, no spaced hyphen as a break between clauses; use commas, periods, or parentheses.
- Ellipsis: three ASCII dots ... never the single glyph.
- Straight double quotes " and straight apostrophe ' if you use them.
- No non-breaking spaces; normal spaces only.
`.trim();

/** Ancrage factuel : messages client / conformité (hors fiction pure de brouillon scénario). */
export const GROUNDED_FACTS_CHARTER_SNIPPET = `
VÉRACITÉ (OBLIGATOIRE) :
- N'invente aucun fait : pas de produits, marques, lieux d'approvisionnement, noms d'équipier, horaires, promos, détails « maison » précis, ni chiffres ou délais, sauf s'ils figurent explicitement dans le contexte ou les consignes système fournis.
- Si une information manque, dis-le ou reste volontairement général (« selon votre ressenti », « comme indiqué sur place ») sans la fabriquer.
- Ne présente jamais une supposition comme une certitude.
`.trim();

const UNICODE_SPACE = /[\u00A0\u202F\u2007\u2009]/g;
const ELLIPSIS_CHAR = /\u2026/g;
const CURLY_DOUBLE = /[\u201C\u201D]/g;
const CURLY_SINGLE = /[\u2018\u2019\u201A\u201B]/g;

function collapseCommaRuns(s: string): string {
  return s.replace(/,\s*,+/g, ', ');
}

function scrubLine(line: string): string {
  let s = line.replace(UNICODE_SPACE, ' ');
  s = s.replace(ELLIPSIS_CHAR, '...');
  // Plages numériques : 4–5 → 4-5 (tiret ASCII sans espaces, pas une incise)
  s = s.replace(/(\d)\s*[\u2014\u2013\u2212]\s*(\d)/g, '$1-$2');
  s = s.replace(/\s*[\u2014\u2013\u2212]\s*/g, ', ');
  s = collapseCommaRuns(s);
  // Tiret ASCII espacé entre mots : incise type ChatGPT → virgule
  s = s.replace(/(?<=[\p{L}]) - (?=[\p{L}])/gu, ', ');
  s = collapseCommaRuns(s);
  // "10 - 15" reste lisible en "10 à 15" (évite l'incise)
  s = s.replace(/(?<=\d) - (?=\d)/g, ' à ');
  s = s.replace(CURLY_DOUBLE, '"');
  s = s.replace(CURLY_SINGLE, "'");
  s = s.replace(/  +/g, ' ');
  return s.trimEnd();
}

/**
 * Normalise la typographie "premium" des LLM vers du texte plus proche d'une frappe standard.
 * Préserve les sauts de ligne (paragraphes).
 */
export function scrubAiTypography(text: string): string {
  if (!text) return text;
  return text
    .split('\n')
    .map((line) => scrubLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
