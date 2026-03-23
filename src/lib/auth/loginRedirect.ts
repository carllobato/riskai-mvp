import { headers } from "next/headers";
import { getLoginPathForHost } from "@/lib/host";

/**
 * Full redirect URL when a protected page requires sign-in
 * (app host: `/?next=`, website host: `/login?next=`).
 */
export async function buildLoginRedirectUrl(pathname: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const base = getLoginPathForHost(host);
  if (!pathname || pathname === "/") return base;
  return `${base}?next=${encodeURIComponent(pathname)}`;
}
