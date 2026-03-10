-- Ajout colonnes pour le classement intelligent des retours clients (suggestions page)
ALTER TABLE public.private_feedback
ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS theme TEXT,
ADD COLUMN IF NOT EXISTS sentiment TEXT;

-- Policy UPDATE pour que le propriétaire puisse marquer comme traité
CREATE POLICY "private_feedback_update_owner" ON public.private_feedback
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
