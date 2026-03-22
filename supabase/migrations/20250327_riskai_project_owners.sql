-- Project-scoped risk owner labels for RiskAI; `risks.owner` remains plain text (name).

CREATE TABLE IF NOT EXISTS public.riskai_project_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT riskai_project_owners_project_name_unique UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS riskai_project_owners_project_active_name_idx
  ON public.riskai_project_owners (project_id, is_active, name);

ALTER TABLE public.riskai_project_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "riskai_project_owners_select_project_access"
  ON public.riskai_project_owners
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = riskai_project_owners.project_id
      AND (
        p.owner_user_id = auth.uid()
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm WHERE pm.portfolio_id = p.portfolio_id AND pm.user_id = auth.uid())
          )
        )
      )
    )
  );

CREATE POLICY "riskai_project_owners_insert_project_access"
  ON public.riskai_project_owners
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = riskai_project_owners.project_id
      AND (
        p.owner_user_id = auth.uid()
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm WHERE pm.portfolio_id = p.portfolio_id AND pm.user_id = auth.uid())
          )
        )
      )
    )
  );
