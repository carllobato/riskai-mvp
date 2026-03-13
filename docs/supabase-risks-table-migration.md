# Supabase `risks` table: add missing columns

The app’s risk form and runnable validator use more fields than the original Supabase `risks` table. If you only have the original columns, Save will work but after reload (or on another device) pre/post min/max, probability %, risk number, etc. will be missing.

## 1. Check your current table

In **Supabase Dashboard** → **Table Editor** → **risks**, confirm you have at least:

- `id`, `project_id`, `title`, `description`, `category`, `owner`, `status`
- `pre_probability`, `pre_cost_ml`, `pre_time_ml`
- `mitigation_description`, `mitigation_cost`
- `post_probability`, `post_cost_ml`, `post_time_ml`
- `created_at`, `updated_at`

If your table was created from an older schema, it may be missing the columns below.

## 2. Run the migration

1. Open **Supabase Dashboard** → **SQL Editor**.
2. Create a new query and paste the contents of:
   - **`supabase/migrations/20250311_risks_add_app_fields.sql`**
3. Run the query. It uses `ADD COLUMN IF NOT EXISTS` so it’s safe to run more than once.

Or run the SQL directly:

```sql
-- Add columns to public.risks so the app can persist and restore all form fields.
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS risk_number integer;
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS applies_to text;
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS pre_probability_pct numeric;
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS pre_cost_min numeric;
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS pre_cost_max numeric;
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS pre_time_min integer;
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS pre_time_max integer;
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS post_probability_pct numeric;
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS post_cost_min numeric;
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS post_cost_max numeric;
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS post_time_min integer;
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS post_time_max integer;
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS base_cost_impact numeric;
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS cost_impact numeric;
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS schedule_impact_days integer;
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS probability numeric;
```

## 3. Deploy the app changes

After the migration, deploy (or pull) the app version that uses these columns: updated `RiskRow` type and `riskToRow` / `rowToRisk` in `src/lib/db/risks.ts` and `src/types/risk.ts`. Then:

- **Save** will persist the new fields to Supabase.
- **Load** (e.g. refresh or open on another device) will restore them so the form and runnable validator have full data.

## 4. If you don’t have a `risks` table yet

Create it first, then run the migration above. Minimal definition:

```sql
CREATE TABLE IF NOT EXISTS public.risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL,
  owner text,
  status text NOT NULL,
  pre_probability smallint NOT NULL,
  pre_cost_ml numeric NOT NULL DEFAULT 0,
  pre_time_ml integer NOT NULL DEFAULT 0,
  mitigation_description text,
  mitigation_cost numeric NOT NULL DEFAULT 0,
  post_probability smallint NOT NULL,
  post_cost_ml numeric NOT NULL DEFAULT 0,
  post_time_ml integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Then run the ADD COLUMN migration above to add the extra app fields.
```

Then enable RLS and add policies (see `supabase/migrations/rls_projects_risks_snapshots.sql`).
