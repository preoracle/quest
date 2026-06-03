-- RLS migration — run once in Supabase SQL editor.
-- All tables use service_role (direct psycopg3) which bypasses RLS automatically.
-- Policies below govern PostgREST (anon / authenticated) access only.

-- ── study_days ────────────────────────────────────────────────────────────────
ALTER TABLE public.study_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_days_own" ON public.study_days;
CREATE POLICY "study_days_own" ON public.study_days
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- ── user_style ────────────────────────────────────────────────────────────────
ALTER TABLE public.user_style ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_style_own" ON public.user_style;
CREATE POLICY "user_style_own" ON public.user_style
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- ── llm_calls ─────────────────────────────────────────────────────────────────
-- Internal telemetry: no user-facing access via PostgREST.
-- service_role bypasses RLS, so the backend is unaffected.
ALTER TABLE public.llm_calls ENABLE ROW LEVEL SECURITY;

-- ── LangGraph checkpoint tables ───────────────────────────────────────────────
-- Backend-internal only; no end-user access via PostgREST.
ALTER TABLE public.checkpoint_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoints           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoint_blobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoint_writes     ENABLE ROW LEVEL SECURITY;
