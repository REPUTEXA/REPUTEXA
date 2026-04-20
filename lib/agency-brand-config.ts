/**
 * Identité légale du sceau de marque (admin, exports PNG, futurs PDF).
 * Modifiez ce fichier pour mettre à jour siège et numéro partout d’un coup.
 */
export const AGENCY_JURISDICTIONS = ['FR', 'IT', 'ES', 'DE', 'PT', 'JP', 'GB', 'US', 'OTHER'] as const;
export type AgencyJurisdiction = (typeof AGENCY_JURISDICTIONS)[number];

export type AgencyBrandConfig = {
  /** Nom affiché en majuscules sur le tampon */
  legalNameUpper: string;
  /** Siège social — pilote l’intitulé du numéro (SIRET, P.IVA, CIF…) via les messages i18n */
  jurisdiction: AgencyJurisdiction;
  /** Numéro d’immatriculation tel qu’affiché (espaces autorisés) */
  registrationNumber: string;
  /** Adresse du siège (une ligne ou plusieurs séparées par des retours à la ligne) */
  headquartersAddress: string;
  logoSrc: string;
};

export const AGENCY_BRAND_CONFIG: AgencyBrandConfig = {
  legalNameUpper: 'REPUTEXA',
  jurisdiction: 'FR',
  registrationNumber: '000 000 000 00000',
  headquartersAddress: 'À compléter — France',
  logoSrc: '/logo.png',
};
