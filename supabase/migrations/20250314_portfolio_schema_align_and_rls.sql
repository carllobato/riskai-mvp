-- Portfolio schema alignment and RLS for portfolio-based project access.
-- Run after 20250314_portfolios_and_members.sql.
-- 1) Add description and updated_at to portfolios (MVP target shape).
-- 2) Allow project SELECT for portfolio members (so /portfolios/[id]/projects and project pages work).
-- 3) Allow risks and simulation_snapshots access when user has portfolio access to the project.

-- ========== PORTFOLIOS: add description, updated_at ==========
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ========== PROJECTS: extend SELECT so portfolio members can see projects in their portfolios ==========
-- Keep INSERT/UPDATE/DELETE owner-only; SELECT allows owner OR portfolio access.
DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
CREATE POLICY "projects_select_own_or_portfolio" ON public.projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR (
      portfolio_id IS NOT NULL
      AND (
        EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = projects.portfolio_id AND p.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.portfolio_members pm WHERE pm.portfolio_id = projects.portfolio_id AND pm.user_id = auth.uid())
      )
    )
  );

-- ========== RISKS: allow access when user has portfolio access to the project ==========
DROP POLICY IF EXISTS "risks_select_own_project" ON public.risks;
CREATE POLICY "risks_select_own_project" ON public.risks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = risks.project_id
      AND (
        p.owner_id = auth.uid()
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm WHERE pm.portfolio_id = p.portfolio_id AND pm.user_id = auth.uid())
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "risks_insert_own_project" ON public.risks;
CREATE POLICY "risks_insert_own_project" ON public.risks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = risks.project_id
      AND (
        p.owner_id = auth.uid()
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm WHERE pm.portfolio_id = p.portfolio_id AND pm.user_id = auth.uid())
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "risks_update_own_project" ON public.risks;
CREATE POLICY "risks_update_own_project" ON public.risks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = risks.project_id
      AND (
        p.owner_id = auth.uid()
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm WHERE pm.portfolio_id = p.portfolio_id AND pm.user_id = auth.uid())
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "risks_delete_own_project" ON public.risks;
CREATE POLICY "risks_delete_own_project" ON public.risks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = risks.project_id
      AND (
        p.owner_id = auth.uid()
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm WHERE pm.portfolio_id = p.portfolio_id AND pm.user_id = auth.uid())
          )
        )
      )
    )
  );

-- ========== SIMULATION_SNAPSHOTS: allow access when user has portfolio access to the project ==========
DROP POLICY IF EXISTS "simulation_snapshots_select_own_project" ON public.simulation_snapshots;
CREATE POLICY "simulation_snapshots_select_own_project" ON public.simulation_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = simulation_snapshots.project_id
      AND (
        p.owner_id = auth.uid()
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm WHERE pm.portfolio_id = p.portfolio_id AND pm.user_id = auth.uid())
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "simulation_snapshots_insert_own_project" ON public.simulation_snapshots;
CREATE POLICY "simulation_snapshots_insert_own_project" ON public.simulation_snapshots
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = simulation_snapshots.project_id
      AND (
        p.owner_id = auth.uid()
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm WHERE pm.portfolio_id = p.portfolio_id AND pm.user_id = auth.uid())
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "simulation_snapshots_update_own_project" ON public.simulation_snapshots;
CREATE POLICY "simulation_snapshots_update_own_project" ON public.simulation_snapshots
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = simulation_snapshots.project_id
      AND (
        p.owner_id = auth.uid()
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm WHERE pm.portfolio_id = p.portfolio_id AND pm.user_id = auth.uid())
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "simulation_snapshots_delete_own_project" ON public.simulation_snapshots;
CREATE POLICY "simulation_snapshots_delete_own_project" ON public.simulation_snapshots
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = simulation_snapshots.project_id
      AND (
        p.owner_id = auth.uid()
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm WHERE pm.portfolio_id = p.portfolio_id AND pm.user_id = auth.uid())
          )
        )
      )
    )
  );
