/**
 * Modèle mémoire client (marchand x téléphone) - aligné sur public.reputexa_client_context.
 * Les champs factuels sont remplis par intégrations (caisse, WhatsApp), pas par hallucination LLM.
 */
export type ReputexaClientContextRow = {
  id: string;
  user_id: string;
  phone_e164: string;
  last_visit_at: string | null;
  last_whatsapp_thread_at: string | null;
  last_order_summary: string | null;
  prefs: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
