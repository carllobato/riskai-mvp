# `public.profiles` (schema cache / missing table)

The app reads and writes **name + company** on **`public.profiles`**, keyed by **`id` = `auth.users.id`**, with columns **`first_name`**, **`surname`**, **`email`**, **`company`**, and optional **`user_type`**. **Job title (`role`)** is stored in **`user_metadata.role`** (auth), not in this table.

Identity in the app always comes from **`supabase.auth.getUser()`** (or the server equivalent); the client does **not** query **`auth.users`** via PostgREST.

If you see *Could not find the table … in the schema cache*, the API does not see that table yet, or the cache has not refreshed.

## 1. SQL Editor

Supabase Dashboard → your project → **SQL Editor** → **New query**.

## 2. Run migrations (order)

1. Paste and run **`supabase/migrations/20250322_public_profiles.sql`** (creates **`profiles`**, RLS, optional copy from legacy **`public.users`** if present).
2. If you still use legacy **`public.users`** only, you can also run **`20250321_user_profiles.sql`** first so the copy step has data to migrate.
3. For **`owner_user_id`** on **`projects`** / **`portfolios`**, run **`20250323_owner_user_id.sql`** after portfolio migrations.

## 3. Confirm

**Table Editor** → schema **public** → **`profiles`** → you should see **`first_name`**, **`surname`**, **`email`**, **`company`**, **`user_type`**. Save your profile again in the app.

## 4. Column names

The app expects those snake_case columns on **`profiles`**. **`role`** is not stored on this table.

**Wrong Supabase project?** `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` must match the project where you ran the SQL.

**Settings / onboarding save** uses **`POST /api/me/profile`**, which upserts **`public.profiles`** and returns a **500** with Supabase’s error message if the row cannot be written (no silent success).

### Save still fails or row stays empty

1. **Network tab** — open **Save profile**, check **`/api/me/profile`**. A **500** body includes `error` (often RLS, missing column, or wrong table shape).
2. **RLS** — policies must allow **`id = auth.uid()`** for `SELECT`, `INSERT`, and `UPDATE` on `public.profiles` (see migration).
3. **Primary key** — upsert uses **`onConflict: "id"`**; `id` must match **`auth.users.id`**.
4. **Extra `NOT NULL` columns** — if `public.profiles` has other required columns with no default, add defaults or include them in the upsert.
5. **API exposure** — in Supabase **Settings → Data API**, ensure **`public`** is exposed and **`profiles`** is not excluded from the schema the API serves.
