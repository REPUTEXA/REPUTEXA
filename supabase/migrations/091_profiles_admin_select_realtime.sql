-- Permet aux admins (JWT navigateur) de lire tous les profils : nécessaire pour
-- Supabase Realtime (postgres_changes) sur la table profiles depuis le panel admin.
-- Sans cette policy, les événements INSERT/UPDATE d'autres utilisateurs ne sont pas livrés.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "Profil: lecture par administrateur" ON public.profiles;
CREATE POLICY "Profil: lecture par administrateur"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

COMMENT ON FUNCTION public.is_admin() IS
  'True si l''utilisateur courant est admin (pour RLS + Realtime).';

-- Publication Realtime (événements INSERT/UPDATE/DELETE sur profiles)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
