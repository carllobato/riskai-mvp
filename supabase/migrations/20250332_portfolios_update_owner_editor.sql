-- Allow portfolio table owner and portfolio_members with owner/editor (and legacy admin) to UPDATE portfolios.
-- Viewers remain unable to change portfolio name/description (matches assertPortfolioAdminAccess).

DROP POLICY IF EXISTS "portfolios_update_own" ON public.portfolios;
CREATE POLICY "portfolios_update_own" ON public.portfolios
  FOR UPDATE USING (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.portfolio_members pm
      WHERE pm.portfolio_id = portfolios.id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'editor', 'admin')
    )
  );
