/**
 * Prompts et grilles métier pour la génération IA des documents légaux (admin).
 * L’IA est positionnée comme assistant de rédaction — pas substitut à un conseil juridique.
 */

/** Texte court affiché dans l’admin à côté des boutons IA (public côté bundle client OK). */
export const LEGAL_AI_PUBLISH_UI_HINT =
  "L’IA s’exécute sur votre serveur (Vercel) avec les clés API du projet — pas via Cursor. Ébauche structurée par type de document ; définissez les variables LEGAL_PUBLISHER_* sur l’hébergeur pour préremplir l’éditeur. Relisez, complétez les [À compléter], validation juridique obligatoire avant publication.";

/** Contrôle qualité interne (prompt système) — élève le niveau de finition. */
export const LEGAL_AI_EXCELLENCE_BLOCK = `
CONTRÔLE QUALITÉ (avant de rendre le HTML) :
- Cohérence des titres H2/H3 avec le sommaire implicite du type de document.
- Aucune donnée factuelle inventée : uniquement placeholders ou données fournies dans le contexte éditeur.
- Pas de contradiction entre clauses (ex. durées, droits, contact).
- Formulations prudente pour responsabilité et IA (outil d'aide, pas oracle).
- Accessibilité : phrases majoritairement courtes ; listes à puces pour obligations multiples.
- Cohérence terminologique : « données personnelles », « responsable de traitement », « sous-traitant » au sens RGPD.`;

export const LEGAL_AI_DISCLAIMER_BLOCK = `
IMPORTANT — Qualité et responsabilité :
- Tu es un assistant de rédaction juridique. Le résultat doit être relu et validé par un professionnel du droit avant toute publication.
- N'invente JAMAIS de données factuelles précises (SIREN, SIRET, capital social, adresse exacte du siège, nom du DPO, coordonnées réelles). Utilise des placeholders explicites du type : [À compléter : raison sociale], [À compléter : adresse du siège social], [À compléter : contact DPO].
- Vouvoiement systématique (« vous », « vos »). Ton professionnel, clair, prévisible pour un utilisateur professionnel (B2B SaaS).
- Vocabulaire juridique français courant (obligations, responsabilité, limitation, propriété intellectuelle, résiliation, données personnelles, sous-traitant, etc.).
- Ne mélange pas les natures de document : une CGU n'est pas une politique de confidentialité.`;

