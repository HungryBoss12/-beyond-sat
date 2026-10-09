-- Rate limits shared by every Worker instance. The in-memory counters only
-- held per instance, so a student spread across instances got more than the cap.

CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_usage_daily FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ai_usage_daily TO service_role;

CREATE OR REPLACE FUNCTION public.bs_take_ai_quota(p_user_id uuid, p_max integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'Asia/Tashkent')::date;
  v_count integer;
  v_reset timestamptz := ((v_day + 1)::timestamp AT TIME ZONE 'Asia/Tashkent');
BEGIN
  IF p_user_id IS NULL OR p_max IS NULL OR p_max < 1 THEN
    RETURN jsonb_build_object('ok', false, 'retry_after', 3600);
  END IF;

  DELETE FROM public.ai_usage_daily WHERE day < v_day - 7;

  INSERT INTO public.ai_usage_daily (user_id, day, count)
  VALUES (p_user_id, v_day, 1)
  ON CONFLICT (user_id, day)
  DO UPDATE SET count = public.ai_usage_daily.count + 1
  WHERE public.ai_usage_daily.count < p_max
  RETURNING count INTO v_count;

  IF v_count IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'retry_after', greatest(1, ceil(extract(epoch FROM (v_reset - now())))::integer)
    );
  END IF;
  RETURN jsonb_build_object('ok', true, 'retry_after', 0, 'used', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.bs_take_ai_quota(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_take_ai_quota(uuid, integer) TO service_role;

-- Token bucket with a caller-chosen size, sharing the sign-in bucket table.
CREATE OR REPLACE FUNCTION public.bs_take_rate_token(
  p_key text,
  p_capacity integer,
  p_per_minute double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity double precision := greatest(1, coalesce(p_capacity, 1));
  v_refill_per_ms double precision := greatest(coalesce(p_per_minute, 1), 0.01) / 60000.0;
  v_tokens double precision;
  v_updated timestamptz;
  v_now timestamptz := clock_timestamp();
  v_retry integer;
BEGIN
  IF p_key IS NULL OR length(btrim(p_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'retry_after', 60);
  END IF;

  INSERT INTO public.login_attempt_buckets (bucket_key, tokens, updated_at)
  VALUES (p_key, v_capacity, v_now)
  ON CONFLICT (bucket_key) DO NOTHING;

  SELECT tokens, updated_at
    INTO v_tokens, v_updated
  FROM public.login_attempt_buckets
  WHERE bucket_key = p_key
  FOR UPDATE;

  v_tokens := least(
    v_capacity,
    v_tokens + extract(epoch FROM (v_now - v_updated)) * 1000 * v_refill_per_ms
  );

  IF v_tokens < 1 THEN
    v_retry := ceil((1 - v_tokens) / v_refill_per_ms / 1000.0);
    UPDATE public.login_attempt_buckets
       SET tokens = v_tokens, updated_at = v_now
     WHERE bucket_key = p_key;
    RETURN jsonb_build_object('ok', false, 'retry_after', greatest(1, v_retry));
  END IF;

  UPDATE public.login_attempt_buckets
     SET tokens = v_tokens - 1, updated_at = v_now
   WHERE bucket_key = p_key;
  RETURN jsonb_build_object('ok', true, 'retry_after', 0);
END;
$$;

REVOKE ALL ON FUNCTION public.bs_take_rate_token(text, integer, double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_take_rate_token(text, integer, double precision) TO service_role;
