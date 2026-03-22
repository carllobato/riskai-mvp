-- Runs after z_rename_simulation_snapshots_to_riskai.sql.
-- Repairs DBs that applied 20250338 before P80 backfill existed: legacy rows had NULL cost_p80/time_p80.
UPDATE public.riskai_simulation_snapshots
SET cost_p80 = (cost_p50 + cost_p90) / 2.0
WHERE cost_p80 IS NULL
  AND cost_p50 IS NOT NULL
  AND cost_p90 IS NOT NULL;

UPDATE public.riskai_simulation_snapshots
SET time_p80 = (time_p50 + time_p90) / 2.0
WHERE time_p80 IS NULL
  AND time_p50 IS NOT NULL
  AND time_p90 IS NOT NULL;

-- Legacy rows never had min/max columns; align with pre-migration UI (P20/P90 as range proxies).
UPDATE public.riskai_simulation_snapshots
SET
  cost_min = COALESCE(cost_min, cost_p20),
  cost_max = COALESCE(cost_max, cost_p90)
WHERE cost_p20 IS NOT NULL
  AND cost_p90 IS NOT NULL
  AND (cost_min IS NULL OR cost_max IS NULL);

UPDATE public.riskai_simulation_snapshots
SET
  time_min = COALESCE(time_min, time_p20),
  time_max = COALESCE(time_max, time_p90)
WHERE time_p20 IS NOT NULL
  AND time_p90 IS NOT NULL
  AND (time_min IS NULL OR time_max IS NULL);
