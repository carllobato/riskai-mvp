function envFlagOn(raw: string | undefined): boolean {
  if (raw == null) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Local UI preview only: skip server-side redirects to /login when there is no session.
 *
 * - Works with `next dev` and with `next start` after `next build` (NODE_ENV is often
 *   "production" there, which previously disabled the bypass).
 * - Never enabled on Vercel / Netlify (hosted deploys set VERCEL / NETLIFY).
 * - `vercel dev` may set VERCEL=1 — use `npm run dev` for bypass.
 */
export function isDevAuthBypassEnabled(): boolean {
  if (!envFlagOn(process.env.DEV_SKIP_AUTH_GUARD)) return false;
  if (process.env.VERCEL === "1") return false;
  if (process.env.NETLIFY === "true") return false;
  return true;
}
