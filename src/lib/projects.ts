/**
 * Client-side project helpers. Uses GET /api/projects (requires auth).
 */

export type ProjectRow = {
  id: string;
  name: string;
  created_at: string | null;
};

export type FetchProjectsResult =
  | { ok: true; projects: ProjectRow[] }
  | { ok: false; error: string };

/**
 * Fetches the current user's projects (ordered by created_at asc).
 * Returns typed projects or an error. Call only when user is authenticated.
 */
export async function fetchProjectsClient(): Promise<FetchProjectsResult> {
  try {
    const res = await fetch("/api/projects");
    const data = (await res.json()) as { projects?: ProjectRow[]; error?: string };
    if (!res.ok) {
      return { ok: false, error: typeof data?.error === "string" ? data.error : "Failed to load projects" };
    }
    const list = Array.isArray(data?.projects) ? data.projects : [];
    const projects: ProjectRow[] = list.map((p) => ({
      id: typeof p.id === "string" ? p.id : "",
      name: typeof p.name === "string" ? p.name : "",
      created_at: p.created_at != null && typeof p.created_at === "string" ? p.created_at : null,
    }));
    return { ok: true, projects };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    return { ok: false, error: message };
  }
}
