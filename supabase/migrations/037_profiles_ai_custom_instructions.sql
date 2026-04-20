-- ADN IA : ai_custom_instructions, suppression ai_signature et ai_use_tutoiement
-- ai_ton et ai_length déjà présents (022)

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_custom_instructions TEXT DEFAULT '';

UPDATE public.profiles
SET ai_custom_instructions = COALESCE(ai_instructions, '')
WHERE ai_custom_instructions IS NULL OR ai_custom_instructions = '';

ALTER TABLE public.profiles DROP COLUMN IF EXISTS ai_signature;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS ai_use_tutoiement;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS ai_instructions;
