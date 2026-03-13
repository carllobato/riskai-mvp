-- Add columns to public.risks so the app can persist and restore all form fields.
-- Run this in Supabase Dashboard → SQL Editor (or via Supabase CLI).
-- Existing rows get NULL for new columns; the app merges with local state for backward compatibility.

-- Display number (e.g. 001, 002)
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS risk_number integer;

-- Impact applies to: 'time' | 'cost' | 'both'
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS applies_to text;

-- Pre-mitigation: probability % (0–100) and full range
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS pre_probability_pct numeric;
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS pre_cost_min numeric;
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS pre_cost_max numeric;
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS pre_time_min integer;
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS pre_time_max integer;

-- Post-mitigation: probability % and full range
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS post_probability_pct numeric;
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS post_cost_min numeric;
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS post_cost_max numeric;
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS post_time_min integer;
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS post_time_max integer;

-- Summary / forward exposure
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS base_cost_impact numeric;
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS cost_impact numeric;
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS schedule_impact_days integer;
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS probability numeric;
