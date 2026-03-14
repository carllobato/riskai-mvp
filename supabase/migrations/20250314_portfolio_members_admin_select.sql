-- Allow portfolio members with role 'admin' to SELECT all portfolio_members for that portfolio.
-- Required for /portfolios/[id]/admin members list. Run after 20250314_portfolio_schema_align_and_rls.sql.

DROP POLICY IF EXISTS "portfolio_members_select" ON public.portfolio_members;
CREATE POLICY "portfolio_members_select" ON public.portfolio_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_members.portfolio_id AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.portfolio_members pm2
      WHERE pm2.portfolio_id = portfolio_members.portfolio_id
        AND pm2.user_id = auth.uid()
        AND pm2.role = 'admin'
    )
  );
