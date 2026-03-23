/** App subdomain (e.g. app.visualify.com.au). */
export const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST?.trim() ?? "app.visualify.com.au";
/** Marketing site apex (e.g. visualify.com.au). */
export const WEBSITE_HOST = process.env.NEXT_PUBLIC_WEBSITE_HOST?.trim() ?? "visualify.com.au";

export const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() ?? `https://${APP_HOST}`;
export const SITE_ORIGIN = process.env.NEXT_PUBLIC_WEBSITE_ORIGIN?.trim() ?? `https://${WEBSITE_HOST}`;

export function normalizeHost(host: string): string {
  return host.split(":")[0]?.toLowerCase() ?? "";
}

/** True for local development hosts (treated like the app host). */
export function isLocalhost(host: string): boolean {
  const h = normalizeHost(host);
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

export function isAppHost(host: string): boolean {
  const h = normalizeHost(host);
  if (isLocalhost(h)) return true;
  const app = normalizeHost(APP_HOST);
  return h === app;
}

export function isWebsiteHost(host: string): boolean {
  const h = normalizeHost(host);
  if (isLocalhost(h)) return false;
  const site = normalizeHost(WEBSITE_HOST);
  return h === site || h === `www.${site}`;
}

/** Paths that only exist on the app host; website visitors are sent to the app origin. */
export function isAppAreaPath(pathname: string): boolean {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return true;
  if (pathname === "/riskai" || pathname.startsWith("/riskai/")) return true;
  return false;
}

/** Login entry path for a request host: `/` on app, `/login` on website. */
export function getLoginPathForHost(host: string): "/" | "/login" {
  return isAppHost(host) ? "/" : "/login";
}
