-- Add a section column to youtube_rec_cache so recs are cached per
-- (user, section); a stale cross-section row can never leak into the other
-- section's "For you" strip. Legacy rows keep section = NULL (unscoped: only
-- served to requests without a section, i.e. AI-chat warm cache).

ALTER TABLE public.youtube_rec_cache
  ADD COLUMN IF NOT EXISTS section text;

-- PK on (user_id, section). In Postgres a PK cannot contain NULLs, so legacy
-- rows get section = '' (empty string = unscoped). The app writes NULL or the
-- section value; empty string is treated as unscoped everywhere.
UPDATE public.youtube_rec_cache SET section = '' WHERE section IS NULL;

ALTER TABLE public.youtube_rec_cache
  DROP CONSTRAINT IF EXISTS youtube_rec_cache_pkey;
ALTER TABLE public.youtube_rec_cache
  ADD CONSTRAINT youtube_rec_cache_pkey PRIMARY KEY (user_id, section);

ALTER TABLE public.youtube_rec_cache
  DROP CONSTRAINT IF EXISTS youtube_rec_cache_section_check;
ALTER TABLE public.youtube_rec_cache
  ADD CONSTRAINT youtube_rec_cache_section_check
  CHECK (section IN ('', 'rw', 'math'));

GRANT ALL ON public.youtube_rec_cache TO service_role;
