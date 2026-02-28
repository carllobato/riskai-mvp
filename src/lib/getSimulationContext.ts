/**
 * Server-side simulation context: same logical data as Outputs page
 * (risks + neutral snapshot = scenarioSnapshots?.neutral ?? current).
 * Populated by client via POST /api/simulation-context; read by mitigation-optimisation API.
 */
import type { SimulationSnapshot } from "@/domain/simulation/simulation.types";
import { dlog } from "@/lib/debug";

type SimulationContext = {
  risks: unknown[];
  neutralSnapshot: SimulationSnapshot | null;
};

let cached: SimulationContext | null = null;
let lastUpdatedAt: number | null = null;
let lastSource: string | null = null;

/** Same field path as getNeutralP80Cost (do not import engine to avoid circular deps). */
function extractNeutralP80ForDebug(snapshot: unknown): number | null {
  if (snapshot == null || typeof snapshot !== "object") return null;
  const s = snapshot as Record<string, unknown>;
  const p80 = s.p80Cost;
  if (typeof p80 === "number" && Number.isFinite(p80)) return p80;
  return null;
}

export function setSimulationContext(ctx: SimulationContext | null, source = "simulation-context"): void {
  cached = ctx;
  lastUpdatedAt = Date.now();
  lastSource = source;
  const riskCount = ctx?.risks?.length ?? 0;
  const hasSnapshot = !!ctx?.neutralSnapshot;
  const neutralP80 = ctx?.neutralSnapshot != null ? extractNeutralP80ForDebug(ctx.neutralSnapshot) : null;
  dlog("[simctx] set", { riskCount, hasSnapshot, neutralP80, lastUpdatedAt });
}

/**
 * Returns risks and neutral snapshot the same way Outputs page does:
 * neutralSnapshot is the neutral scenario snapshot (no Monte Carlo rerun).
 */
export async function getSimulationContext(): Promise<SimulationContext> {
  const ctx = cached ?? { risks: [], neutralSnapshot: null };
  const riskCount = ctx.risks?.length ?? 0;
  const hasSnapshot = !!ctx.neutralSnapshot;
  const neutralP80 = ctx.neutralSnapshot != null ? extractNeutralP80ForDebug(ctx.neutralSnapshot) : null;
  dlog("[simctx] get", { riskCount, hasSnapshot, neutralP80, lastUpdatedAt, lastSource });
  return ctx;
}

/** Metadata for cache-inspect endpoint (no engine import). */
export function getSimulationContextStatus(): {
  riskCount: number;
  hasNeutralSnapshot: boolean;
  neutralP80: number | null;
  lastUpdatedAt: number | null;
  lastSource: string | null;
} {
  const riskCount = cached?.risks?.length ?? 0;
  const hasNeutralSnapshot = !!cached?.neutralSnapshot;
  const neutralP80 = cached?.neutralSnapshot != null ? extractNeutralP80ForDebug(cached.neutralSnapshot) : null;
  return { riskCount, hasNeutralSnapshot, neutralP80, lastUpdatedAt, lastSource };
}
