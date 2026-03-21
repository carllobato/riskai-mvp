# `public.users` profile columns (schema cache / missing table)

The app reads and writes **name + company** on **`public.users`**, keyed by **`id` = `auth.users.id`**, with columns **`first_name`**, **`last_name`**, **`company`**. **Job title (`role`)** is stored in **`user_metadata.role`** (auth), not in this table, so you do not need a `role` column on `users`.

If you see *Could not find the table … in the schema cache*, the API does not see that table yet, or the cache has not refreshed.

## 1. SQL Editor

Supabase Dashboard → your project → **SQL Editor** → **New query**.

## 2. Run the migration

Paste the full contents of **`supabase/migrations/20250321_user_profiles.sql`** and **Run**.

That script:

- Ensures **`public.users`** exists (or adds missing columns if you already had a `users` table).
- Enables **RLS** and policies so each user can only read/update their own row (`id = auth.uid()`).
- Grants **`authenticated`** `SELECT`, `INSERT`, `UPDATE`.

## 3. Confirm

**Table Editor** → schema **public** → **`users`** → you should see **`first_name`**, **`last_name`**, **`company`**. Save your profile again in the app.

## 4. Column names

The app expects those snake_case columns on **`users`**. **`role`** is not used on this table. If your existing `users` table uses different names (e.g. `surname` instead of `last_name`), rename in SQL or add a mapping layer in code.

**Wrong Supabase project?** `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` must match the project where you ran the SQL.

**Before the table is ready**, the legacy client helper can fall back to **`user_metadata`**; **Settings / onboarding save** uses **`POST /api/me/profile`**, which writes **`public.users` only** and returns a **500** with Supabase’s error message if the row cannot be written (no silent success).

### Save still fails or row stays empty

1. **Network tab** — open **Save profile**, check **`/api/me/profile`**. A **500** body includes `error` (often RLS, missing column, or wrong table shape).
2. **RLS** — policies must allow **`id = auth.uid()`** for `SELECT`, `INSERT`, and `UPDATE` on `public.users` (see migration).
3. **Primary key** — upsert uses **`onConflict: "id"`**; `id` must be the **primary key** (or have a **unique** constraint) and match **`auth.users.id`**.
4. **Extra `NOT NULL` columns** — if `public.users` has other required columns with no default, add defaults or include them in the upsert.
5. **API exposure** — in Supabase **Settings → Data API**, ensure **`public`** is exposed and **`users`** is not excluded from the schema the API serves.
