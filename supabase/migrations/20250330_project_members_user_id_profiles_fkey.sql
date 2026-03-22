-- Point project_members.user_id at public.profiles so PostgREST can embed profiles on member rows.
-- profiles.id already references auth.users(id); user ids stay aligned.

ALTER TABLE public.project_members
  DROP CONSTRAINT IF EXISTS project_members_user_id_fkey;

ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE;
