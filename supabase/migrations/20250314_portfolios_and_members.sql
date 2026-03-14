-- Day 12: Portfolios and portfolio membership (MVP additive).
-- Portfolios are a collection layer above projects; users see portfolios they own or are members of.
-- Run in Supabase SQL Editor (or via Supabase CLI).

-- ========== PORTFOLIOS ==========
CREATE TABLE IF NOT EXISTS public.portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ========== PORTFOLIO_MEMBERS (for access; roles extensible later) ==========
CREATE TABLE IF NOT EXISTS public.portfolio_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(portfolio_id, user_id)
);

-- ========== RLS: PORTFOLIOS ==========
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

-- Users can select portfolios they own or are members of
DROP POLICY IF EXISTS "portfolios_select_own_or_member" ON public.portfolios;
CREATE POLICY "portfolios_select_own_or_member" ON public.portfolios
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.portfolio_members pm
      WHERE pm.portfolio_id = portfolios.id AND pm.user_id = auth.uid()
    )
  );

-- Only owner can insert (create portfolio)
DROP POLICY IF EXISTS "portfolios_insert_own" ON public.portfolios;
CREATE POLICY "portfolios_insert_own" ON public.portfolios
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Only owner can update/delete
DROP POLICY IF EXISTS "portfolios_update_own" ON public.portfolios;
CREATE POLICY "portfolios_update_own" ON public.portfolios
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "portfolios_delete_own" ON public.portfolios;
CREATE POLICY "portfolios_delete_own" ON public.portfolios
  FOR DELETE USING (owner_id = auth.uid());

-- ========== RLS: PORTFOLIO_MEMBERS ==========
ALTER TABLE public.portfolio_members ENABLE ROW LEVEL SECURITY;

-- Users can see their own memberships; portfolio owners can see all members of their portfolio
DROP POLICY IF EXISTS "portfolio_members_select" ON public.portfolio_members;
CREATE POLICY "portfolio_members_select" ON public.portfolio_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_members.portfolio_id AND p.owner_id = auth.uid())
  );

-- Only portfolio owner can add/remove members (for future admin)
DROP POLICY IF EXISTS "portfolio_members_insert_owner" ON public.portfolio_members;
CREATE POLICY "portfolio_members_insert_owner" ON public.portfolio_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_members.portfolio_id AND p.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "portfolio_members_delete_owner" ON public.portfolio_members;
CREATE POLICY "portfolio_members_delete_owner" ON public.portfolio_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_members.portfolio_id AND p.owner_id = auth.uid())
  );

-- ========== PROJECTS: optional portfolio linkage (additive) ==========
-- Existing projects stay portfolio_id = NULL; future /portfolios/[id]/projects will filter by this.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE SET NULL;

-- No change to existing projects RLS; project access remains owner-based.
-- When we add portfolio-scoped project listing, we will filter by portfolio_id and still enforce ownership/membership via portfolio access.