export const DOCUMENT_TYPE_BLUEPRINTS: Record<string, string> = {
  cgu: `
STRUCTURE ATTENDUE — Conditions Générales d'Utilisation (CGU) pour une SaaS B2B (REPUTEXA) :
1) Objet et acceptation des CGU (référence au service en ligne, création de compte = acceptation).
2) Définitions (éditeur, utilisateur, service, compte, contenu…).
3) Description synthétique du service (gestion de réputation, avis, fonctionnalités liées à l'IA en support — sans sur-promettre).
4) Conditions d'accès et création de compte ; exactitude des informations.
5) Obligations de l'utilisateur (usage loyal, confidentialité des identifiants, contenus licites).
6) Propriété intellectuelle (logiciel, marques, contenus générés par l'utilisateur / licence d'exploitation nécessaire au service).
7) Rôle de l'IA : assistance, pas décision automatique sans contrôle humain si pertinent ; limitation de responsabilité liée aux contenus tiers (avis Google, plateformes tierces).
8) Limitation de responsabilité dans les limites permises par le droit français (formulations prudentes, pas de clause abusive manifeste).
9) Durée, résiliation, suppression de compte (modalités générales).
10) Droit applicable et juridiction compétente (France / tribunaux français — à adapter avec [À compléter] si besoin de précision).
11) Contact / réclamations préalables.

Éviter de dupliquer l'intégralité des informations RGPD : renvoyer si besoin vers la Politique de confidentialité.`,

  politique_confidentialite: `
STRUCTURE ATTENDUE — Politique de confidentialité / traitement des données personnelles (RGPD) :
1) Identité du responsable de traitement et coordonnées [À compléter].
2) Données personnelles traitées (catégories : identité, contact, données d'usage, contenus liés aux avis, données techniques, etc. — de façon exemplative).
3) Finalités et bases légales (Art. 6 RGPD : contrat, intérêt légitime, obligation légale, consentement le cas échéant) pour chaque finalité majeure.
4) Destinataires et sous-traitants (types : hébergeur, email, paiement, IA — sans inventer de noms commerciaux précis ; [À compléter : liste des sous-traitants]).
5) Transferts hors UE : uniquement si pertinent ; sinon indiquer hébergement UE ou clauses types — sans inventer de mécanisme.
6) Durées de conservation par grandes catégories ou critères de détermination.
7) Droits des personnes (accès, rectification, effacement, limitation, portabilité, opposition, directives post-mortem) + exercice (contact + délai type) + réclamation auprès de la CNIL.
8) Sécurité : mesures techniques et organisationnelles (niveau général).
9) Cookies / traceurs : si le site en utilise, principe d'information ; sinon renvoi vers politique cookies [À compléter].
10) Modifications de la politique et date de mise à jour.

Ton : transparent, conforme aux attentes CNIL sur l'information, sans jargon inutile.`,

  mentions_legales: `
STRUCTURE ATTENDUE — Mentions légales (LCEN / transparence éditeur) :
1) Éditeur du site : dénomination, forme juridique, montant du capital social [À compléter], siège social [À compléter], immatriculation (RCS [À compléter]).
2) Directeur de la publication [À compléter].
3) Contact : courriel et/ou adresse postale [À compléter].
4) Hébergeur du site : nom, adresse, contact [À compléter — ex. selon votre hébergeur réel].
5) Propriété intellectuelle sur le site (droits réservés, marques).
6) Médiation de la consommation / règlement en ligne des litiges : uniquement si pertinent pour votre activité ; sinon mention prudente [À compléter selon votre statut].
7) Crédits éventuels.

NE PAS transformer ce document en politique de confidentialité complète : les traitements de données détaillés appartiennent à la Politique de confidentialité. Tu peux insérer un renvoi court vers cette politique.`,
};

export function getDocumentBlueprint(documentType: string): string {
  return DOCUMENT_TYPE_BLUEPRINTS[documentType] ?? `
STRUCTURE : document juridique HTML cohérent avec le type « ${documentType} », titres H2/H3, listes à puces si utile.`;
}

export function buildGenerateContentUserMessage(params: {
  docLabel: string;
  documentType: string;
  notes?: string;
  existingContent?: string;
  /** Injecté côté API depuis getLegalPublisherContextBlock() (env serveur). */
  publisherContextBlock?: string;
}): string {
  const { docLabel, documentType, notes, existingContent, publisherContextBlock } = params;
  const blueprint = getDocumentBlueprint(documentType);

  const publisher =
    publisherContextBlock?.trim() ??
    '';

  return `Document à produire : « ${docLabel} » (type technique : ${documentType}).

${blueprint}

${publisher ? `${publisher}\n\n` : ''}CONTEXTE PRODUIT (REPUTEXA) :
REPUTEXA est une plateforme SaaS française de gestion de réputation en ligne à destination de professionnels (restauration, hôtellerie, commerce, etc.). Les fonctionnalités incluent notamment l'aide à la réponse aux avis et des analyses ; les traitements de données sont décrits dans la Politique de confidentialité — ne pas tout répéter dans une CGU ou des mentions légales.

${notes?.trim() ? `INSTRUCTIONS SPÉCIFIQUES DE L'ÉDITEUR (à intégrer fidèlement dans le texte) :\n${notes.trim()}\n` : ''}${existingContent?.trim() ? `\nCONTENU EXISTANT À RÉVISER / FUSIONNER (conserver ce qui est encore valide, améliorer le reste) :\n${existingContent.slice(0, 12000)}\n` : ''}

Rends uniquement le document HTML (corps uniquement), sans <!DOCTYPE>, sans <html>, sans <head>, sans <body>.`;
}
