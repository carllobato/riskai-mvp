/**
 * Shared utilities for simulation distribution display (CDF, percentiles, binning).
 * Used by Simulation page; can be used by Analysis or other consumers.
 */

export type CostCdfPoint = { cost: number; cumulativePct: number };
export type TimeCdfPoint = { time: number; cumulativePct: number };

export type DistributionPoint = { cost: number; frequency: number };
export type TimeDistributionPoint = { time: number; frequency: number };

/** Get cost at a given cumulative percentile from CDF (linear interpolation). */
export function costAtPercentile(cdf: CostCdfPoint[], targetPct: number): number | null {
  if (cdf.length === 0) return null;
  if (targetPct <= cdf[0].cumulativePct) return cdf[0].cost;
  if (targetPct >= cdf[cdf.length - 1].cumulativePct) return cdf[cdf.length - 1].cost;
  for (let i = 0; i < cdf.length - 1; i++) {
    const a = cdf[i];
    const b = cdf[i + 1];
    if (targetPct >= a.cumulativePct && targetPct <= b.cumulativePct) {
      const t = (targetPct - a.cumulativePct) / (b.cumulativePct - a.cumulativePct);
      return Math.round(a.cost + (b.cost - a.cost) * t);
    }
  }
  return null;
}

/** Get cumulative percentile (0–100) at a given cost from CDF. */
export function percentileAtCost(cdf: CostCdfPoint[], cost: number): number | null {
  if (cdf.length === 0) return null;
  if (cost <= cdf[0].cost) return cdf[0].cumulativePct;
  if (cost >= cdf[cdf.length - 1].cost) return cdf[cdf.length - 1].cumulativePct;
  for (let i = 0; i < cdf.length - 1; i++) {
    const a = cdf[i];
    const b = cdf[i + 1];
    if (cost >= a.cost && cost <= b.cost) {
      const t = (cost - a.cost) / (b.cost - a.cost);
      return a.cumulativePct + (b.cumulativePct - a.cumulativePct) * t;
    }
  }
  return null;
}

/** Get time at a given cumulative percentile from CDF. */
export function timeAtPercentile(cdf: TimeCdfPoint[], targetPct: number): number | null {
  if (cdf.length === 0) return null;
  if (targetPct <= cdf[0].cumulativePct) return cdf[0].time;
  if (targetPct >= cdf[cdf.length - 1].cumulativePct) return cdf[cdf.length - 1].time;
  for (let i = 0; i < cdf.length - 1; i++) {
    const a = cdf[i];
    const b = cdf[i + 1];
    if (targetPct >= a.cumulativePct && targetPct <= b.cumulativePct) {
      const t = (targetPct - a.cumulativePct) / (b.cumulativePct - a.cumulativePct);
      return Math.round(a.time + (b.time - a.time) * t);
    }
  }
  return null;
}

/** Get cumulative percentile (0–100) at a given time from CDF. */
export function percentileAtTime(cdf: TimeCdfPoint[], time: number): number | null {
  if (cdf.length === 0) return null;
  if (time <= cdf[0].time) return cdf[0].cumulativePct;
  if (time >= cdf[cdf.length - 1].time) return cdf[cdf.length - 1].cumulativePct;
  for (let i = 0; i < cdf.length - 1; i++) {
    const a = cdf[i];
    const b = cdf[i + 1];
    if (time >= a.time && time <= b.time) {
      const t = (time - a.time) / (b.time - a.time);
      return a.cumulativePct + (b.cumulativePct - a.cumulativePct) * t;
    }
  }
  return null;
}

/** Percentile value from sorted array (0–100). */
export function percentileFromSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}

/** Bin raw samples into cost histogram buckets. */
export function binSamplesIntoHistogram(samples: number[], numBins: number): DistributionPoint[] {
  if (samples.length === 0) return [];
  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? min;
  const span = max - min || 1;
  const buckets = new Array<number>(numBins).fill(0);
  const step = span / numBins;
  for (const v of sorted) {
    const idx = Math.min(numBins - 1, Math.floor((v - min) / step));
    buckets[idx]++;
  }
  return buckets.map((count, i) => ({
    cost: Math.round(min + (i + 0.5) * step),
    frequency: count,
  }));
}

/** Bin raw time samples into histogram buckets. */
export function binSamplesIntoTimeHistogram(samples: number[], numBins: number): TimeDistributionPoint[] {
  if (samples.length === 0) return [];
  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? min;
  const span = max - min || 1;
  const buckets = new Array<number>(numBins).fill(0);
  const step = span / numBins;
  for (const v of sorted) {
    const idx = Math.min(numBins - 1, Math.floor((v - min) / step));
    buckets[idx]++;
  }
  return buckets.map((count, i) => ({
    time: Math.round(min + (i + 0.5) * step),
    frequency: count,
  }));
}

