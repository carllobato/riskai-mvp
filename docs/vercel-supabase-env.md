# Supabase env (local + Vercel)

The app saves risks to **Supabase** when you click the header **Save** button. This is the same in local development and on Vercel: there is no "local-only" mode. For Save to work you need Supabase env vars set in both places.

## Local development

1. Create `.env.local` in the project root with:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon/public key
2. Restart the dev server after adding or changing env vars.
3. If Save fails, check the browser console and the red error message under the Save button (e.g. RLS policy, missing table, or invalid key).

## Vercel (production)

### 1. Confirm deployment

- Repo is connected to Vercel and deploys from `main`.
- Note your production URL: `https://<your-app>.vercel.app`.

### 2. Set environment variables in Vercel

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → your project.
2. **Settings** → **Environment Variables**.
3. Add (values must match `.env.local`; no extra spaces or quotes):

   | Name | Value | Environments |
   |------|--------|---------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | same as `.env.local` | Production (and Preview if desired) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same as `.env.local` | Production (and Preview if desired) |
   | `UPSTASH_REDIS_REST_URL` | same as `.env.local` | Production (and Preview if desired) |
   | `UPSTASH_REDIS_REST_TOKEN` | same as `.env.local` | Production (and Preview if desired) |

4. Save. Redeploy so the new vars are applied (see step 3).

### 3. Redeploy

- **Option A:** Vercel → **Deployments** → latest → **⋯** → **Redeploy** (no cache if you want a clean build).
- **Option B:** Push a new commit to `main` to trigger a new deployment.

### 4. Verify

- Open: `https://<your-app>.vercel.app/dev/supabase`
- You should see: **Supabase connected ✅**
- If you see an error: check env vars are set for the right environment (Production / Preview), no spaces or quotes in values, and that you redeployed after changing vars.

## Deliverable (after you verify)

- Confirm the production URL you tested (e.g. “production `/dev/supabase` works”).
- Confirm whether env vars were set for **Production only** or **Production + Preview**.
