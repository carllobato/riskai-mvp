-- Editors may add project members (invite). RLS + lookup RPC previously matched owners only.

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
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'editor')
        )
      )
    )
  );

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
    au.id,
    COALESCE(pr.email, au.email)::text AS email,
    pr.first_name,
    pr.surname,
    pr.company,
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = p_project_id AND pm.user_id = au.id
    ) AS already_member
  FROM auth.users au
  LEFT JOIN public.profiles pr ON pr.id = au.id
  WHERE au.email IS NOT NULL
    AND lower(trim(au.email)) = lower(trim(p_email))
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = p_project_id
      AND (
        p.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm2
          WHERE pm2.project_id = p.id AND pm2.user_id = auth.uid() AND pm2.role IN ('owner', 'editor')
        )
      )
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.riskai_find_profile_by_email_for_project(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.riskai_find_profile_by_email_for_project(text, uuid) TO authenticated;