/** Build CDF (cost -> cumulative %) from distribution. */
export function distributionToCostCdf(distribution: DistributionPoint[]): CostCdfPoint[] {
  const sorted = [...distribution].sort((a, b) => a.cost - b.cost);
  const total = sorted.reduce((sum, d) => sum + d.frequency, 0);
  let cumulative = 0;
  return sorted.map((d) => {
    cumulative += d.frequency;
    return {
      cost: d.cost,
      cumulativePct: total > 0 ? (cumulative / total) * 100 : 0,
    };
  });
}

/** Build CDF (time -> cumulative %) from distribution. */
export function distributionToTimeCdf(distribution: TimeDistributionPoint[]): TimeCdfPoint[] {
  const sorted = [...distribution].sort((a, b) => a.time - b.time);
  const total = sorted.reduce((sum, d) => sum + d.frequency, 0);
  let cumulative = 0;
  return sorted.map((d) => {
    cumulative += d.frequency;
    return {
      time: d.time,
      cumulativePct: total > 0 ? (cumulative / total) * 100 : 0,
    };
  });
}

/** Bar data to CDF for cost (from smoothed bar chart data). */
export function barDataToCostCdf(data: { cost: number; barPct: number }[]): CostCdfPoint[] {
  let cumulative = 0;
  return data.map((d) => {
    cumulative += d.barPct;
    return { cost: d.cost, cumulativePct: cumulative };
  });
}

/** Bar data to CDF for time. */
export function barDataToTimeCdf(data: { time: number; barPct: number }[]): TimeCdfPoint[] {
  let cumulative = 0;
  return data.map((d) => {
    cumulative += d.barPct;
    return { time: d.time, cumulativePct: cumulative };
  });
}

const P10_DECILES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export { P10_DECILES };

/** Triangular PDF value at x for (min, mode, max). */
function triangularDensity(x: number, min: number, mode: number, max: number): number {
  if (max <= min) return 0;
  if (x <= min || x >= max) return 0;
  if (x <= mode) return (2 * (x - min)) / ((mode - min) * (max - min));
  return (2 * (max - x)) / ((max - mode) * (max - min));
}

export type CostSummary = { p50Cost: number; p80Cost: number; p90Cost: number; p20Cost?: number };
export type TimeSummary = { p50Time: number; p80Time: number; p90Time: number; p20Time?: number };

/** Derive cost histogram from percentiles when raw samples are not stored. */
export function deriveCostHistogramFromPercentiles(summary: CostSummary, numBins: number): DistributionPoint[] {
  const p20 = summary.p20Cost ?? summary.p50Cost;
  const { p50Cost, p80Cost, p90Cost } = summary;
  const range = Math.max(p80Cost - p50Cost, 1);
  const min = Math.max(0, p50Cost - range * 0.6);
  const max = p90Cost + (p90Cost - p80Cost) * 0.5;
  const step = (max - min) / numBins;
  const points: DistributionPoint[] = [];
  let total = 0;
  for (let i = 0; i < numBins; i++) {
    const cost = min + (i + 0.5) * step;
    const freq = triangularDensity(cost, min, p50Cost, max) * step;
    points.push({ cost: Math.round(cost), frequency: freq });
    total += freq;
  }
  if (total <= 0) return points;
  return points.map((p) => ({ cost: p.cost, frequency: Math.max(0, (p.frequency / total) * 100) }));
}

/** Derive time histogram from percentiles when raw time samples are not stored. */
export function deriveTimeHistogramFromPercentiles(summary: TimeSummary, numBins: number): TimeDistributionPoint[] {
  const { p50Time, p80Time, p90Time } = summary;
  const range = Math.max(p80Time - p50Time, 1);
  const min = Math.max(0, p50Time - range * 0.6);
  const max = p90Time + (p90Time - p80Time) * 0.5;
  const step = (max - min) / numBins;
  const points: TimeDistributionPoint[] = [];
  let total = 0;
  for (let i = 0; i < numBins; i++) {
    const time = min + (i + 0.5) * step;
    const freq = triangularDensity(time, min, p50Time, max) * step;
    points.push({ time: Math.round(time), frequency: freq });
    total += freq;
  }
  if (total <= 0) return points;
  return points.map((p) => ({ time: p.time, frequency: Math.max(0, (p.frequency / total) * 100) }));
}
