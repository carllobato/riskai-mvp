# Vercel: Supabase env for production

Use this when connecting Supabase in production (e.g. Day 5 Step 2).

## 1. Confirm deployment

- Repo is connected to Vercel and deploys from `main`.
- Note your production URL: `https://<your-app>.vercel.app`.

## 2. Set environment variables in Vercel

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → your project.
2. **Settings** → **Environment Variables**.
3. Add (values must match `.env.local`; no extra spaces or quotes):

   | Name | Value | Environments |
   |------|--------|---------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | same as `.env.local` | Production (and Preview if desired) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same as `.env.local` | Production (and Preview if desired) |

4. Save. Redeploy so the new vars are applied (see step 3).

## 3. Redeploy

- **Option A:** Vercel → **Deployments** → latest → **⋯** → **Redeploy** (no cache if you want a clean build).
- **Option B:** Push a new commit to `main` to trigger a new deployment.

## 4. Verify

- Open: `https://<your-app>.vercel.app/dev/supabase`
- You should see: **Supabase connected ✅**
- If you see an error: check env vars are set for the right environment (Production / Preview), no spaces or quotes in values, and that you redeployed after changing vars.

## Deliverable (after you verify)

- Confirm the production URL you tested (e.g. “production `/dev/supabase` works”).
- Confirm whether env vars were set for **Production only** or **Production + Preview**.
