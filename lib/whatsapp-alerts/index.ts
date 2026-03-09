/**
 * WhatsApp Alerts - Bad reviews with AI-suggested replies
 *
 * Modular structure ready for Twilio / Meta Cloud API.
 */

export { processBadReview } from './process-bad-review';
export { generateSuggestedResponse } from './generate-ai-response';
export { sendWhatsAppAlert } from './send-whatsapp-alert';
export {
  handleCallbackAction,
  CALLBACK_ACTIONS,
  type CallbackAction,
  type WhatsAppCallbackPayload,
} from './callbacks';
export type { GoogleReviewWebhookPayload, WhatsAppAlertPayload } from './types';
