/**
 * Time weights over horizon (pure, deterministic).
 */

import type { Risk } from "@/domain/risk/risk.schema";
import type { TimeProfileKind } from "@/domain/risk/risk.schema";

/**
 * Returns normalized weights by month (length horizonMonths, sum = 1).
 * - If risk.timeProfile is an array: use it (pad with 0 or trim to horizonMonths), then normalize.
 * - If 'front': more weight early months; 'mid': middle; 'back': late.
 */
export function buildTimeWeights(risk: Risk, horizonMonths: number): number[] {
  const raw = risk.timeProfile;

  if (Array.isArray(raw) && raw.length > 0) {
    const slice = raw.slice(0, horizonMonths);
    const padded =
      slice.length < horizonMonths
        ? [...slice, ...Array(horizonMonths - slice.length).fill(0)]
        : slice;
    return normalize(padded);
  }

  const kind: TimeProfileKind = typeof raw === "string" ? raw : "mid";
  const weights = namedProfileWeights(kind, horizonMonths);
  return normalize(weights);
}

/** Normalize so weights sum to 1; treat NaN/Infinity as 0; prevent NaN in output. */
function normalize(arr: number[]): number[] {
  if (arr.length === 0) return [];
  const safe = arr.map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0));
  const sum = safe.reduce((s, v) => s + v, 0);
  if (sum <= 0 || !Number.isFinite(sum)) return arr.map(() => 1 / arr.length);
  const out = safe.map((v) => v / sum);
  return out.map((x) => (Number.isFinite(x) ? x : 0));
}

function namedProfileWeights(kind: TimeProfileKind, n: number): number[] {
  const i = (m: number) => (2 * m + 1) / (2 * n);
  switch (kind) {
    case "front":
      return Array.from({ length: n }, (_, m) => 1 - i(m));
    case "back":
      return Array.from({ length: n }, (_, m) => i(m));
    case "mid":
    default:
      return Array.from({ length: n }, (_, m) => {
        const x = (m + 0.5) / n;
        return 4 * (1 - x) * x;
      });
  }
}
