-- Préférences IA de réponse aux avis (ADN établissement)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_tone TEXT DEFAULT 'professional' CHECK (ai_tone IN ('professional', 'warm', 'casual', 'luxury', 'humorous'));

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_length TEXT DEFAULT 'balanced' CHECK (ai_length IN ('concise', 'balanced', 'detailed'));

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_signature TEXT DEFAULT '';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_use_tutoiement BOOLEAN DEFAULT false;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_safe_mode BOOLEAN DEFAULT true;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_instructions TEXT DEFAULT '';

