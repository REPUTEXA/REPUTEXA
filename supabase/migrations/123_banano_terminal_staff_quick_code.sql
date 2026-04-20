-- Code caisse court (2–4 chiffres) pour check-in rapide au terminal, unique par commerçant.

ALTER TABLE public.banano_terminal_staff
  ADD COLUMN IF NOT EXISTS quick_code TEXT NULL
    CHECK (
      quick_code IS NULL
      OR (
        trim(quick_code) <> ''
        AND char_length(trim(quick_code)) BETWEEN 2 AND 4
      )
    );

COMMENT ON COLUMN public.banano_terminal_staff.quick_code IS
  'Code numérique court (2–4 chiffres) pour identifier l’équipier au terminal ; optionnel, unique par user_id.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_banano_terminal_staff_user_quick_code
  ON public.banano_terminal_staff (user_id, quick_code)
  WHERE quick_code IS NOT NULL AND trim(quick_code) <> '';
