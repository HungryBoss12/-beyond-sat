-- Global like/dislike ranking for lesson YouTube recommendations (admin + API).

CREATE TABLE IF NOT EXISTS public.lesson_video_catalog (
  youtube_video_id text PRIMARY KEY,
  title text NOT NULL,
  youtube_url text NOT NULL,
  duration_seconds integer,
  score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lesson_video_catalog_score_idx
  ON public.lesson_video_catalog (score DESC, updated_at DESC);

DROP TRIGGER IF EXISTS lesson_video_catalog_set_updated_at ON public.lesson_video_catalog;
CREATE TRIGGER lesson_video_catalog_set_updated_at
  BEFORE UPDATE ON public.lesson_video_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.lesson_video_votes (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  youtube_video_id text NOT NULL REFERENCES public.lesson_video_catalog (youtube_video_id) ON DELETE CASCADE,
  vote smallint NOT NULL CHECK (vote IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, youtube_video_id)
);

DROP TRIGGER IF EXISTS lesson_video_votes_set_updated_at ON public.lesson_video_votes;
CREATE TRIGGER lesson_video_votes_set_updated_at
  BEFORE UPDATE ON public.lesson_video_votes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.lesson_video_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_video_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read lesson video catalog" ON public.lesson_video_catalog;
CREATE POLICY "Authenticated read lesson video catalog"
  ON public.lesson_video_catalog FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated read own lesson video votes" ON public.lesson_video_votes;
CREATE POLICY "Authenticated read own lesson video votes"
  ON public.lesson_video_votes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.lesson_video_catalog TO authenticated;
GRANT SELECT ON public.lesson_video_votes TO authenticated;
GRANT ALL ON public.lesson_video_catalog TO service_role;
GRANT ALL ON public.lesson_video_votes TO service_role;

-- Extract a YouTube video id from common URL shapes (mirrors src/lib/lessons/video.ts).
CREATE OR REPLACE FUNCTION public.bs_youtube_video_id(p_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  u text := trim(coalesce(p_url, ''));
  m text[];
BEGIN
  m := regexp_match(u, '[?&]v=([\w-]{6,})');
  IF m IS NOT NULL THEN RETURN m[1]; END IF;
  m := regexp_match(u, 'youtu\.be/([\w-]{6,})');
  IF m IS NOT NULL THEN RETURN m[1]; END IF;
  m := regexp_match(u, 'youtube\.com/embed/([\w-]{6,})');
  IF m IS NOT NULL THEN RETURN m[1]; END IF;
  m := regexp_match(u, 'youtube\.com/shorts/([\w-]{6,})');
  IF m IS NOT NULL THEN RETURN m[1]; END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.bs_upsert_lesson_video(
  p_video_id text,
  p_title text,
  p_youtube_url text,
  p_duration_seconds integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vid text := nullif(trim(coalesce(p_video_id, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF vid IS NULL THEN
    vid := public.bs_youtube_video_id(p_youtube_url);
  END IF;
  IF vid IS NULL OR nullif(trim(coalesce(p_title, '')), '') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.lesson_video_catalog AS c (
    youtube_video_id, title, youtube_url, duration_seconds
  )
  VALUES (
    vid,
    trim(p_title),
    coalesce(nullif(trim(coalesce(p_youtube_url, '')), ''), 'https://www.youtube.com/watch?v=' || vid),
    p_duration_seconds
  )
  ON CONFLICT (youtube_video_id) DO UPDATE
  SET
    title = EXCLUDED.title,
    youtube_url = EXCLUDED.youtube_url,
    duration_seconds = COALESCE(EXCLUDED.duration_seconds, c.duration_seconds);
END;
$$;

CREATE OR REPLACE FUNCTION public.bs_vote_lesson_video(
  p_video_id text,
  p_vote smallint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  vid text := nullif(trim(coalesce(p_video_id, '')), '');
  prev smallint;
  next_vote smallint;
  delta integer;
  new_score integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF vid IS NULL THEN
    RAISE EXCEPTION 'missing video id';
  END IF;
  IF p_vote IS NULL OR p_vote NOT IN (-1, 0, 1) THEN
    RAISE EXCEPTION 'invalid vote';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lesson_video_catalog WHERE youtube_video_id = vid
  ) THEN
    RAISE EXCEPTION 'unknown video';
  END IF;

  SELECT v.vote INTO prev
  FROM public.lesson_video_votes v
  WHERE v.user_id = uid AND v.youtube_video_id = vid;

  next_vote := CASE WHEN p_vote = 0 THEN NULL ELSE p_vote END;
  delta := coalesce(next_vote, 0) - coalesce(prev, 0);

  IF next_vote IS NULL THEN
    DELETE FROM public.lesson_video_votes
    WHERE user_id = uid AND youtube_video_id = vid;
  ELSE
    INSERT INTO public.lesson_video_votes (user_id, youtube_video_id, vote)
    VALUES (uid, vid, next_vote)
    ON CONFLICT (user_id, youtube_video_id) DO UPDATE
    SET vote = EXCLUDED.vote;
  END IF;

  IF delta <> 0 THEN
    UPDATE public.lesson_video_catalog
    SET score = score + delta
    WHERE youtube_video_id = vid
    RETURNING score INTO new_score;
  ELSE
    SELECT score INTO new_score
    FROM public.lesson_video_catalog
    WHERE youtube_video_id = vid;
  END IF;

  RETURN jsonb_build_object(
    'score', coalesce(new_score, 0),
    'my_vote', coalesce(next_vote, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bs_youtube_video_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bs_youtube_video_id(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.bs_upsert_lesson_video(text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bs_upsert_lesson_video(text, text, text, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.bs_vote_lesson_video(text, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bs_vote_lesson_video(text, smallint) TO authenticated, service_role;

-- Backfill admin Featured videos into the catalog.
INSERT INTO public.lesson_video_catalog (youtube_video_id, title, youtube_url, duration_seconds)
SELECT
  public.bs_youtube_video_id(r.youtube_url),
  r.title,
  r.youtube_url,
  r.duration_seconds
FROM public.lesson_recommended_videos r
WHERE public.bs_youtube_video_id(r.youtube_url) IS NOT NULL
ON CONFLICT (youtube_video_id) DO UPDATE
SET
  title = EXCLUDED.title,
  youtube_url = EXCLUDED.youtube_url,
  duration_seconds = COALESCE(EXCLUDED.duration_seconds, public.lesson_video_catalog.duration_seconds);
