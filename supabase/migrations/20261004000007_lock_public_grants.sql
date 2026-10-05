-- The Telegram webhook calls these with the service role. Default execute
-- grants left them callable by anyone. Answer columns stay off the anonymous
-- role as well; row security already hid the rows.

REVOKE ALL ON FUNCTION public.admin_consume_telegram_link_code(text, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_consume_telegram_link_code(text, bigint)
  TO service_role;

REVOKE ALL ON FUNCTION public.admin_by_telegram_chat(bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_by_telegram_chat(bigint)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_get_question_answers(uuid) FROM anon;

REVOKE SELECT (correct_choice_id, correct_grid_answers, explanation)
  ON TABLE public.questions FROM anon;
REVOKE INSERT (correct_choice_id, correct_grid_answers, explanation)
  ON TABLE public.questions FROM anon;
REVOKE UPDATE (correct_choice_id, correct_grid_answers, explanation)
  ON TABLE public.questions FROM anon;
REVOKE REFERENCES (correct_choice_id, correct_grid_answers, explanation)
  ON TABLE public.questions FROM anon;

-- Anon was granted the whole table, which keeps those columns readable.
-- There is no anonymous row policy, so this does not change the public site.
REVOKE ALL ON TABLE public.questions FROM anon;

-- Username sign-in: 5 attempts, then one more every 3 minutes, shared by every
-- Worker. Only the service role can call it.

CREATE TABLE IF NOT EXISTS public.login_attempt_buckets (
  bucket_key text PRIMARY KEY,
  tokens double precision NOT NULL,
  updated_at timestamptz NOT NULL
);

ALTER TABLE public.login_attempt_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.login_attempt_buckets FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bs_take_login_attempt(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity double precision := 5;
  v_refill_per_ms double precision := (1.0 / 3.0) / 60000.0;
  v_tokens double precision;
  v_updated timestamptz;
  v_now timestamptz := clock_timestamp();
  v_elapsed_ms double precision;
  v_retry integer;
BEGIN
  IF p_key IS NULL OR length(btrim(p_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'retry_after', 180);
  END IF;

  DELETE FROM public.login_attempt_buckets
  WHERE updated_at < v_now - interval '30 minutes'
    AND bucket_key <> p_key;

  INSERT INTO public.login_attempt_buckets (bucket_key, tokens, updated_at)
  VALUES (p_key, v_capacity, v_now)
  ON CONFLICT (bucket_key) DO NOTHING;

  SELECT tokens, updated_at
    INTO v_tokens, v_updated
  FROM public.login_attempt_buckets
  WHERE bucket_key = p_key
  FOR UPDATE;

  v_elapsed_ms := extract(epoch FROM (v_now - v_updated)) * 1000;
  v_tokens := least(v_capacity, v_tokens + v_elapsed_ms * v_refill_per_ms);

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

REVOKE ALL ON FUNCTION public.bs_take_login_attempt(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_take_login_attempt(text) TO service_role;
