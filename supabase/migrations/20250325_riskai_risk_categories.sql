-- Reference categories for RiskAI risk forms; `risks.category` stores `name` as text.

CREATE TABLE IF NOT EXISTS public.riskai_risk_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT riskai_risk_categories_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS riskai_risk_categories_active_name_idx
  ON public.riskai_risk_categories (is_active, name);

ALTER TABLE public.riskai_risk_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "riskai_risk_categories_select_authenticated"
  ON public.riskai_risk_categories
  FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.riskai_risk_categories (name, is_active)
VALUES
  ('Commercial', true),
  ('Programme', true),
  ('Design', true),
  ('Construction', true),
  ('Procurement', true),
  ('HSE', true),
  ('Authority', true),
  ('Operations', true),
  ('Other', true)
ON CONFLICT (name) DO NOTHING;
