-- ============================================================
-- VibeCodium — Supabase public schema migration
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Enable uuid extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────────────────────────
-- users
-- Mirrors the Auth0/Supabase user — auth.users.id is the FK
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
    id           UUID PRIMARY KEY,          -- Supabase auth.users.id (sub)
    name         TEXT NOT NULL DEFAULT '',
    email        TEXT NOT NULL DEFAULT '',
    picture      TEXT,
    bio          TEXT,
    language     TEXT,
    location     TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- user_tokens  (GitHub / Vercel PATs stored per user)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_tokens (
    user_id       UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    github_token  TEXT,
    vercel_token  TEXT,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- projects  (imported repos — was MongoDB + SQLite)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL,
    project_name  TEXT NOT NULL,
    repo_url      TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'cloning' CHECK (status IN ('cloning','ready','error')),
    local_path    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);

-- ──────────────────────────────────────────────────────────────
-- files  (project file contents — was SQLite)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.files (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    path        TEXT NOT NULL,
    content     TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, path)
);
CREATE INDEX IF NOT EXISTS idx_files_project_id ON public.files(project_id);

-- ──────────────────────────────────────────────────────────────
-- snapshots  (point-in-time file snapshots for time-travel — was SQLite)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.snapshots (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    path        TEXT NOT NULL,
    content     TEXT,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_snapshots_project_file ON public.snapshots(project_id, path);

-- ──────────────────────────────────────────────────────────────
-- sessions  (share-link tokens — was SQLite)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sessions (
    token       TEXT PRIMARY KEY,
    project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL,
    created_by  UUID NOT NULL,
    label       TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON public.sessions(project_id);

-- ──────────────────────────────────────────────────────────────
-- help_posts  (community help board — was MongoDB)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.help_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    user_name   TEXT NOT NULL DEFAULT '',
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    repo_url    TEXT NOT NULL,
    difficulty  TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_help_posts_created ON public.help_posts(created_at DESC);

-- ──────────────────────────────────────────────────────────────
-- deployed_apps  (Vercel deployment records — was MongoDB)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deployed_apps (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL,
    title         TEXT NOT NULL,
    project_repo  TEXT NOT NULL DEFAULT '',
    project_link  TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deployed_apps_user ON public.deployed_apps(user_id);

-- ──────────────────────────────────────────────────────────────
-- timeline_events  (collaborative code timeline — was MongoDB)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.timeline_events (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       UUID NOT NULL,
    file_path        TEXT NOT NULL,
    event_type       TEXT NOT NULL CHECK (event_type IN ('code_update','agent_accepted')),
    user_id          UUID NOT NULL,
    user_name        TEXT NOT NULL,
    user_color       TEXT NOT NULL,
    content          TEXT NOT NULL DEFAULT '',
    cursor_line      INT,
    cursor_column    INT,
    is_checkpoint    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_timeline_project_file ON public.timeline_events(project_id, file_path, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_timeline_checkpoint   ON public.timeline_events(is_checkpoint) WHERE is_checkpoint = TRUE;

-- ──────────────────────────────────────────────────────────────
-- Auth Sync Trigger
-- Syncs auth.users to public.users on signup
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, picture)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ──────────────────────────────────────────────────────────────
-- RLS: disabled for now (server uses service-role key which bypasses RLS)
-- Enable and tune per-table policies when ready for production hardening.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.users           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tokens     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.files           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshots       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_posts      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployed_apps   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_events DISABLE ROW LEVEL SECURITY;
