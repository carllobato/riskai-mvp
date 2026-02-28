/**
 * Dev-only shared invariant helpers for Engine Health.
 * Deterministic predicates and tolerances — no side effects.
 */

export const SUM_TOLERANCE = 1e-9;

export function isFiniteOrZero(x: number): boolean {
  return Number.isFinite(x) || x === 0;
}

export function sumApproxOne(arr: number[], tolerance = SUM_TOLERANCE): boolean {
  const sum = arr.reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1) <= tolerance;
}

export function allNonNegative(arr: number[]): boolean {
  return arr.every((v) => Number.isFinite(v) && v >= 0);
}

export function noNaNOrInfinity(arr: number[]): boolean {
  return arr.every((v) => Number.isFinite(v));
}

export function inClosed01(x: number): boolean {
  return Number.isFinite(x) && x >= 0 && x <= 1;
}

export function inZeroToOneInclusive(x: number): boolean {
  return Number.isFinite(x) && x >= 0 && x <= 1;
}
