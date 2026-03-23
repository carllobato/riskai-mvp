/** Authenticated RiskAI UI (served under app host, e.g. app.visualify.com.au). */
export const RISKAI_BASE = "/riskai";
export const DASHBOARD_PATH = "/riskai/dashboard";

/** Prefix a path with the RiskAI app segment, e.g. `/projects` → `/riskai/projects`. */
export function riskaiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return RISKAI_BASE;
  return `${RISKAI_BASE}${normalized}`;
}

/** Project id from `/riskai/projects/[id]/…` (or null). */
export function projectIdFromAppPathname(pathname: string | null): string | null {
  if (!pathname) return null;
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "riskai" && segments[1] === "projects" && segments[2]) return segments[2];
  return null;
}

/** Portfolio id from `/riskai/portfolios/[id]/…` (or null). */
export function portfolioIdFromAppPathname(pathname: string | null): string | null {
  if (!pathname) return null;
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "riskai" && segments[1] === "portfolios" && segments[2]) return segments[2];
  return null;
}
