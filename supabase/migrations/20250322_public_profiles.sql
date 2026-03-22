-- App profile row in public.profiles (1:1 with auth.users.id).
-- Safe on fresh projects; copies from legacy public.users when that table exists.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  first_name text,
  surname text,
  email text,
  company text,
  user_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_profiles_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- Copy legacy public.users rows into profiles (first_name, last_name -> surname).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_name = 'users'
  ) THEN
    INSERT INTO public.profiles (id, first_name, surname, company, created_at, updated_at)
    SELECT u.id, u.first_name, u.last_name, u.company, u.created_at, u.updated_at
    FROM public.users u
    ON CONFLICT (id) DO UPDATE SET
      first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
      surname = COALESCE(EXCLUDED.surname, public.profiles.surname),
      company = COALESCE(EXCLUDED.company, public.profiles.company),
      updated_at = EXCLUDED.updated_at;
  END IF;
END $$;

UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE au.id = p.id AND (p.email IS NULL OR p.email IS DISTINCT FROM au.email);
