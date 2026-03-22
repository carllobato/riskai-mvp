-- RLS for projects, risks, simulation_snapshots (owner_user_id; portfolio-aware SELECT).
-- Applies after 20250323_owner_user_id.sql in a full reset. Safe to re-run in SQL Editor.

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
DROP POLICY IF EXISTS "projects_select_own_or_portfolio" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;

CREATE POLICY "projects_select_own_or_portfolio" ON public.projects
  FOR SELECT USING (
    owner_user_id = auth.uid()
    OR (
      portfolio_id IS NOT NULL
      AND (
        EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = projects.portfolio_id AND p.owner_user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.portfolio_members pm WHERE pm.portfolio_id = projects.portfolio_id AND pm.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "projects_insert_own" ON public.projects
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "projects_update_own" ON public.projects
  FOR UPDATE USING (owner_user_id = auth.uid());

CREATE POLICY "projects_delete_own" ON public.projects
  FOR DELETE USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "risks_select_own_project" ON public.risks;
DROP POLICY IF EXISTS "risks_insert_own_project" ON public.risks;
DROP POLICY IF EXISTS "risks_update_own_project" ON public.risks;
DROP POLICY IF EXISTS "risks_delete_own_project" ON public.risks;

CREATE POLICY "risks_select_own_project" ON public.risks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = risks.project_id
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

CREATE POLICY "risks_insert_own_project" ON public.risks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = risks.project_id
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

CREATE POLICY "risks_update_own_project" ON public.risks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = risks.project_id
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

CREATE POLICY "risks_delete_own_project" ON public.risks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = risks.project_id
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

DROP POLICY IF EXISTS "simulation_snapshots_select_own_project" ON public.simulation_snapshots;
DROP POLICY IF EXISTS "simulation_snapshots_insert_own_project" ON public.simulation_snapshots;
DROP POLICY IF EXISTS "simulation_snapshots_update_own_project" ON public.simulation_snapshots;
DROP POLICY IF EXISTS "simulation_snapshots_delete_own_project" ON public.simulation_snapshots;

CREATE POLICY "simulation_snapshots_select_own_project" ON public.simulation_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = simulation_snapshots.project_id
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

CREATE POLICY "simulation_snapshots_insert_own_project" ON public.simulation_snapshots
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = simulation_snapshots.project_id
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

CREATE POLICY "simulation_snapshots_update_own_project" ON public.simulation_snapshots
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = simulation_snapshots.project_id
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

CREATE POLICY "simulation_snapshots_delete_own_project" ON public.simulation_snapshots
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = simulation_snapshots.project_id
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
