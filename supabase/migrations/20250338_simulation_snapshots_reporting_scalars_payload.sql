-- RIS-28: reporting-grade snapshot scalars + full JSON payload (no new tables).
ALTER TABLE public.simulation_snapshots
  ADD COLUMN IF NOT EXISTS cost_p20 double precision,
  ADD COLUMN IF NOT EXISTS cost_p50 double precision,
  ADD COLUMN IF NOT EXISTS cost_p80 double precision,
  ADD COLUMN IF NOT EXISTS cost_p90 double precision,
  ADD COLUMN IF NOT EXISTS cost_mean double precision,
  ADD COLUMN IF NOT EXISTS cost_min double precision,
  ADD COLUMN IF NOT EXISTS cost_max double precision,
  ADD COLUMN IF NOT EXISTS time_p20 double precision,
  ADD COLUMN IF NOT EXISTS time_p50 double precision,
  ADD COLUMN IF NOT EXISTS time_p80 double precision,
  ADD COLUMN IF NOT EXISTS time_p90 double precision,
  ADD COLUMN IF NOT EXISTS time_mean double precision,
  ADD COLUMN IF NOT EXISTS time_min double precision,
  ADD COLUMN IF NOT EXISTS time_max double precision,
  ADD COLUMN IF NOT EXISTS risk_count integer,
  ADD COLUMN IF NOT EXISTS engine_version text,
  ADD COLUMN IF NOT EXISTS run_duration_ms double precision,
  ADD COLUMN IF NOT EXISTS payload jsonb;

-- Backfill reporting columns from legacy misnamed fields (p10_* held P20-equivalent values).
UPDATE public.simulation_snapshots
SET
  cost_p20 = COALESCE(cost_p20, p10_cost),
  cost_p50 = COALESCE(cost_p50, p50_cost),
  cost_p90 = COALESCE(cost_p90, p90_cost),
  cost_mean = COALESCE(cost_mean, mean_cost),
  time_p20 = COALESCE(time_p20, p10_time),
  time_p50 = COALESCE(time_p50, p50_time),
  time_p90 = COALESCE(time_p90, p90_time),
  time_mean = COALESCE(time_mean, mean_time),
  -- Legacy DB had no min/max; the app used P20/P90 (stored as p10_*/p90_*) for chart ranges.
  cost_min = COALESCE(cost_min, p10_cost),
  cost_max = COALESCE(cost_max, p90_cost),
  time_min = COALESCE(time_min, p10_time),
  time_max = COALESCE(time_max, p90_time);

-- Legacy rows had no stored P80; the app derived it as (P50 + P90) / 2.
UPDATE public.simulation_snapshots
SET cost_p80 = (cost_p50 + cost_p90) / 2.0
WHERE cost_p80 IS NULL
  AND cost_p50 IS NOT NULL
  AND cost_p90 IS NOT NULL;

UPDATE public.simulation_snapshots
SET time_p80 = (time_p50 + time_p90) / 2.0
WHERE time_p80 IS NULL
  AND time_p50 IS NOT NULL
  AND time_p90 IS NOT NULL;
