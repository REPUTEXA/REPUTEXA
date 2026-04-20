-- Stockage audio court pour promos « Champions » (envoi WhatsApp avec pièce jointe).
-- Accès lecture via URL signée au moment de l’envoi (Twilio fetch).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banano-elite-promo',
  'banano-elite-promo',
  false,
  6291456,
  ARRAY[
    'audio/webm',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 6291456,
  allowed_mime_types = ARRAY[
    'audio/webm',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a'
  ];

-- Ne pas faire COMMENT sur storage.buckets : l’éditeur SQL (rôle postgres) n’est pas propriétaire
-- de cette table système → erreur 42501 « must be owner of relation buckets ».

ALTER TABLE public.banano_loyalty_elite_promo_log
  ADD COLUMN IF NOT EXISTS audio_storage_path TEXT;

COMMENT ON COLUMN public.banano_loyalty_elite_promo_log.audio_storage_path IS
  'Chemin Storage (bucket banano-elite-promo) si un vocal a été joint à l’envoi.';
