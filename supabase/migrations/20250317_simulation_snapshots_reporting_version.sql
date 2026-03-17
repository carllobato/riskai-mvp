-- Add reporting version fields to simulation_snapshots (one reporting run per project; one-way lock).
ALTER TABLE public.simulation_snapshots
  ADD COLUMN IF NOT EXISTS reporting_version boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reporting_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS reporting_locked_by text,
  ADD COLUMN IF NOT EXISTS reporting_note text;
