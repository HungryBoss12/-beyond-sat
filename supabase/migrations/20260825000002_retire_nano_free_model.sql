-- Retire withdrawn OpenRouter quick model (nano :free → 404 paid-only).
UPDATE public.app_settings
SET value = 'openrouter/free'
WHERE key = 'openrouter_model_quick'
  AND value IN (
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'meta-llama/llama-3.2-3b-instruct:free'
  );
