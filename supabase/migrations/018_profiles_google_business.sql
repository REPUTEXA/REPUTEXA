-- Connexion Google Business Profile : stockage google_location_id et infos affichage
-- Note : access_token géré par Supabase Auth (session), pas stocké en clair ici
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS google_location_id TEXT,
ADD COLUMN IF NOT EXISTS google_location_name TEXT,
ADD COLUMN IF NOT EXISTS google_location_address TEXT,
ADD COLUMN IF NOT EXISTS google_connected_at TIMESTAMPTZ;
