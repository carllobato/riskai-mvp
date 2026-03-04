-- RLS for projects, risks, simulation_snapshots
-- Run in Supabase SQL Editor. If your projects table uses user_id instead of owner_id, replace owner_id with user_id below.

-- ========== PROJECTS ==========
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
CREATE POLICY "projects_select_own" ON public.projects
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
CREATE POLICY "projects_insert_own" ON public.projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
CREATE POLICY "projects_update_own" ON public.projects
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;
CREATE POLICY "projects_delete_own" ON public.projects
  FOR DELETE USING (owner_id = auth.uid());

-- ========== RISKS (access only when project belongs to user) ==========
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "risks_select_own_project" ON public.risks;
CREATE POLICY "risks_select_own_project" ON public.risks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = risks.project_id AND p.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "risks_insert_own_project" ON public.risks;
CREATE POLICY "risks_insert_own_project" ON public.risks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = risks.project_id AND p.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "risks_update_own_project" ON public.risks;
CREATE POLICY "risks_update_own_project" ON public.risks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = risks.project_id AND p.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "risks_delete_own_project" ON public.risks;
CREATE POLICY "risks_delete_own_project" ON public.risks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = risks.project_id AND p.owner_id = auth.uid())
  );

-- ========== SIMULATION_SNAPSHOTS (access only when project belongs to user) ==========
ALTER TABLE public.simulation_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "simulation_snapshots_select_own_project" ON public.simulation_snapshots;
CREATE POLICY "simulation_snapshots_select_own_project" ON public.simulation_snapshots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = simulation_snapshots.project_id AND p.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "simulation_snapshots_insert_own_project" ON public.simulation_snapshots;
CREATE POLICY "simulation_snapshots_insert_own_project" ON public.simulation_snapshots
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = simulation_snapshots.project_id AND p.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "simulation_snapshots_update_own_project" ON public.simulation_snapshots;
CREATE POLICY "simulation_snapshots_update_own_project" ON public.simulation_snapshots
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = simulation_snapshots.project_id AND p.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "simulation_snapshots_delete_own_project" ON public.simulation_snapshots;
CREATE POLICY "simulation_snapshots_delete_own_project" ON public.simulation_snapshots
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = simulation_snapshots.project_id AND p.owner_id = auth.uid())
  );
