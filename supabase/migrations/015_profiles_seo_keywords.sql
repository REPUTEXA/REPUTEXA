-- Boost SEO (plan Zenith) : mots-clés pour référencement local
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS seo_keywords TEXT[] DEFAULT '{}';
