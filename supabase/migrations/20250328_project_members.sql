-- Project-level membership (owner / editor / viewer). Extends project access and risk write rules.
-- Backfills projects.owner_user_id as role "owner" in project_members.

CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_members_project_id_idx
  ON public.project_members (project_id);

CREATE INDEX IF NOT EXISTS project_members_user_id_idx
  ON public.project_members (user_id);

CREATE OR REPLACE FUNCTION public.set_project_members_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_members_set_updated_at ON public.project_members;
CREATE TRIGGER project_members_set_updated_at
  BEFORE UPDATE ON public.project_members
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_project_members_updated_at();

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_members_select_project_access" ON public.project_members;
CREATE POLICY "project_members_select_project_access" ON public.project_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
      AND (
        p.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        )
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pfm WHERE pfm.portfolio_id = p.portfolio_id AND pfm.user_id = auth.uid())
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "project_members_insert_project_owner" ON public.project_members;
CREATE POLICY "project_members_insert_project_owner" ON public.project_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
      AND (
        p.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.role = 'owner'
        )
      )
    )
  );

DROP POLICY IF EXISTS "project_members_update_project_owner" ON public.project_members;
CREATE POLICY "project_members_update_project_owner" ON public.project_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
      AND (
        p.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.role = 'owner'
        )
      )
    )
  );

DROP POLICY IF EXISTS "project_members_delete_project_owner" ON public.project_members;
CREATE POLICY "project_members_delete_project_owner" ON public.project_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
      AND (
        p.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.role = 'owner'
        )
      )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;

-- Allow reading profiles for users visible on the same project (no direct auth.users reads).
DROP POLICY IF EXISTS "profiles_select_project_directory" ON public.profiles;
CREATE POLICY "profiles_select_project_directory" ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE (
        p.owner_user_id = profiles.id
        OR EXISTS (
          SELECT 1 FROM public.project_members tpm
          WHERE tpm.project_id = p.id AND tpm.user_id = profiles.id
        )
      )
      AND (
        p.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        )
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pfm WHERE pfm.portfolio_id = p.portfolio_id AND pfm.user_id = auth.uid())
          )
        )
      )
    )
  );

-- Owner-only lookup by email for add-member flow (SECURITY DEFINER; gated on project ownership / member owner role).
CREATE OR REPLACE FUNCTION public.riskai_find_profile_by_email_for_project(p_email text, p_project_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  surname text,
  company text,
  already_member boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    pr.id,
    pr.email,
    pr.first_name,
    pr.surname,
    pr.company,
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = p_project_id AND pm.user_id = pr.id
    ) AS already_member
  FROM public.profiles pr
  WHERE pr.email IS NOT NULL
    AND lower(trim(pr.email)) = lower(trim(p_email))
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = p_project_id
      AND (
        p.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm2
          WHERE pm2.project_id = p.id AND pm2.user_id = auth.uid() AND pm2.role = 'owner'
        )
      )
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.riskai_find_profile_by_email_for_project(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.riskai_find_profile_by_email_for_project(text, uuid) TO authenticated;

INSERT INTO public.project_members (project_id, user_id, role)
SELECT pr.id, pr.owner_user_id, 'owner'::text
FROM public.projects pr
ON CONFLICT (project_id, user_id) DO NOTHING;

-- ========== Extend projects / risks / snapshots: project_members access ==========
DROP POLICY IF EXISTS "projects_select_own_or_portfolio" ON public.projects;
CREATE POLICY "projects_select_own_or_portfolio" ON public.projects
  FOR SELECT USING (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id AND pm.user_id = auth.uid()
    )
    OR (
      portfolio_id IS NOT NULL
      AND (
        EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = projects.portfolio_id AND p.owner_user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.portfolio_members pm WHERE pm.portfolio_id = projects.portfolio_id AND pm.user_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
CREATE POLICY "projects_update_own" ON public.projects
  FOR UPDATE USING (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'editor')
    )
  );

DROP POLICY IF EXISTS "risks_select_own_project" ON public.risks;
CREATE POLICY "risks_select_own_project" ON public.risks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = risks.project_id
      AND (
        p.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        )
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm2 WHERE pm2.portfolio_id = p.portfolio_id AND pm2.user_id = auth.uid())
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
        p.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'editor')
        )
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm2 WHERE pm2.portfolio_id = p.portfolio_id AND pm2.user_id = auth.uid())
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
        p.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'editor')
        )
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm2 WHERE pm2.portfolio_id = p.portfolio_id AND pm2.user_id = auth.uid())
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
        p.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'editor')
        )
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm2 WHERE pm2.portfolio_id = p.portfolio_id AND pm2.user_id = auth.uid())
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "simulation_snapshots_select_own_project" ON public.simulation_snapshots;
CREATE POLICY "simulation_snapshots_select_own_project" ON public.simulation_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = simulation_snapshots.project_id
      AND (
        p.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        )
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm2 WHERE pm2.portfolio_id = p.portfolio_id AND pm2.user_id = auth.uid())
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
        p.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'editor')
        )
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm2 WHERE pm2.portfolio_id = p.portfolio_id AND pm2.user_id = auth.uid())
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
        p.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'editor')
        )
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm2 WHERE pm2.portfolio_id = p.portfolio_id AND pm2.user_id = auth.uid())
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
        p.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'editor')
        )
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm2 WHERE pm2.portfolio_id = p.portfolio_id AND pm2.user_id = auth.uid())
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "riskai_project_owners_select_project_access" ON public.riskai_project_owners;
CREATE POLICY "riskai_project_owners_select_project_access" ON public.riskai_project_owners
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = riskai_project_owners.project_id
      AND (
        p.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        )
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm2 WHERE pm2.portfolio_id = p.portfolio_id AND pm2.user_id = auth.uid())
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "riskai_project_owners_insert_project_access" ON public.riskai_project_owners;
CREATE POLICY "riskai_project_owners_insert_project_access" ON public.riskai_project_owners
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = riskai_project_owners.project_id
      AND (
        p.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'editor')
        )
        OR (
          p.portfolio_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.portfolios p2 WHERE p2.id = p.portfolio_id AND p2.owner_user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.portfolio_members pm2 WHERE pm2.portfolio_id = p.portfolio_id AND pm2.user_id = auth.uid())
          )
        )
      )
    )
  );
