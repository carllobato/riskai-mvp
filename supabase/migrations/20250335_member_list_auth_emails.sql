-- Expose auth.users.email for member list rows when public.profiles is missing or incomplete.
-- Only returns rows for users who are actually members of the given portfolio/project; caller must be allowed to view that resource.
--
-- After applying: Supabase Dashboard → Project Settings → API → "Reload schema" (or run
-- `select pg_notify('pgrst', 'reload schema');` in the SQL editor) so PostgREST picks up the new RPCs.

CREATE OR REPLACE FUNCTION public.riskai_portfolio_member_auth_emails(
  p_portfolio_id uuid,
  p_user_ids uuid[]
)
RETURNS TABLE (user_id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT au.id, au.email::text
  FROM auth.users au
  INNER JOIN public.portfolio_members pm ON pm.user_id = au.id AND pm.portfolio_id = p_portfolio_id
  WHERE au.id = ANY (p_user_ids)
    AND au.email IS NOT NULL
    AND btrim(au.email) <> ''
    AND (
      EXISTS (
        SELECT 1 FROM public.portfolios p
        WHERE p.id = p_portfolio_id AND p.owner_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.portfolio_members pm2
        WHERE pm2.portfolio_id = p_portfolio_id AND pm2.user_id = auth.uid()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.riskai_portfolio_member_auth_emails(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.riskai_portfolio_member_auth_emails(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.riskai_project_member_auth_emails(
  p_project_id uuid,
  p_user_ids uuid[]
)
RETURNS TABLE (user_id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT au.id, au.email::text
  FROM auth.users au
  INNER JOIN public.project_members pjm ON pjm.user_id = au.id AND pjm.project_id = p_project_id
  WHERE au.id = ANY (p_user_ids)
    AND au.email IS NOT NULL
    AND btrim(au.email) <> ''
    AND (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = p_project_id AND p.owner_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = p_project_id AND pm.user_id = auth.uid()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.riskai_project_member_auth_emails(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.riskai_project_member_auth_emails(uuid, uuid[]) TO authenticated;
