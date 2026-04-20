-- Migration 067 : Rôle utilisateur pour le Panel Admin
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin'));

COMMENT ON COLUMN public.profiles.role IS
  'Rôle de l''utilisateur : user (par défaut) | admin (accès au panel d''administration REPUTEXA).';

-- Pour promouvoir un utilisateur en admin (à exécuter manuellement) :
-- UPDATE public.profiles SET role = 'admin' WHERE id = '<user_uuid>';
