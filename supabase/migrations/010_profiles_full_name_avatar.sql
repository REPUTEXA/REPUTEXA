-- Nom du contact + avatar (Google OAuth)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
