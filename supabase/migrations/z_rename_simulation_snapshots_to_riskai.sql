-- Runs after rls_projects_risks_snapshots.sql (lexicographic order: z > r > digits).
-- Physical table name matches PostgREST / client .from("riskai_simulation_snapshots").
ALTER TABLE IF EXISTS public.simulation_snapshots RENAME TO riskai_simulation_snapshots;
