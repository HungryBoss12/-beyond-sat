-- Compare the student's entered value to the key rounded or truncated
-- at the number of decimals they typed. Do not round the student answer
-- itself, or .3334 would match 1/3.

CREATE OR REPLACE FUNCTION public.bs_grid_values_match(p_given text, p_key text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  g double precision;
  k double precision;
  gt text;
  frac text;
  places int;
BEGIN
  IF p_given IS NULL OR p_key IS NULL THEN
    RETURN false;
  END IF;
  IF lower(btrim(p_given)) = lower(btrim(p_key)) THEN
    RETURN true;
  END IF;
  g := public.bs_parse_grid_number(p_given);
  k := public.bs_parse_grid_number(p_key);
  IF g IS NULL OR k IS NULL THEN
    RETURN false;
  END IF;
  IF abs(g - k) < 1e-9 THEN
    RETURN true;
  END IF;

  gt := btrim(p_given);
  frac := (regexp_match(gt, '\.([0-9]+)'))[1];
  IF frac IS NULL THEN
    RETURN false;
  END IF;
  places := length(frac);
  IF places < 3 OR places > 4 THEN
    RETURN false;
  END IF;
  IF abs(g - round(k::numeric, places)::double precision) < 1e-9 THEN
    RETURN true;
  END IF;
  IF abs(g - trunc(k::numeric, places)::double precision) < 1e-9 THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bs_grid_values_match(text, text) TO authenticated;
