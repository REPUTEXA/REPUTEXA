/** Erreurs métier billing exposables au client (clés = `Billing.errors.*` dans messages). */

export type BillingErrorKey =
  | 'stripeNotConfigured'
  | 'annualPriceNotConfigured'
  | 'monthlyPriceNotConfigured'
  | 'quantityTargetMustExceedCurrent'
  | 'stripeCustomerNotFound'
  | 'noActiveSubscription'
  | 'noActiveSubscriptionUsePortal'
  | 'invalidSubscriptionItem'
  | 'checkoutSessionCreateFailed'
  | 'checkoutFailed'
  | 'notAuthenticated'
  | 'expansionFailed'
  | 'serviceUnavailable'
  | 'profileNotFound'
  | 'planInvalid'
  | 'updateFailed'
  | 'premiumFallbackPlan'
  | 'alreadyAnnualBilling'
  | 'planNotRecognizedForSwitch'
  | 'portalOpenFailed'
  | 'expansionSessionCreateFailed'
  | 'invalidJsonBody'
  | 'expansionAddCountRequired'
  | 'subscriptionInvalidPrice'
  | 'genericError'
  | 'syncFailed'
  | 'webhookSecretNotConfigured'
  | 'webhookNoSignature'
  | 'webhookInvalidSignature'
  | 'webhookHandlerFailed';

export class BillingUserFacingError extends Error {
  readonly key: BillingErrorKey;

  constructor(key: BillingErrorKey) {
    super(key);
    this.name = 'BillingUserFacingError';
    this.key = key;
  }
}

export function isBillingUserFacingError(e: unknown): e is BillingUserFacingError {
  return e instanceof BillingUserFacingError;
}
