-- Table pour les messages du formulaire de contact (support, facturation, partenariat)
CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  attachment_paths jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE contact_messages IS 'Messages envoyés via le formulaire Support & Contact';
COMMENT ON COLUMN contact_messages.attachment_paths IS 'Chemins des pièces jointes dans le bucket contact-attachments';
