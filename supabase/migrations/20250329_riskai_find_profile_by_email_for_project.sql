-- Replace legacy (uuid, text) signature with (text, uuid) and extended return columns.
-- Safe if 20250328 was already applied with the old signature.

DROP FUNCTION IF EXISTS public.riskai_find_profile_by_email_for_project(uuid, text);

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
