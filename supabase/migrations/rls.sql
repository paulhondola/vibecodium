ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Anyone can read user profiles (coder-match requires this)
CREATE POLICY "users: public read"
  ON public.users FOR SELECT USING (true);

-- Only the user themselves can write their own row
CREATE POLICY "users: own upsert"
  ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users: own update"
  ON public.users FOR UPDATE USING (auth.uid() = id);

-- public.user_tokens — vault secret references
ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_tokens: own only"
  ON public.user_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- public.projects — imported repos
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Public read (profile pages, session-linked access)
CREATE POLICY "projects: public read"
  ON public.projects FOR SELECT USING (true);

CREATE POLICY "projects: owner insert"
  ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects: owner update"
  ON public.projects FOR UPDATE USING (auth.uid() = user_id);

-- public.files — project file contents
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Public read (session-based sharing relies on this)
CREATE POLICY "files: public read"
  ON public.files FOR SELECT USING (true);

-- Only the project owner can write files (join to projects table)
CREATE POLICY "files: owner write"
  ON public.files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "files: owner update"
  ON public.files FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "files: owner delete"
  ON public.files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND user_id = auth.uid()
    )
  );

-- public.snapshots — time-travel file snapshots
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots: public read"
  ON public.snapshots FOR SELECT USING (true);

CREATE POLICY "snapshots: owner insert"
  ON public.snapshots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND user_id = auth.uid()
    )
  );

-- public.sessions — share-link tokens
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Token lookup is public (no auth on the share-link route)
CREATE POLICY "sessions: public read"
  ON public.sessions FOR SELECT USING (true);

CREATE POLICY "sessions: creator insert"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "sessions: creator delete"
  ON public.sessions FOR DELETE
  USING (auth.uid() = created_by);

-- public.help_posts — community board
ALTER TABLE public.help_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "help_posts: public read"
  ON public.help_posts FOR SELECT USING (true);

CREATE POLICY "help_posts: auth insert"
  ON public.help_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No update/delete — not exposed by any route

-- public.deployed_apps — Vercel deployment records

ALTER TABLE public.deployed_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deployed_apps: owner only"
  ON public.deployed_apps FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- public.timeline_events — collaboration history
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

-- Project-level read: anyone who knows the projectId can read
-- (narrower than public but can't enforce project membership without RLS on projects too)
CREATE POLICY "timeline_events: public read"
  ON public.timeline_events FOR SELECT USING (true);

-- Inserts come from the WebSocket server (service-role, bypasses RLS)
-- This policy only gates anon key access
CREATE POLICY "timeline_events: auth insert"
  ON public.timeline_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "timeline_events: owner delete"
  ON public.timeline_events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND user_id = auth.uid()
    )
  );

---