-- YouTube Data API key seed + per-user recommendation cache (service role only).

INSERT INTO public.app_settings (key, value)
VALUES ('youtube_data_api_key', '')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.youtube_rec_cache (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  query text NOT NULL,
  videos jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS youtube_rec_cache_set_updated_at ON public.youtube_rec_cache;
CREATE TRIGGER youtube_rec_cache_set_updated_at
  BEFORE UPDATE ON public.youtube_rec_cache
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.youtube_rec_cache ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.youtube_rec_cache TO service_role;
