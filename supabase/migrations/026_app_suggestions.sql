-- Table app_suggestions : suggestions produits communautaires (Reputexa Product Lab)
-- Visible par tous les patrons, avec upvotes
CREATE TABLE IF NOT EXISTS public.app_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'DONE')),
  upvotes_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_suggestion_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES public.app_suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(suggestion_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_app_suggestions_created_at ON public.app_suggestions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_suggestions_upvotes ON public.app_suggestions(upvotes_count DESC);
CREATE INDEX IF NOT EXISTS idx_app_suggestion_upvotes_suggestion ON public.app_suggestion_upvotes(suggestion_id);

ALTER TABLE public.app_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_suggestion_upvotes ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour patrons authentifiés
CREATE POLICY "app_suggestions_select_all" ON public.app_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_suggestions_insert_owner" ON public.app_suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "app_suggestion_upvotes_select" ON public.app_suggestion_upvotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_suggestion_upvotes_insert" ON public.app_suggestion_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "app_suggestion_upvotes_delete" ON public.app_suggestion_upvotes FOR DELETE USING (auth.uid() = user_id);
