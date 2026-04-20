/**
 * Requêtes Tavily — cadre EDPB + 5 marchés + UK + secondaires (Benelux, Nordics, PL, PT, DE).
 */

export const GUARDIAN_TAVILY_QUERIES: string[] = [
  // Source centrale UE
  `site:edpb.europa.eu guidelines recommendation cookies consent 2026`,
  `site:edpb.europa.eu GDPR ePrivacy 2026`,
  `site:edpb.europa.eu artificial intelligence Act data protection`,
  `EUR-Lex GDPR delegated acts cookies consent 2026`,
  // Marchés clés
  `site:cnil.fr cookies traceurs consentement 2026`,
  `site:garanteprivacy.it cookie linee guida 2026`,
  `site:aepd.es cookies consentimiento 2026`,
  `site:bfdi.bund.de cookies Einwilligung 2026`,
  `site:ico.org.uk cookies guidance 2026`,
  `site:justice.gov.fr RGPD texte loi réforme 2026`,
  // Secondaires
  `site:gegevensbeschermingsautoriteit.be cookies 2026`,
  `site:apd-gba.be cookies 2026`,
  `site:autoriteitpersoonsgegevens.nl cookies toestemming 2026`,
  `site:imy.se cookies samtycke 2026`,
  `site:datatilsynet.no cookies 2026`,
  `site:uodo.gov.pl cookies zgoda 2026`,
  `site:cnpd.pt cookies consentimento 2026`,
  `site:cnil.fr DSA obligations hébergeur`,
  // Contexte macro
  `ePrivacy regulation cookies EU member states 2026`,
  `Digital Services Act intermediary liability consumer EU cookies`,
];
