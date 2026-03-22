-- Portfolio settings role model: viewers see all members; editors may invite; owner-level may edit portfolio row and manage roles/removals.

-- Any member of the portfolio may SELECT all portfolio_members rows for that portfolio.
DROP POLICY IF EXISTS "portfolio_members_select" ON public.portfolio_members;
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
    )
  );

-- Invite: table owner or portfolio member with owner/editor (legacy admin).
DROP POLICY IF EXISTS "portfolio_members_insert_owner" ON public.portfolio_members;
CREATE POLICY "portfolio_members_insert_owner" ON public.portfolio_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_members.portfolio_id AND p.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.portfolio_members pm
      WHERE pm.portfolio_id = portfolio_members.portfolio_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'editor', 'admin')
    )
  );

-- Remove members: owner-level only (table owner or member role owner/admin).
DROP POLICY IF EXISTS "portfolio_members_delete_owner" ON public.portfolio_members;
CREATE POLICY "portfolio_members_delete_owner" ON public.portfolio_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_members.portfolio_id AND p.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.portfolio_members pm
      WHERE pm.portfolio_id = portfolio_members.portfolio_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

-- Change roles: same as delete.
DROP POLICY IF EXISTS "portfolio_members_update_owner" ON public.portfolio_members;
CREATE POLICY "portfolio_members_update_owner" ON public.portfolio_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_members.portfolio_id AND p.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.portfolio_members pm
      WHERE pm.portfolio_id = portfolio_members.portfolio_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_members.portfolio_id AND p.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.portfolio_members pm
      WHERE pm.portfolio_id = portfolio_members.portfolio_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

-- Portfolio name/description: owner-level only (not editors).
DROP POLICY IF EXISTS "portfolios_update_own" ON public.portfolios;
CREATE POLICY "portfolios_update_own" ON public.portfolios
  FOR UPDATE USING (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.portfolio_members pm
      WHERE pm.portfolio_id = portfolios.id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

-- Email lookup for invites: table owner or member who may invite.
CREATE OR REPLACE FUNCTION public.riskai_find_profile_by_email_for_portfolio(p_email text, p_portfolio_id uuid)
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
      SELECT 1 FROM public.portfolio_members pm
      WHERE pm.portfolio_id = p_portfolio_id AND pm.user_id = pr.id
    ) AS already_member
  FROM public.profiles pr
  WHERE pr.email IS NOT NULL
    AND lower(trim(pr.email)) = lower(trim(p_email))
    AND (
      EXISTS (
        SELECT 1 FROM public.portfolios p
        WHERE p.id = p_portfolio_id AND p.owner_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.portfolio_members pm
        WHERE pm.portfolio_id = p_portfolio_id
          AND pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'editor', 'admin')
      )
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.riskai_find_profile_by_email_for_portfolio(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.riskai_find_profile_by_email_for_portfolio(text, uuid) TO authenticated;
