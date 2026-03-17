/**
 * Distribution statistics for Monte Carlo sample diagnostics.
 * All formulas use population (not sample) definitions: divide by n, not n-1.
 * Used by the run-data Simulation Integrity section to validate simulation output.
 */

/**
 * Arithmetic mean: sum(x) / n.
 */
export function computeMean(samples: number[]): number | null {
  if (samples.length === 0) return null;
  const sum = samples.reduce((a, b) => a + b, 0);
  return sum / samples.length;
}

/**
 * Population variance: sum((x - mean)^2) / n.
 * Returns null if samples are empty.
 */
export function computeVariance(samples: number[]): number | null {
  const n = samples.length;
  if (n === 0) return null;
  const mean = computeMean(samples)!;
  const sumSq = samples.reduce((s, x) => s + (x - mean) ** 2, 0);
  return sumSq / n;
}

/**
 * Population standard deviation: sqrt(variance).
 * Returns null if samples are empty.
 */
export function computeStdDev(samples: number[]): number | null {
  const variance = computeVariance(samples);
  if (variance == null || !Number.isFinite(variance) || variance < 0) return null;
  return Math.sqrt(variance);
}

/**
 * Population skewness: (sum((x - mean)^3) / n) / (stdDev^3).
 * Measures asymmetry; 0 = symmetric, >0 = right tail, <0 = left tail.
 * Returns null if samples empty, n < 2, or stdDev is 0 (no variation).
 */
export function computeSkewness(samples: number[]): number | null {
  const n = samples.length;
  if (n < 2) return null;
  const mean = computeMean(samples)!;
  const stdDev = computeStdDev(samples);
  if (stdDev == null || stdDev === 0 || !Number.isFinite(stdDev)) return null;
  const sumThird = samples.reduce((s, x) => s + (x - mean) ** 3, 0);
  const thirdMoment = sumThird / n;
  return thirdMoment / (stdDev ** 3);
}

/**
 * Population kurtosis (raw): (sum((x - mean)^4) / n) / (stdDev^4).
 * Raw kurtosis: normal distribution ≈ 3. (Not excess kurtosis, which would be raw − 3.)
 * Returns null if samples empty, n < 2, or stdDev is 0.
 */
export function computeKurtosis(samples: number[]): number | null {
  const n = samples.length;
  if (n < 2) return null;
  const mean = computeMean(samples)!;
  const stdDev = computeStdDev(samples);
  if (stdDev == null || stdDev === 0 || !Number.isFinite(stdDev)) return null;
  const sumFourth = samples.reduce((s, x) => s + (x - mean) ** 4, 0);
  const fourthMoment = sumFourth / n;
  return fourthMoment / (stdDev ** 4);
}

/**
 * Coefficient of variation: stdDev / mean.
 * Relative spread; dimensionless. Returns null if mean is 0, missing, or samples empty.
 */
export function computeCoefficientOfVariation(samples: number[]): number | null {
  const mean = computeMean(samples);
  const stdDev = computeStdDev(samples);
  if (mean == null || !Number.isFinite(mean) || mean === 0) return null;
  if (stdDev == null || !Number.isFinite(stdDev)) return null;
  return stdDev / mean;
}

/**
 * Minimum value in sample. Returns null if empty.
 */
export function computeMin(samples: number[]): number | null {
  if (samples.length === 0) return null;
  return Math.min(...samples);
}

/**
 * Maximum value in sample. Returns null if empty.
 */
export function computeMax(samples: number[]): number | null {
  if (samples.length === 0) return null;
  return Math.max(...samples);
}
