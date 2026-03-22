-- Allow reading profiles for users who share a portfolio (portfolio members UI / directory).
-- Without this, only profiles_select_own + profiles_select_project_directory apply; co-members
-- of a portfolio who do not yet share a project cannot see each other's profile rows, so the
-- members list has no profiles.email fallback even when that column is set.

DROP POLICY IF EXISTS "profiles_select_portfolio_directory" ON public.profiles;
CREATE POLICY "profiles_select_portfolio_directory" ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.portfolio_members pm_v
      INNER JOIN public.portfolio_members pm_t
        ON pm_t.portfolio_id = pm_v.portfolio_id
       AND pm_t.user_id = profiles.id
      WHERE pm_v.user_id = auth.uid()
    )
  );
