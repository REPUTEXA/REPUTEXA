/**
 * Types for WhatsApp alerts on bad reviews.
 * Ready for Twilio / Meta Cloud API integration.
 */

/** Callback actions when user taps a button in WhatsApp */
export const CALLBACK_ACTIONS = {
  APPROVE_REPLY: 'APPROVE_REPLY',
  EDIT_REPLY: 'EDIT_REPLY',
} as const;

export type CallbackAction =
  | (typeof CALLBACK_ACTIONS)['APPROVE_REPLY']
  | (typeof CALLBACK_ACTIONS)['EDIT_REPLY'];

export type ReviewPlatform = 'google' | 'facebook' | 'trustpilot';

export interface StandardReview {
  author: string;
  rating: number;
  text: string;
  platform: ReviewPlatform;
  externalId?: string | null;
}

/** Payload received by /api/webhooks/google-reviews (et plateformes unifiées) */
export interface GoogleReviewWebhookPayload {
  userId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  source?: ReviewPlatform;
  placeId?: string;
  reviewId?: string;
}

/** Data passed to sendWhatsAppAlert */
export interface WhatsAppAlertPayload {
  to: string;
  reviewId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  suggestedReply: string;
  establishmentName?: string;
  platform?: ReviewPlatform;
}

/** Twilio / Meta callback payload (when user taps a button) */
export interface WhatsAppCallbackPayload {
  action: CallbackAction;
  reviewId: string;
  /** For EDIT_REPLY: optional new reply text if user sent one */
  replyText?: string;
}
