/**
 * Minimal snapshot history per risk: in-memory store with optional localStorage persistence.
 * Keeps only the last 10 snapshots per risk. Unit-safe: returns empty array or null when absent.
 */

import type { RiskSnapshot } from "@/domain/risk/risk-snapshot.types";
import { computeMomentum } from "@/lib/riskMomentum";
import { loadState, saveState } from "@/store/persist";

const STORAGE_KEY = "riskai:riskSnapshotHistory:v1";
const MAX_SNAPSHOTS_PER_RISK = 10;

/** In-memory store: riskId -> ordered snapshots (newest last). */
let store: Record<string, RiskSnapshot[]> = {};

let hydrated = false;

function hydrate(): void {
  if (typeof window === "undefined" || hydrated) return;
  hydrated = true;
  const loaded = loadState<Record<string, RiskSnapshot[]>>(STORAGE_KEY);
  if (loaded && typeof loaded === "object") {
    const normalized: Record<string, RiskSnapshot[]> = {};
    for (const [riskId, list] of Object.entries(loaded)) {
      if (Array.isArray(list) && riskId) {
        normalized[riskId] = list.slice(-MAX_SNAPSHOTS_PER_RISK);
      }
    }
    store = normalized;
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  saveState(STORAGE_KEY, store);
}

/**
 * Appends a snapshot for the given risk. Keeps only the last 10 per risk.
 * Computes momentum from the last 5 snapshots (including the new one) and stores it on the new snapshot.
 * Persists to localStorage when available.
 */
export function addRiskSnapshot(riskId: string, snapshot: RiskSnapshot): void {
  hydrate();
  const list = store[riskId] ?? [];
  const withId = { ...snapshot, riskId };
  const combined = [...list, withId];
  const historyForMomentum = combined.slice(-5);
  const { momentumPerCycle } = computeMomentum(historyForMomentum);
  const snapshotWithMomentum: RiskSnapshot = { ...withId, momentum: momentumPerCycle };
  const next = [...list, snapshotWithMomentum].slice(-MAX_SNAPSHOTS_PER_RISK);
  store[riskId] = next;
  persist();
}

/**
 * Returns all stored snapshots for the risk, oldest first. Unit-safe: returns [] when absent.
 */
export function getRiskHistory(riskId: string): RiskSnapshot[] {
  hydrate();
  const list = store[riskId];
  return Array.isArray(list) ? [...list] : [];
}

/**
 * Returns the most recent snapshot for the risk, or null if none. Unit-safe.
 */
export function getLatestSnapshot(riskId: string): RiskSnapshot | null {
  hydrate();
  const list = store[riskId];
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[list.length - 1] ?? null;
}
