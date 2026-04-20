-- Notifications : WhatsApp et seuil d'alerte
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS alert_threshold_stars INT DEFAULT 3 CHECK (alert_threshold_stars >= 1 AND alert_threshold_stars <= 5);
