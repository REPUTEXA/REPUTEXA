/**
 * Point d’entrée « coquille » : toute la configuration métier est dans `targets/settings.json`.
 * Préférez ces exports aux littéraux (marque, prix, partenariats, crédit équipement).
 */
export {
  EMPIRE_SITE_URL,
  expandInterfaceTemplate,
  getAnnualBillingMultiplier,
  getAnnualDiscountRate,
  getBrandName,
  getBrandShortName,
  getContactEmailSubjectPrefix,
  getContactFallbackSupportEmail,
  getContactHtmlHeading,
  getContactInboxEmail,
  getDefaultEstablishmentName,
  getEmpireSettings,
  getInfoBroadcastTestCtaLabel,
  getInfoBroadcastTestEmailTitle,
  getInterfaceEmailSenderDefault,
  getInterfaceEmailSenderStrategic,
  getManifestStaticFields,
  getOrganizationInstagramUrl,
  getPartnershipLuxuryBrands,
  getPlanBasePricesEur,
  getPlanBasePricesUsd,
  getPlanSlugLabel,
  getPwaIcons,
  getResendVerifiedBaseAddress,
  getSiteUrl,
  getVolumeDiscountPercentForSeatIndex,
} from '@/src/lib/empire-settings';

export {
  getEquipmentCreditSettings,
  getEquipmentMonthlyPaymentEstimateEur,
  getEquipmentRepaymentRate,
  getEquipmentStarterKitPriceEur,
} from '@/src/lib/equipment-credit';
