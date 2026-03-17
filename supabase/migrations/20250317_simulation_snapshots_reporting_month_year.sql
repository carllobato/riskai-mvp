-- Reporting period (month/year) locked when snapshot is set as reporting version.
ALTER TABLE public.simulation_snapshots
  ADD COLUMN IF NOT EXISTS reporting_month_year text;
