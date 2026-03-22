-- Find profile by email for adding to portfolio_members; caller must own the portfolio.
-- Aligns with riskai_find_profile_by_email_for_project pattern.

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
    AND EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = p_portfolio_id
        AND p.owner_user_id = auth.uid()
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.riskai_find_profile_by_email_for_portfolio(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.riskai_find_profile_by_email_for_portfolio(text, uuid) TO authenticated;

-- Portfolio owner may update member roles (insert/delete already owner-only).
DROP POLICY IF EXISTS "portfolio_members_update_owner" ON public.portfolio_members;
CREATE POLICY "portfolio_members_update_owner" ON public.portfolio_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_members.portfolio_id AND p.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_members.portfolio_id AND p.owner_user_id = auth.uid()
    )
  );
