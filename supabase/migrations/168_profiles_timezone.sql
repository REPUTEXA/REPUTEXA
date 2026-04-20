-- Fuseau horaire IANA du marchand (affichage dashboard + fenêtres d’envoi courtoises).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT;

COMMENT ON COLUMN public.profiles.timezone IS
  'IANA tz (ex. Europe/Paris). Détecté navigateur ou édition manuelle ; utilisé pour dates dashboard et crons WhatsApp/e-mail.';
