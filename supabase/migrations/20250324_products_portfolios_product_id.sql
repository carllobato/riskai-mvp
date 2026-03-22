-- Product catalog + portfolio linkage. POST /api/portfolios always sets product_id to RiskAI.

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.products (key, name)
VALUES ('riskai', 'RiskAI')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id);

ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS code text;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_authenticated" ON public.products;
CREATE POLICY "products_select_authenticated" ON public.products
  FOR SELECT TO authenticated
  USING (true);
