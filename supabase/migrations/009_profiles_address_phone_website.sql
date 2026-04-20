-- Profil établissement : adresse, téléphone, site web
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS website TEXT DEFAULT '';
