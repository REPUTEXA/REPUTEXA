-- Forge du mardi : brouillon / validation admin / publication + abonnés newsletter (locale persistée).

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  email TEXT PRIMARY KEY,
  locale TEXT NOT NULL DEFAULT 'fr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS newsletter_subscribers_active_idx
  ON public.newsletter_subscribers (locale)
  WHERE unsubscribed_at IS NULL;

COMMENT ON TABLE public.newsletter_subscribers IS
  'Inscriptions Flux Stratégique ; locale = langue du site à l''inscription (emails dans cette langue).';

CREATE TABLE IF NOT EXISTS public.blog_forge_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('draft_pending', 'approved', 'published')),
  week_monday DATE NOT NULL UNIQUE,
  topic_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  verification JSONB NOT NULL DEFAULT '{}'::jsonb,
  rss_headlines JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_fr JSONB NOT NULL,
  i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS blog_forge_posts_status_idx ON public.blog_forge_posts (status);
CREATE INDEX IF NOT EXISTS blog_forge_posts_published_idx ON public.blog_forge_posts (published_at DESC NULLS LAST);

COMMENT ON TABLE public.blog_forge_posts IS
  'Article hebdomadaire généré (FR source + i18n), validation admin, puis publication mardi.';

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_forge_posts ENABLE ROW LEVEL SECURITY;
