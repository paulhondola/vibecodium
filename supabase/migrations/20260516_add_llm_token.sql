-- Add LLM API key support to user_tokens
ALTER TABLE public.user_tokens
  ADD COLUMN IF NOT EXISTS llm_secret_id UUID,
  ADD COLUMN IF NOT EXISTS llm_base_url  TEXT,
  ADD COLUMN IF NOT EXISTS llm_model     TEXT;
