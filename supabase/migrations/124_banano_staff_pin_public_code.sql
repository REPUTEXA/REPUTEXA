-- PIN équipier : copie lisible à 4 chiffres (identique au PIN saisi) pour l’affichage patron ; fin du quick_code « caisse ».

ALTER TABLE public.banano_terminal_staff
  ADD COLUMN IF NOT EXISTS pin_public_code TEXT NULL;

-- Reprise des anciens codes caisse uniquement s’ils font exactement 4 chiffres
UPDATE public.banano_terminal_staff
SET pin_public_code = trim(quick_code)
WHERE quick_code IS NOT NULL
  AND trim(quick_code) ~ '^[0-9]{4}$'
  AND (pin_public_code IS NULL OR trim(pin_public_code) = '');

-- En cas de doublons (même code pour deux équipiers), ne garder qu’une ligne par (user_id, code)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, trim(pin_public_code)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.banano_terminal_staff
  WHERE pin_public_code IS NOT NULL AND trim(pin_public_code) ~ '^[0-9]{4}$'
)
UPDATE public.banano_terminal_staff t
SET pin_public_code = NULL
FROM ranked r
WHERE t.id = r.id AND r.rn > 1;

DROP INDEX IF EXISTS idx_banano_terminal_staff_user_quick_code;

ALTER TABLE public.banano_terminal_staff
  DROP CONSTRAINT IF EXISTS banano_terminal_staff_quick_code_check;

ALTER TABLE public.banano_terminal_staff
  DROP COLUMN IF EXISTS quick_code;

ALTER TABLE public.banano_terminal_staff
  DROP CONSTRAINT IF EXISTS banano_terminal_staff_pin_public_code_fmt_chk;

ALTER TABLE public.banano_terminal_staff
  ADD CONSTRAINT banano_terminal_staff_pin_public_code_fmt_chk
  CHECK (
    pin_public_code IS NULL
    OR (char_length(trim(pin_public_code)) = 4 AND trim(pin_public_code) ~ '^[0-9]{4}$')
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_banano_terminal_staff_user_pin_public_code
  ON public.banano_terminal_staff (user_id, pin_public_code)
  WHERE pin_public_code IS NOT NULL AND trim(pin_public_code) <> '';

COMMENT ON COLUMN public.banano_terminal_staff.pin_public_code IS
  'Écho du PIN équipier (4 chiffres) pour affichage côté patron ; le PIN réel reste dans pin_hash. Unique par commerçant.';
