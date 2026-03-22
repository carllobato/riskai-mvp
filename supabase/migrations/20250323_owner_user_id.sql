-- Rename owner_id -> owner_user_id on projects and portfolios, then refresh RLS to match.

-- ========== Drop policies that reference owner_id ==========
DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
DROP POLICY IF EXISTS "projects_select_own_or_portfolio" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;

DROP POLICY IF EXISTS "portfolios_select_own_or_member" ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_insert_own" ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_update_own" ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_delete_own" ON public.portfolios;

DROP POLICY IF EXISTS "portfolio_members_select" ON public.portfolio_members;
DROP POLICY IF EXISTS "portfolio_members_insert_owner" ON public.portfolio_members;
DROP POLICY IF EXISTS "portfolio_members_delete_owner" ON public.portfolio_members;

DROP POLICY IF EXISTS "risks_select_own_project" ON public.risks;
DROP POLICY IF EXISTS "risks_insert_own_project" ON public.risks;
DROP POLICY IF EXISTS "risks_update_own_project" ON public.risks;
DROP POLICY IF EXISTS "risks_delete_own_project" ON public.risks;

DROP POLICY IF EXISTS "simulation_snapshots_select_own_project" ON public.simulation_snapshots;
DROP POLICY IF EXISTS "simulation_snapshots_insert_own_project" ON public.simulation_snapshots;
DROP POLICY IF EXISTS "simulation_snapshots_update_own_project" ON public.simulation_snapshots;
DROP POLICY IF EXISTS "simulation_snapshots_delete_own_project" ON public.simulation_snapshots;

-- ========== Rename columns when still using legacy name ==========
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.projects RENAME COLUMN owner_id TO owner_user_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'portfolios' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.portfolios RENAME COLUMN owner_id TO owner_user_id;
  END IF;
END $$;

-- ========== PORTFOLIOS RLS ==========
CREATE POLICY "portfolios_select_own_or_member" ON public.portfolios
  FOR SELECT USING (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.portfolio_members pm
      WHERE pm.portfolio_id = portfolios.id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "portfolios_insert_own" ON public.portfolios
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "portfolios_update_own" ON public.portfolios
  FOR UPDATE USING (owner_user_id = auth.uid());

CREATE POLICY "portfolios_delete_own" ON public.portfolios
  FOR DELETE USING (owner_user_id = auth.uid());

-- ========== PORTFOLIO_MEMBERS RLS ==========
CREATE POLICY "portfolio_members_select" ON public.portfolio_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_members.portfolio_id AND p.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.portfolio_members pm2
      WHERE pm2.portfolio_id = portfolio_members.portfolio_id
        AND pm2.user_id = auth.uid()
        AND pm2.role = 'admin'
    )
  );

CREATE POLICY "portfolio_members_insert_owner" ON public.portfolio_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_members.portfolio_id AND p.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "portfolio_members_delete_owner" ON public.portfolio_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_members.portfolio_id AND p.owner_user_id = auth.uid()
    )
  );

-- ========== PROJECTS RLS ==========
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

-- ========== RISKS RLS ==========
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

-- ========== SIMULATION_SNAPSHOTS RLS ==========
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
