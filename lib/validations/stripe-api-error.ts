import { StripeValidationErrorCode, type StripeValidationErrorCodeValue } from '@/lib/validations/stripe';

const ALL = new Set<string>(Object.values(StripeValidationErrorCode));

export function isStripeValidationErrorCode(code: unknown): code is StripeValidationErrorCodeValue {
  return typeof code === 'string' && ALL.has(code);
}

/** Clé `ApiStripe.errors.*` (messages, next-intl). */
export type ApiStripeErrorKey =
  | 'checkoutQueryInvalid'
  | 'bulkExpansionBodyInvalid'
  | 'syncProfileBodyInvalid'
  | 'generic';

export function stripeValidationErrorToApiStripeKey(code: unknown): ApiStripeErrorKey {
  if (!isStripeValidationErrorCode(code)) return 'generic';
  switch (code) {
    case StripeValidationErrorCode.checkoutQueryInvalid:
      return 'checkoutQueryInvalid';
    case StripeValidationErrorCode.bulkExpansionBodyInvalid:
      return 'bulkExpansionBodyInvalid';
    case StripeValidationErrorCode.syncProfileBodyInvalid:
      return 'syncProfileBodyInvalid';
    case StripeValidationErrorCode.previewExpansionQueryInvalid:
      return 'generic';
    default:
      return 'generic';
  }
}
