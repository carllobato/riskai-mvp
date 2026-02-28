/**
 * Server-side project context cache. Populated by client via POST /api/project-context.
 * Mirrors getSimulationContext pattern for optional server use (e.g. future reporting).
 */
import type { ProjectContext } from "@/lib/projectContext";

let cached: ProjectContext | null = null;

export function setProjectContext(ctx: ProjectContext | null): void {
  cached = ctx;
}

export function getProjectContext(): ProjectContext | null {
  return cached;
}
