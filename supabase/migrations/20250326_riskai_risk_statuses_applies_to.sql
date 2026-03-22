-- Reference statuses and applies-to for RiskAI forms; `risks.status` / `risks.applies_to` store `name` as text.

CREATE TABLE IF NOT EXISTS public.riskai_risk_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT riskai_risk_statuses_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS riskai_risk_statuses_active_name_idx
  ON public.riskai_risk_statuses (is_active, name);

ALTER TABLE public.riskai_risk_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "riskai_risk_statuses_select_authenticated"
  ON public.riskai_risk_statuses
  FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.riskai_risk_statuses (name, is_active)
VALUES
  ('draft', true),
  ('open', true),
  ('monitoring', true),
  ('mitigating', true),
  ('closed', true),
  ('archived', true)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.riskai_risk_applies_to (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT riskai_risk_applies_to_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS riskai_risk_applies_to_active_name_idx
  ON public.riskai_risk_applies_to (is_active, name);

ALTER TABLE public.riskai_risk_applies_to ENABLE ROW LEVEL SECURITY;

CREATE POLICY "riskai_risk_applies_to_select_authenticated"
  ON public.riskai_risk_applies_to
  FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.riskai_risk_applies_to (name, is_active)
VALUES
  ('time', true),
  ('cost', true),
  ('both', true)
ON CONFLICT (name) DO NOTHING;
