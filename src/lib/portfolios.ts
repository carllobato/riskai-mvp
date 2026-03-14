/**
 * Client-side portfolio helpers. Uses GET /api/portfolios (requires auth).
 */

export type PortfolioRow = {
  id: string;
  name: string;
  created_at: string | null;
};

export type FetchPortfoliosResult =
  | { ok: true; portfolios: PortfolioRow[] }
  | { ok: false; error: string };

/**
 * Fetches portfolios the current user can access (owned or member).
 * Returns typed portfolios or an error. Call only when user is authenticated.
 */
export async function fetchPortfoliosClient(): Promise<FetchPortfoliosResult> {
  try {
    const res = await fetch("/api/portfolios");
    const data = (await res.json()) as { portfolios?: PortfolioRow[]; error?: string };
    if (!res.ok) {
      return {
        ok: false,
        error: typeof data?.error === "string" ? data.error : "Failed to load portfolios",
      };
    }
    const list = Array.isArray(data?.portfolios) ? data.portfolios : [];
    const portfolios: PortfolioRow[] = list.map((p) => ({
      id: typeof p.id === "string" ? p.id : "",
      name: typeof p.name === "string" ? p.name : "",
      created_at:
        p.created_at != null && typeof p.created_at === "string" ? p.created_at : null,
    }));
    return { ok: true, portfolios };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    return { ok: false, error: message };
  }
}
