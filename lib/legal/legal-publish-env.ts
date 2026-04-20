/**
 * Contexte éditeur injecté dans les prompts IA (publication légale admin).
 * Lu uniquement côté serveur (API Route) via process.env — indépendant de Cursor / IDE.
 * Définir les variables sur Vercel ou .env.local pour préremplir raison sociale, RCS, hébergeur, etc.
 */

function trim(s: string | undefined): string | undefined {
  const t = s?.trim();
  return t || undefined;
}

export type LegalPublishEnvStatus = {
  siteUrl: string | null;
  filledCount: number;
  keys: {
    LEGAL_PUBLISHER_NAME: boolean;
    LEGAL_PUBLISHER_LEGAL_FORM: boolean;
    LEGAL_PUBLISHER_ADDRESS: boolean;
    LEGAL_PUBLISHER_RCS: boolean;
    LEGAL_PUBLISHER_SHARE_CAPITAL: boolean;
    LEGAL_PUBLISHER_DIRECTOR: boolean;
    LEGAL_DPO_EMAIL: boolean;
    LEGAL_HOSTING_LINE: boolean;
    LEGAL_MEDIATION_INFO: boolean;
  };
};

export function getLegalPublishEnvStatus(): LegalPublishEnvStatus {
  const siteUrl =
    trim(process.env.NEXT_PUBLIC_SITE_URL) ?? trim(process.env.NEXT_PUBLIC_APP_URL) ?? null;
  const keys = {
    LEGAL_PUBLISHER_NAME: !!trim(process.env.LEGAL_PUBLISHER_NAME),
    LEGAL_PUBLISHER_LEGAL_FORM: !!trim(process.env.LEGAL_PUBLISHER_LEGAL_FORM),
    LEGAL_PUBLISHER_ADDRESS: !!trim(process.env.LEGAL_PUBLISHER_ADDRESS),
    LEGAL_PUBLISHER_RCS: !!trim(process.env.LEGAL_PUBLISHER_RCS),
    LEGAL_PUBLISHER_SHARE_CAPITAL: !!trim(process.env.LEGAL_PUBLISHER_SHARE_CAPITAL),
    LEGAL_PUBLISHER_DIRECTOR: !!trim(process.env.LEGAL_PUBLISHER_DIRECTOR),
    LEGAL_DPO_EMAIL: !!trim(process.env.LEGAL_DPO_EMAIL),
    LEGAL_HOSTING_LINE: !!trim(process.env.LEGAL_HOSTING_LINE),
    LEGAL_MEDIATION_INFO: !!trim(process.env.LEGAL_MEDIATION_INFO),
  };
  const filledCount = Object.values(keys).filter(Boolean).length;
  return { siteUrl, filledCount, keys };
}

/**
 * Bloc à injecter dans le message utilisateur (génération HTML) pour ancrer les mentions réelles.
 */
export function getLegalPublisherContextBlock(): string {
  const site =
    trim(process.env.NEXT_PUBLIC_SITE_URL) ?? trim(process.env.NEXT_PUBLIC_APP_URL) ?? '';

  const pairs: [string, string | undefined][] = [
    ['URL publique du service (site / application)', site || undefined],
    ['Raison sociale / dénomination', trim(process.env.LEGAL_PUBLISHER_NAME)],
    ['Forme juridique (ex. SAS, SASU)', trim(process.env.LEGAL_PUBLISHER_LEGAL_FORM)],
    ['Siège social / adresse postale', trim(process.env.LEGAL_PUBLISHER_ADDRESS)],
    ['RCS / immatriculation (ex. RCS Paris 123 456 789)', trim(process.env.LEGAL_PUBLISHER_RCS)],
    ['Capital social (libellé exact)', trim(process.env.LEGAL_PUBLISHER_SHARE_CAPITAL)],
    ['Représentant légal / directeur de publication', trim(process.env.LEGAL_PUBLISHER_DIRECTOR)],
    ['Contact DPO ou privacy (email)', trim(process.env.LEGAL_DPO_EMAIL)],
    ['Hébergeur du site (nom, adresse, contact — une ligne)', trim(process.env.LEGAL_HOSTING_LINE)],
    ['Médiation consommation / litiges (texte court ou lien)', trim(process.env.LEGAL_MEDIATION_INFO)],
  ];

  const filled = pairs.filter(([, v]) => v);
  if (filled.length === 0) {
    return `CONTEXTE ÉDITEUR (environnement serveur) :
Aucune variable LEGAL_PUBLISHER_* ni URL de site n'est renseignée. Utilise exclusivement des placeholders du type [À compléter : raison sociale], [À compléter : RCS], etc. Ne fabrique aucune donnée d'identification légale.`;
  }

  const body = filled.map(([k, v]) => `- ${k} : ${v}`).join('\n');
  return `CONTEXTE ÉDITEUR (variables d'environnement serveur — à intégrer tel quel dans le document lorsque pertinent ; ne pas les contredire ni les remplacer par des valeurs fictives) :
${body}

Si un champ ci-dessus manque pour une section du document, conserve un placeholder [À compléter : …] explicite plutôt que d'inventer.`;
}
