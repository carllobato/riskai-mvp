"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  Area,
  Bar,
  ComposedChart,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useRiskRegister } from "@/store/risk-register.store";
import {
  getNeutralSummary,
  getNeutralSamples,
  getNeutralTimeSamples,
  getNeutralTimeSummary,
  getTopRiskDriver,
  getTopMitigation,
  getModelStatus,
  getEngineHealth,
  getAnalysisAudit,
  type NeutralSummary,
  type NeutralTimeSummary,
} from "@/store/selectors";
import { loadProjectContext, type RiskAppetite } from "@/lib/projectContext";
import { formatDurationDays } from "@/lib/formatDuration";
import { ParityAuditPanel } from "@/components/debug/ParityAuditPanel";
import { dlog } from "@/lib/debug";

// --- Chart data types ---
type DistributionPoint = { cost: number; frequency: number };
type CdfPoint = { cost: number; cumulativePct: number };
type TimeDistributionPoint = { time: number; frequency: number };

// --- Chart styling helpers (theme-safe, board-ready) ---
const fmtPct = (n: number) => `${Math.round(n)}%`;

function formatCost(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Build CDF from histogram (sorted by cost, cumulative %). */
function distributionToCdf(distribution: DistributionPoint[]): CdfPoint[] {
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

/** Get cost at a given cumulative percentile from CDF (linear interpolation). Returns null if out of range. */
function costAtPercentile(cdf: CdfPoint[], targetPct: number): number | null {
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

/** Get cumulative percentile (0–100) at a given cost from CDF (linear interpolation). Returns null if out of range. */
function percentileAtCost(cdf: CdfPoint[], cost: number): number | null {
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

/** Triangular PDF value at x for (min, mode, max). */
function triangularDensity(x: number, min: number, mode: number, max: number): number {
  if (max <= min) return 0;
  if (x <= min || x >= max) return 0;
  if (x <= mode) return (2 * (x - min)) / ((mode - min) * (max - min));
  return (2 * (max - x)) / ((max - mode) * (max - min));
}

/**
 * Derive histogram from percentiles when raw samples are not stored.
 * Uses triangular approximation (mode ≈ p50) to produce a smooth shape.
 */
function deriveHistogramFromPercentiles(summary: NeutralSummary, numBins: number): DistributionPoint[] {
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

/** Bin raw samples into histogram buckets (for when samples exist). */
function binSamplesIntoHistogram(samples: number[], numBins: number): DistributionPoint[] {
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

/** Bin raw time (days) samples into histogram buckets. */
function binSamplesIntoTimeHistogram(samples: number[], numBins: number): TimeDistributionPoint[] {
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

/** Derive time histogram from percentiles when raw time samples are not stored. */
function deriveTimeHistogramFromPercentiles(summary: NeutralTimeSummary, numBins: number): TimeDistributionPoint[] {
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

/** Bar chart point: cost, bar % and smoothed %. */
type BarChartPoint = { cost: number; barPct: number; smoothPct: number };

/** Add smoothPct to bar data using moving average of barPct (window=3). */
function smoothBarPct(
  data: { cost: number; barPct: number }[],
  windowSize: number = 3
): BarChartPoint[] {
  if (data.length === 0) return [];
  const half = Math.floor(windowSize / 2);
  return data.map((point, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(data.length - 1, i + half);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      sum += data[j].barPct;
      count++;
    }
    const smoothPct = count > 0 ? sum / count : point.barPct;
    return { cost: point.cost, barPct: point.barPct, smoothPct };
  });
}

/** Percentile value from sorted array (0–100). */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}

/** Build CDF (cost -> cumulative %) from bar/smooth data for decile lookup when no raw samples. */
function barDataToCdf(data: { cost: number; barPct: number }[]): CdfPoint[] {
  let cumulative = 0;
  return data.map((d) => {
    cumulative += d.barPct;
    return { cost: d.cost, cumulativePct: cumulative };
  });
}

type TimeCdfPoint = { time: number; cumulativePct: number };

/** Build CDF (time -> cumulative %) from bar/smooth data for decile lookup when no raw samples. */
function barDataToCdfTime(data: { time: number; barPct: number }[]): TimeCdfPoint[] {
  let cumulative = 0;
  return data.map((d) => {
    cumulative += d.barPct;
    return { time: d.time, cumulativePct: cumulative };
  });
}

/** Get time at a given cumulative percentile from CDF (linear interpolation). */
function timeAtPercentile(cdf: TimeCdfPoint[], targetPct: number): number | null {
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

/** Add smoothPct to time bar data using moving average (window=3). */
function smoothBarPctTime(
  data: { time: number; barPct: number }[],
  windowSize: number = 3
): { time: number; barPct: number; smoothPct: number }[] {
  if (data.length === 0) return [];
  const half = Math.floor(windowSize / 2);
  return data.map((point, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(data.length - 1, i + half);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      sum += data[j].barPct;
      count++;
    }
    const smoothPct = count > 0 ? sum / count : point.barPct;
    return { time: point.time, barPct: point.barPct, smoothPct };
  });
}

// --- Shared small components (kept in page) ---

function MetricTile({
  label,
  value,
  helper,
  showSource,
  sourceLabel,
}: {
  label: string;
  value: string;
  helper?: string;
  showSource?: boolean;
  sourceLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4 transition-colors hover:border-neutral-300 dark:hover:border-neutral-600">
      <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-[var(--foreground)]">{value}</div>
      {helper && (
        <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{helper}</div>
      )}
      {showSource && (
        <div className="mt-1 text-[10px] text-neutral-400 dark:text-neutral-500 italic">
          {sourceLabel ?? "source: placeholder"}
        </div>
      )}
    </div>
  );
}

function PlaceholderChart({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex items-center justify-center min-h-[200px]">
      <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{label}</span>
    </div>
  );
}

const CHART_HEIGHT = 300;
const CHART_MARGIN = { top: 10, right: 16, left: 8, bottom: 8 };

const DISTRIBUTION_BIN_COUNT = 28;
const P10_DECILES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/** Stable empty array for when samples is null; avoids new reference every render so useMemo deps don't churn. */
const EMPTY_SAMPLES: number[] = [];

/** Parse project risk appetite e.g. "P80" -> 80. */
function riskAppetiteToPercent(riskAppetite: RiskAppetite): number {
  const n = parseInt(riskAppetite.replace(/^P/, ""), 10);
  return Number.isFinite(n) ? n : 50;
}

function CostDistributionChart({
  distribution,
  samples,
  isDerived,
  isDebug,
  iterationCount,
  targetPNumeric,
  targetPLabel,
}: {
  distribution: DistributionPoint[] | null;
  samples: number[] | null;
  isDerived?: boolean;
  isDebug?: boolean;
  iterationCount: number;
  /** Target P percentile (e.g. 80) so the line uses the same cost as the P80 marker. */
  targetPNumeric?: number | null;
  targetPLabel?: string | null;
}) {
  const costSamples = samples ?? EMPTY_SAMPLES;
  const divisor = costSamples.length > 0 ? iterationCount : 1;

  const { smoothData, deciles } = useMemo(() => {
    let barData: { cost: number; barPct: number }[] = [];
    if (costSamples.length > 0) {
      const buckets = binSamplesIntoHistogram(costSamples, DISTRIBUTION_BIN_COUNT);
      barData = buckets.map((b) => ({
        cost: b.cost,
        barPct: (Number(b.frequency) / divisor) * 100,
      }));
    } else if (distribution && distribution.length > 0) {
      const sorted = [...distribution].sort((a, b) => a.cost - b.cost);
      const total = sorted.reduce((sum, d) => sum + Number(d.frequency), 0);
      const divisor = total > 0 ? total : 1;
      barData = sorted.map((d) => ({
        cost: d.cost,
        barPct: (Number(d.frequency) / divisor) * 100,
      }));
    }
    const smoothData = smoothBarPct(barData, 3);
    const sorted = [...costSamples].sort((a, b) => a - b);
    const deciles =
      sorted.length > 0
        ? P10_DECILES.map((p) => ({ p, x: percentile(sorted, p) }))
        : smoothData.length > 0
          ? (() => {
              const cdf = barDataToCdf(smoothData);
              return P10_DECILES.map((p) => ({
                p,
                x: costAtPercentile(cdf, p) ?? smoothData[0]?.cost ?? 0,
              }));
            })()
          : [];
    return { smoothData, deciles };
  }, [costSamples, distribution, divisor]);

  const empty = smoothData.length === 0;
  /** Prepend $0 and extend to P100 so X-axis and curve use full range. */
  const chartData = useMemo(() => {
    if (smoothData.length === 0) return smoothData;
    const minCost = smoothData[0]?.cost ?? 0;
    let data = minCost <= 0 ? smoothData : [{ cost: 0, barPct: 0, smoothPct: 0 }, ...smoothData];
    const p100 = deciles.length > 0 ? Math.max(...deciles.map((d) => d.x)) : null;
    const lastCost = data[data.length - 1]?.cost ?? 0;
    if (p100 != null && p100 > lastCost) {
      data = [...data, { cost: p100, barPct: 0, smoothPct: 0 }];
    }
    return data;
  }, [smoothData, deciles]);

  /** Points where each decile (P10…) vertical line crosses the smoothed curve, for fixed markers. */
  const decileCrossings = useMemo(() => {
    if (chartData.length === 0 || deciles.length === 0) return [];
    const sorted = [...chartData].sort((a, b) => a.cost - b.cost);
    const costMin = sorted[0]?.cost ?? 0;
    const costMax = sorted[sorted.length - 1]?.cost ?? costMin;
    return deciles
      .map((d) => {
        const x = d.x;
        if (x < costMin || x > costMax) return null;
        let i = 0;
        while (i < sorted.length - 1 && sorted[i + 1].cost < x) i++;
        const a = sorted[i];
        const b = sorted[i + 1];
        if (!a) return null;
        if (!b || a.cost === b.cost) return { p: d.p, x: a.cost, y: a.smoothPct ?? 0 };
        const t = (x - a.cost) / (b.cost - a.cost);
        const y = (a.smoothPct ?? 0) + t * ((b.smoothPct ?? 0) - (a.smoothPct ?? 0));
        return { p: d.p, x, y };
      })
      .filter((c): c is { p: number; x: number; y: number } => c != null);
  }, [chartData, deciles]);

  const { yMax, yTicks } = useMemo(() => {
    if (smoothData.length === 0) return { yMax: 5, yTicks: [0, 1, 2, 3, 4, 5] };
    const maxPct = smoothData.reduce(
      (m, d) => Math.max(m, d.barPct ?? 0, d.smoothPct ?? 0),
      0
    );
    const step = maxPct <= 5 ? 0.5 : maxPct <= 10 ? 1 : 2;
    const yMax = Math.ceil(maxPct / step) * step;
    const ticks = Array.from(
      { length: Math.floor(yMax / step) + 1 },
      (_, i) => i * step
    );
    return { yMax, yTicks: ticks };
  }, [smoothData]);

  /** Target line x from same deciles as markers so line and dot align. */
  const targetLineX = useMemo(() => {
    if (targetPNumeric == null) return null;
    return deciles.find((d) => d.p === targetPNumeric)?.x ?? null;
  }, [deciles, targetPNumeric]);

  /** Costs where tooltip is allowed (P10 markers + target line only). */
  const tooltipValidCosts = useMemo(() => {
    const costs = decileCrossings.map((c) => c.x);
    if (targetLineX != null && Number.isFinite(targetLineX)) costs.push(targetLineX);
    return costs;
  }, [decileCrossings, targetLineX]);

  /** One entry per marker: so we show that marker's P and cost in the tooltip, not the chart data point. */
  const tooltipMarkers = useMemo(() => {
    const list: { pLabel: string; cost: number }[] = decileCrossings.map((c) => ({
      pLabel: `P${c.p}`,
      cost: c.x,
    }));
    if (targetLineX != null && Number.isFinite(targetLineX) && targetPLabel) {
      list.push({ pLabel: `Target (${targetPLabel})`, cost: targetLineX });
    }
    return list;
  }, [decileCrossings, targetLineX, targetPLabel]);

  const costRange = useMemo(() => {
    if (chartData.length === 0) return 1;
    const costs = chartData.map((d) => d.cost);
    return Math.max(1, Math.max(...costs) - Math.min(...costs));
  }, [chartData]);

  /** Explicit x-domain so the axis uses 100% of the chart width up to P100. */
  const xDomain = useMemo(() => {
    if (chartData.length === 0 && deciles.length === 0) return [0, 1] as [number, number];
    const costMax = chartData.length > 0 ? Math.max(...chartData.map((d) => d.cost)) : 0;
    const p100Max = deciles.length > 0 ? Math.max(...deciles.map((d) => d.x)) : 0;
    const max = Math.max(costMax, p100Max, 1);
    return [0, max] as [number, number];
  }, [chartData, deciles]);

  const [activeCost, setActiveCost] = useState<number | null>(null);
  const activeCostTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (activeCostTimeoutRef.current) clearTimeout(activeCostTimeoutRef.current);
  }, []);

  /** Hover zone: at least one bin width so all P10/target markers trigger; capped to keep zone small. */
  const tooltipTolerance = useMemo(() => {
    const minToHitMarkers = Math.max(costRange / DISTRIBUTION_BIN_COUNT, 1);
    if (tooltipValidCosts.length < 2) return Math.max(costRange * 0.005, minToHitMarkers);
    const sorted = [...tooltipValidCosts].sort((a, b) => a - b);
    let minGap = costRange;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1]! - sorted[i]!;
      if (gap > 0) minGap = Math.min(minGap, gap);
    }
    const maxTolerance = Math.min(costRange * 0.015, minGap * 0.45);
    return Math.max(minToHitMarkers, maxTolerance);
  }, [tooltipValidCosts, costRange]);

  const subtitle = empty
    ? null
    : isDerived && isDebug
      ? "Derived from percentiles (no raw samples stored)"
      : isDerived
        ? "Derived from percentiles"
        : `Monte Carlo Simulation (${iterationCount.toLocaleString()} iterations)`;

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
        <h3 className="text-base font-semibold text-[var(--foreground)] m-0">Cost Distribution</h3>
        {!empty && subtitle && isDebug && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 m-0">
            {subtitle}
          </p>
        )}
        {!empty && isDebug && (
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 m-0 italic">
            Smoothed display (moving average window=3). Raw samples preserved.
          </p>
        )}
        {!empty && isDebug && (
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 m-0">
            Deciles shown: P10..P100 (labels: P50/P80)
          </p>
        )}
      </div>
      <div className="p-4 w-full text-foreground" style={{ height: CHART_HEIGHT }}>
        {empty ? (
          <div className="h-full flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
            No data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <ComposedChart data={chartData} margin={CHART_MARGIN}>
              <XAxis
                type="number"
                dataKey="cost"
                domain={xDomain}
                scale="linear"
                allowDataOverflow
                padding={{ left: 0, right: 0 }}
                tick={false}
                tickLine={false}
                axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.3 }}
              />
              <YAxis
                hide
                domain={[0, yMax]}
                ticks={yTicks}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: "var(--foreground)" }}
                axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.3 }}
                tickLine={{ stroke: "var(--foreground)", strokeOpacity: 0.3 }}
              />
              <Tooltip
                cursor={false}
                offset={5}
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.94)",
                  border: "1px solid var(--foreground)",
                  borderRadius: 8,
                  color: "var(--foreground)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length || label == null) {
                    if (activeCostTimeoutRef.current) clearTimeout(activeCostTimeoutRef.current);
                    activeCostTimeoutRef.current = setTimeout(() => setActiveCost(null), 0);
                    return null;
                  }
                  const cost = Number(label);
                  const nearMarkerOrTarget = tooltipValidCosts.some(
                    (v) => Math.abs(cost - v) <= tooltipTolerance
                  );
                  if (!nearMarkerOrTarget) {
                    if (activeCostTimeoutRef.current) clearTimeout(activeCostTimeoutRef.current);
                    activeCostTimeoutRef.current = setTimeout(() => setActiveCost(null), 0);
                    return null;
                  }
                  const closest = tooltipMarkers.reduce((best, m) =>
                    Math.abs(cost - m.cost) < Math.abs(cost - best.cost) ? m : best
                  );
                  if (activeCostTimeoutRef.current) clearTimeout(activeCostTimeoutRef.current);
                  activeCostTimeoutRef.current = setTimeout(() => setActiveCost(closest.cost), 0);
                  return (
                    <div
                      className="px-2.5 py-2 text-sm space-y-1 rounded-lg border border-neutral-300 dark:border-neutral-600"
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.92)",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
                      }}
                    >
                      <div className="font-medium text-neutral-900">{closest.pLabel}</div>
                      <div className="text-neutral-700">{formatCost(closest.cost)}</div>
                    </div>
                  );
                }}
              />
              <defs>
                <linearGradient id="distDepth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="currentColor" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <Bar
                dataKey="barPct"
                fill="currentColor"
                fillOpacity={0.08}
                stroke="none"
                activeBar={false}
                isAnimationActive={false}
              />
              <Area
                type="natural"
                dataKey="smoothPct"
                stroke="currentColor"
                strokeWidth={2}
                fill="url(#distDepth)"
                fillOpacity={1}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
              {decileCrossings.map((c) => {
                const isActive = activeCost != null && Math.abs(c.x - activeCost) <= tooltipTolerance;
                return (
                  <ReferenceDot
                    key={c.p}
                    x={c.x}
                    y={c.y}
                    r={isActive ? 7 : 4}
                    fill="var(--foreground)"
                    stroke="var(--background)"
                    strokeWidth={1.5}
                  />
                );
              })}
              {targetLineX != null && Number.isFinite(targetLineX) && targetPLabel && (
                <ReferenceLine
                  x={targetLineX}
                  stroke="var(--foreground)"
                  strokeWidth={2}
                  strokeOpacity={0.9}
                  label={{
                    value: `Target (${targetPLabel})`,
                    position: "insideTop",
                    fontSize: 12,
                    fontWeight: 600,
                    fill: "var(--foreground)",
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

const EMPTY_TIME_SAMPLES: number[] = [];

function TimeDistributionChart({
  distribution,
  samples,
  isDerived,
  isDebug,
  iterationCount,
}: {
  distribution: TimeDistributionPoint[] | null;
  samples: number[] | null;
  isDerived?: boolean;
  isDebug?: boolean;
  iterationCount: number;
}) {
  const timeSamples = samples ?? EMPTY_TIME_SAMPLES;
  const divisor = timeSamples.length > 0 ? iterationCount : 1;

  const { smoothData, deciles } = useMemo(() => {
    let barData: { time: number; barPct: number }[] = [];
    if (timeSamples.length > 0) {
      const buckets = binSamplesIntoTimeHistogram(timeSamples, DISTRIBUTION_BIN_COUNT);
      barData = buckets.map((b) => ({
        time: b.time,
        barPct: (Number(b.frequency) / divisor) * 100,
      }));
    } else if (distribution && distribution.length > 0) {
      const sorted = [...distribution].sort((a, b) => a.time - b.time);
      const total = sorted.reduce((sum, d) => sum + Number(d.frequency), 0);
      const div = total > 0 ? total : 1;
      barData = sorted.map((d) => ({
        time: d.time,
        barPct: (Number(d.frequency) / div) * 100,
      }));
    }
    const smoothData = smoothBarPctTime(barData, 3);
    const sorted = [...timeSamples].sort((a, b) => a - b);
    const deciles =
      sorted.length > 0
        ? P10_DECILES.map((p) => ({ p, x: percentile(sorted, p) }))
        : smoothData.length > 0
          ? (() => {
              const cdf = barDataToCdfTime(smoothData);
              return P10_DECILES.map((p) => ({
                p,
                x: timeAtPercentile(cdf, p) ?? smoothData[0]?.time ?? 0,
              }));
            })()
          : [];
    return { smoothData, deciles };
  }, [timeSamples, distribution, divisor]);

  const empty = smoothData.length === 0;
  const chartData = useMemo(() => {
    if (smoothData.length === 0) return smoothData;
    const minTime = smoothData[0]?.time ?? 0;
    let data = minTime <= 0 ? smoothData : [{ time: 0, barPct: 0, smoothPct: 0 }, ...smoothData];
    const p100 = deciles.length > 0 ? Math.max(...deciles.map((d) => d.x)) : null;
    const lastTime = data[data.length - 1]?.time ?? 0;
    if (p100 != null && p100 > lastTime) {
      data = [...data, { time: p100, barPct: 0, smoothPct: 0 }];
    }
    return data;
  }, [smoothData, deciles]);

  const decileCrossings = useMemo(() => {
    if (chartData.length === 0 || deciles.length === 0) return [];
    const sorted = [...chartData].sort((a, b) => a.time - b.time);
    const timeMin = sorted[0]?.time ?? 0;
    const timeMax = sorted[sorted.length - 1]?.time ?? timeMin;
    return deciles
      .map((d) => {
        const x = d.x;
        if (x < timeMin || x > timeMax) return null;
        let i = 0;
        while (i < sorted.length - 1 && sorted[i + 1].time < x) i++;
        const a = sorted[i];
        const b = sorted[i + 1];
        if (!a) return null;
        if (!b || a.time === b.time) return { p: d.p, x: a.time, y: a.smoothPct ?? 0 };
        const t = (x - a.time) / (b.time - a.time);
        const y = (a.smoothPct ?? 0) + t * ((b.smoothPct ?? 0) - (a.smoothPct ?? 0));
        return { p: d.p, x, y };
      })
      .filter((c): c is { p: number; x: number; y: number } => c != null);
  }, [chartData, deciles]);

  const { yMax, yTicks } = useMemo(() => {
    if (smoothData.length === 0) return { yMax: 5, yTicks: [0, 1, 2, 3, 4, 5] };
    const maxPct = smoothData.reduce(
      (m, d) => Math.max(m, d.barPct ?? 0, d.smoothPct ?? 0),
      0
    );
    const step = maxPct <= 5 ? 0.5 : maxPct <= 10 ? 1 : 2;
    const yMax = Math.ceil(maxPct / step) * step;
    const ticks = Array.from(
      { length: Math.floor(yMax / step) + 1 },
      (_, i) => i * step
    );
    return { yMax, yTicks: ticks };
  }, [smoothData]);

  const tooltipValidTimes = useMemo(() => decileCrossings.map((c) => c.x), [decileCrossings]);
  const tooltipMarkers = useMemo(
    () => decileCrossings.map((c) => ({ pLabel: `P${c.p}`, time: c.x })),
    [decileCrossings]
  );

  const timeRange = useMemo(() => {
    if (chartData.length === 0) return 1;
    const times = chartData.map((d) => d.time);
    return Math.max(1, Math.max(...times) - Math.min(...times));
  }, [chartData]);

  const xDomain = useMemo(() => {
    if (chartData.length === 0 && deciles.length === 0) return [0, 1] as [number, number];
    const timeMax = chartData.length > 0 ? Math.max(...chartData.map((d) => d.time)) : 0;
    const p100Max = deciles.length > 0 ? Math.max(...deciles.map((d) => d.x)) : 0;
    const max = Math.max(timeMax, p100Max, 1);
    return [0, max] as [number, number];
  }, [chartData, deciles]);

  const [activeTime, setActiveTime] = useState<number | null>(null);
  const activeTimeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (activeTimeTimeoutRef.current) clearTimeout(activeTimeTimeoutRef.current);
    },
    []
  );

  const tooltipTolerance = useMemo(() => {
    const minToHitMarkers = Math.max(timeRange / DISTRIBUTION_BIN_COUNT, 1);
    if (tooltipValidTimes.length < 2) return Math.max(timeRange * 0.005, minToHitMarkers);
    const sorted = [...tooltipValidTimes].sort((a, b) => a - b);
    let minGap = timeRange;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1]! - sorted[i]!;
      if (gap > 0) minGap = Math.min(minGap, gap);
    }
    const maxTolerance = Math.min(timeRange * 0.015, minGap * 0.45);
    return Math.max(minToHitMarkers, maxTolerance);
  }, [tooltipValidTimes, timeRange]);

  const subtitle = empty
    ? null
    : isDerived && isDebug
      ? "Derived from percentiles (no raw samples stored)"
      : isDerived
        ? "Derived from percentiles"
        : `Monte Carlo Simulation (${iterationCount.toLocaleString()} iterations)`;

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
        <h3 className="text-base font-semibold text-[var(--foreground)] m-0">Time Distribution</h3>
        {!empty && subtitle && isDebug && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 m-0">{subtitle}</p>
        )}
        {!empty && isDebug && (
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 m-0 italic">
            Smoothed display (moving average window=3). Raw samples preserved.
          </p>
        )}
      </div>
      <div className="p-4 w-full text-foreground" style={{ height: CHART_HEIGHT }}>
        {empty ? (
          <div className="h-full flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
            No data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <ComposedChart data={chartData} margin={CHART_MARGIN}>
              <XAxis
                type="number"
                dataKey="time"
                domain={xDomain}
                scale="linear"
                allowDataOverflow
                padding={{ left: 0, right: 0 }}
                tick={false}
                tickLine={false}
                axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.3 }}
              />
              <YAxis
                hide
                domain={[0, yMax]}
                ticks={yTicks}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: "var(--foreground)" }}
                axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.3 }}
                tickLine={{ stroke: "var(--foreground)", strokeOpacity: 0.3 }}
              />
              <Tooltip
                cursor={false}
                offset={5}
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.94)",
                  border: "1px solid var(--foreground)",
                  borderRadius: 8,
                  color: "var(--foreground)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length || label == null) {
                    if (activeTimeTimeoutRef.current) clearTimeout(activeTimeTimeoutRef.current);
                    activeTimeTimeoutRef.current = setTimeout(() => setActiveTime(null), 0);
                    return null;
                  }
                  const time = Number(label);
                  const nearMarker = tooltipValidTimes.some((v) => Math.abs(time - v) <= tooltipTolerance);
                  if (!nearMarker) {
                    if (activeTimeTimeoutRef.current) clearTimeout(activeTimeTimeoutRef.current);
                    activeTimeTimeoutRef.current = setTimeout(() => setActiveTime(null), 0);
                    return null;
                  }
                  const closest = tooltipMarkers.reduce((best, m) =>
                    Math.abs(time - m.time) < Math.abs(time - best.time) ? m : best
                  );
                  if (activeTimeTimeoutRef.current) clearTimeout(activeTimeTimeoutRef.current);
                  activeTimeTimeoutRef.current = setTimeout(() => setActiveTime(closest.time), 0);
                  return (
                    <div
                      className="px-2.5 py-2 text-sm space-y-1 rounded-lg border border-neutral-300 dark:border-neutral-600"
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.92)",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
                      }}
                    >
                      <div className="font-medium text-neutral-900">{closest.pLabel}</div>
                      <div className="text-neutral-700">{formatDurationDays(closest.time)}</div>
                    </div>
                  );
                }}
              />
              <defs>
                <linearGradient id="distDepthTime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="currentColor" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <Bar
                dataKey="barPct"
                fill="currentColor"
                fillOpacity={0.08}
                stroke="none"
                activeBar={false}
                isAnimationActive={false}
              />
              <Area
                type="natural"
                dataKey="smoothPct"
                stroke="currentColor"
                strokeWidth={2}
                fill="url(#distDepthTime)"
                fillOpacity={1}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
              {decileCrossings.map((c) => {
                const isActive = activeTime != null && Math.abs(c.x - activeTime) <= tooltipTolerance;
                return (
                  <ReferenceDot
                    key={c.p}
                    x={c.x}
                    y={c.y}
                    r={isActive ? 7 : 4}
                    fill="var(--foreground)"
                    stroke="var(--background)"
                    strokeWidth={1.5}
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

const CDF_Y_TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function CumulativeProbabilityChart({
  cdfData,
  p50Cost,
  p80Cost,
  isDerived,
  isDebug,
  targetPCost,
  targetPLabel,
  contingencyCost,
  contingencyPLabel,
}: {
  cdfData: CdfPoint[] | null;
  p50Cost: number | undefined;
  p80Cost: number | undefined;
  isDerived?: boolean;
  isDebug?: boolean;
  targetPCost?: number | null;
  targetPLabel?: string | null;
  /** Current contingency fund as cost ($) — draws a reference line at this cost with P value label. */
  contingencyCost?: number | null;
  contingencyPLabel?: string | null;
}) {
  const empty = !cdfData || cdfData.length === 0;
  /** Costs where tooltip is allowed (P50, P80, target, contingency). */
  const tooltipValidCosts = useMemo(() => {
    const costs: number[] = [];
    if (p50Cost != null && Number.isFinite(p50Cost)) costs.push(p50Cost);
    if (p80Cost != null && Number.isFinite(p80Cost)) costs.push(p80Cost);
    if (targetPCost != null && Number.isFinite(targetPCost)) costs.push(targetPCost);
    if (contingencyCost != null && Number.isFinite(contingencyCost)) costs.push(contingencyCost);
    return costs;
  }, [p50Cost, p80Cost, targetPCost, contingencyCost]);

  const costRange = useMemo(() => {
    if (!cdfData?.length) return 1;
    const costs = cdfData.map((d) => d.cost);
    return Math.max(1, Math.max(...costs) - Math.min(...costs));
  }, [cdfData]);

  /** Hover zone: enough to hit P50/P80/target; capped to keep zone small. */
  const tooltipTolerance = useMemo(() => {
    if (tooltipValidCosts.length === 0) return 0;
    if (tooltipValidCosts.length < 2) return costRange * 0.008;
    const sorted = [...tooltipValidCosts].sort((a, b) => a - b);
    let minGap = costRange;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1]! - sorted[i]!;
      if (gap > 0) minGap = Math.min(minGap, gap);
    }
    return Math.min(costRange * 0.012, Math.max(minGap * 0.35, costRange * 0.003));
  }, [tooltipValidCosts, costRange]);

  /** Prepend $0 so X-axis and scale always start at 0. */
  const chartData = useMemo(() => {
    if (!cdfData || cdfData.length === 0) return cdfData ?? [];
    const minCost = cdfData[0]?.cost ?? 0;
    if (minCost <= 0) return cdfData;
    return [{ cost: 0, cumulativePct: 0 }, ...cdfData];
  }, [cdfData]);

  /** Explicit x-domain so the axis uses 100% of the chart width (no nice padding). */
  const xDomain = useMemo((): [number, number] => {
    if (!chartData?.length) return [0, 1];
    const costs = chartData.map((d) => d.cost);
    const max = Math.max(...costs);
    return [0, max];
  }, [chartData]);

  const subtitle = empty
    ? null
    : isDerived && isDebug
      ? "Derived from percentiles (no raw samples stored)"
      : isDerived
        ? "Derived from percentiles"
        : "Cost CDF";
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
        <h3 className="text-base font-semibold text-[var(--foreground)] m-0">Cumulative Probability</h3>
        {!empty && subtitle && isDebug && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 m-0">{subtitle}</p>
        )}
      </div>
      <div className="p-4 w-full text-foreground" style={{ height: CHART_HEIGHT }}>
        {empty ? (
          <div className="h-full flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
            No data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <LineChart data={chartData} margin={CHART_MARGIN}>
              <XAxis
                type="number"
                dataKey="cost"
                domain={xDomain}
                scale="linear"
                allowDataOverflow
                padding={{ left: 0, right: 0 }}
                tick={false}
                tickLine={false}
                axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.3 }}
              />
              <YAxis
                hide
                domain={[0, 100]}
                ticks={CDF_Y_TICKS}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: "var(--foreground)" }}
                axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.3 }}
                tickLine={{ stroke: "var(--foreground)", strokeOpacity: 0.3 }}
              />
              <Tooltip
                cursor={false}
                offset={5}
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.94)",
                  border: "1px solid var(--foreground)",
                  borderRadius: 8,
                  color: "var(--foreground)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length || label == null) return null;
                  const cost = Number(label);
                  const nearMarkerOrTarget = tooltipValidCosts.some(
                    (v) => Math.abs(cost - v) <= tooltipTolerance
                  );
                  if (!nearMarkerOrTarget) return null;
                  const value = payload[0]?.value;
                  return (
                    <div
                      className="px-2.5 py-2 text-sm space-y-1 rounded-lg border border-neutral-300 dark:border-neutral-600"
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.92)",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
                      }}
                    >
                      <div className="font-medium text-neutral-900">{formatCost(cost)}</div>
                      <div className="text-neutral-700">
                        Cumulative: {fmtPct(value ?? 0)}
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="cumulativePct"
                stroke="currentColor"
                strokeWidth={2}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                connectNulls
              />
              {p50Cost != null && Number.isFinite(p50Cost) && (
                <ReferenceLine
                  x={p50Cost}
                  stroke="var(--foreground)"
                  strokeOpacity={0.5}
                  strokeDasharray="3 3"
                  label={{ value: "P50", position: "insideTopLeft", fontSize: 12, fill: "var(--foreground)" }}
                />
              )}
              {p80Cost != null && Number.isFinite(p80Cost) && (
                <ReferenceLine
                  x={p80Cost}
                  stroke="var(--foreground)"
                  strokeOpacity={0.5}
                  strokeDasharray="3 3"
                  label={{ value: "P80", position: "insideTopLeft", fontSize: 12, fill: "var(--foreground)" }}
                />
              )}
              {targetPCost != null && Number.isFinite(targetPCost) && targetPLabel && (
                <ReferenceLine
                  x={targetPCost}
                  stroke="var(--foreground)"
                  strokeWidth={2}
                  strokeOpacity={0.9}
                  label={{
                    value: `Target (${targetPLabel})`,
                    position: "insideTopLeft",
                    fontSize: 12,
                    fontWeight: 600,
                    fill: "var(--foreground)",
                  }}
                />
              )}
              {contingencyCost != null && Number.isFinite(contingencyCost) && contingencyPLabel && (
                <ReferenceLine
                  x={contingencyCost}
                  stroke="var(--chart-2, #22c55e)"
                  strokeWidth={2}
                  strokeOpacity={0.9}
                  strokeDasharray="4 2"
                  label={{
                    value: `Contingency (${contingencyPLabel})`,
                    position: "insideTopRight",
                    fontSize: 12,
                    fontWeight: 600,
                    fill: "var(--chart-2, #22c55e)",
                  }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// --- Mitigation Decisions: placeholder table (API data not in store) ---
const MITIGATION_ROWS_PLACEHOLDER = [
  { rank: 1, mitigation: "Vendor backup", costBand: "$10k–$25k", benefit: "High", roi: "2.4x" },
  { rank: 2, mitigation: "Early prototyping", costBand: "$5k–$15k", benefit: "Medium", roi: "1.8x" },
  { rank: 3, mitigation: "Extra QA phase", costBand: "$15k–$30k", benefit: "Medium", roi: "1.2x" },
  { rank: 4, mitigation: "Training program", costBand: "$8k–$20k", benefit: "Low", roi: "0.9x" },
  { rank: 5, mitigation: "Contingency reserve", costBand: "$20k–$50k", benefit: "High", roi: "1.5x" },
];

export default function AnalysisPage() {
  /** Debug UI lives only under /app/dev/*; MVP surface has no debug panels. */
  const isDebug = false;
  const { risks, simulation, runSimulation, clearSimulationHistory, hasDraftRisks, invalidRunnableCount } = useRiskRegister();
  const [runBlockedInvalidCount, setRunBlockedInvalidCount] = useState<number | null>(null);

  const analysisState = useMemo(
    () => ({ risks, simulation: { ...simulation } }),
    [risks, simulation]
  );

  const neutralSummary = useMemo(() => getNeutralSummary(analysisState), [analysisState]);
  const samples = useMemo(() => getNeutralSamples(analysisState), [analysisState]);
  const timeSamples = useMemo(() => getNeutralTimeSamples(analysisState), [analysisState]);
  const timeSummary = useMemo(() => getNeutralTimeSummary(analysisState), [analysisState]);
  const topDriver = useMemo(() => getTopRiskDriver(analysisState), [analysisState]);
  const topMitigation = useMemo(() => getTopMitigation(analysisState), [analysisState]);
  const modelStatus = useMemo(() => getModelStatus(analysisState), [analysisState]);
  const engineHealth = useMemo(() => getEngineHealth(analysisState), [analysisState]);
  const analysisAudit = useMemo(() => getAnalysisAudit(analysisState), [analysisState]);

  useEffect(() => {
    if (invalidRunnableCount === 0) setRunBlockedInvalidCount(null);
  }, [invalidRunnableCount]);

  useEffect(() => {
    if (!isDebug || !neutralSummary) return;
    const tiles = [
      { label: "Schedule (P20)", valueFieldName: "p20Time", rawDays: neutralSummary.p20Time },
      { label: "Schedule (P50)", valueFieldName: "p50Time", rawDays: neutralSummary.p50Time },
      { label: "Schedule (P80)", valueFieldName: "p80Time", rawDays: neutralSummary.p80Time },
      { label: "Schedule (P90)", valueFieldName: "p90Time", rawDays: neutralSummary.p90Time },
    ];
    dlog("[Analysis schedule tiles] label → valueFieldName → rawDays", tiles);
  }, [isDebug, neutralSummary]);

  const projectContext = useMemo(() => loadProjectContext(), []);

  const { distribution, cdfData, isDerived } = useMemo(() => {
    if (neutralSummary == null) return { distribution: null as DistributionPoint[] | null, cdfData: null as CdfPoint[] | null, isDerived: true };
    if (samples != null && samples.length > 0) {
      const distribution = binSamplesIntoHistogram(samples, 20);
      const cdfData = distributionToCdf(distribution);
      return { distribution, cdfData, isDerived: false };
    }
    const distribution = deriveHistogramFromPercentiles(neutralSummary, 20);
    const cdfData = distributionToCdf(distribution);
    return { distribution, cdfData, isDerived: true };
  }, [neutralSummary, samples]);

  const contingencySufficiency = useMemo((): string => {
    if (!projectContext || !cdfData?.length) return "—";
    const contingencyMillions = projectContext.contingencyValue_m ?? 0;
    if (!Number.isFinite(contingencyMillions) || contingencyMillions < 0) return "—";
    const p = riskAppetiteToPercent(projectContext.riskAppetite);
    const costAtNominatedP = costAtPercentile(cdfData, p);
    if (costAtNominatedP == null || !Number.isFinite(costAtNominatedP)) return "—";
    // Contingency is in project unit (value_m = millions); convert to base. Simulation/CDF costs are already raw (base).
    const contingencyBase = contingencyMillions * 1e6;
    const delta = contingencyBase - costAtNominatedP;
    if (!Number.isFinite(delta)) return "—";
    const sign = delta >= 0 ? "+" : "";
    return `${sign}${formatCost(delta)}`;
  }, [projectContext, cdfData]);

  const { timeDistribution, timeIsDerived } = useMemo(() => {
    if (timeSamples != null && timeSamples.length > 0) {
      const timeDistribution = binSamplesIntoTimeHistogram(timeSamples, 20);
      return { timeDistribution, timeIsDerived: false };
    }
    if (timeSummary != null) {
      const timeDistribution = deriveTimeHistogramFromPercentiles(timeSummary, 20);
      return { timeDistribution, timeIsDerived: true };
    }
    return { timeDistribution: null as TimeDistributionPoint[] | null, timeIsDerived: true };
  }, [timeSamples, timeSummary]);

  const { targetPCost, targetPNumeric, targetPLabel } = useMemo(() => {
    if (!projectContext) return { targetPCost: null as number | null, targetPNumeric: null as number | null, targetPLabel: null as string | null };
    const p = riskAppetiteToPercent(projectContext.riskAppetite);
    const cost = cdfData?.length ? costAtPercentile(cdfData, p) ?? null : null;
    return { targetPCost: cost, targetPNumeric: p, targetPLabel: projectContext.riskAppetite };
  }, [projectContext, cdfData]);

  /** Current contingency fund as cost and its P value on the cost CDF (for chart reference line). CDF costs are in raw (base) units; contingencyValue_m is in millions, so convert to base. */
  const { contingencyCost, contingencyPLabel } = useMemo(() => {
    if (!projectContext || !cdfData?.length) return { contingencyCost: null as number | null, contingencyPLabel: null as string | null };
    const contingencyMillions = projectContext.contingencyValue_m ?? 0;
    if (!Number.isFinite(contingencyMillions) || contingencyMillions <= 0) return { contingencyCost: null as number | null, contingencyPLabel: null as string | null };
    const contingencyBase = contingencyMillions * 1e6;
    if (!Number.isFinite(contingencyBase) || contingencyBase <= 0) return { contingencyCost: null as number | null, contingencyPLabel: null as string | null };
    const p = percentileAtCost(cdfData, contingencyBase);
    if (p == null || !Number.isFinite(p)) return { contingencyCost: contingencyBase, contingencyPLabel: "—" };
    return { contingencyCost: contingencyBase, contingencyPLabel: `P${Math.round(p)}` };
  }, [projectContext, cdfData]);

  const hasData = neutralSummary != null;

  return (
    <main className="p-6">
      {/* A) Header row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold m-0 text-[var(--foreground)]">Analysis</h1>
          <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
            Decision-grade summary and diagnostics.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={async () => {
            const result = await runSimulation(10000);
            if (!result.ran && result.blockReason === "invalid") {
              setRunBlockedInvalidCount(result.invalidCount);
            }
          }}
          disabled={hasDraftRisks || invalidRunnableCount > 0}
          className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Run Simulation
        </button>
        <button
          type="button"
          onClick={clearSimulationHistory}
          className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
        >
          Clear History
        </button>
        {hasDraftRisks && (
          <p className="text-sm text-amber-600 dark:text-amber-400" role="status">
            Review and save all draft risks in the Risk Register before running simulation.
          </p>
        )}
        {invalidRunnableCount > 0 && (
          <p className="text-sm text-amber-600 dark:text-amber-400" role="status">
            Fix {invalidRunnableCount} risk{invalidRunnableCount !== 1 ? "s" : ""} to run simulation.
          </p>
        )}
        {runBlockedInvalidCount != null && runBlockedInvalidCount > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium" role="alert">
            Simulation blocked: fix {runBlockedInvalidCount} risk{runBlockedInvalidCount !== 1 ? "s" : ""} to run simulation.
          </p>
        )}
      </div>

      {!hasData && (
        <div className="mt-8 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-6 text-center">
          <p className="text-[var(--foreground)] font-medium m-0">
            No simulation results yet. Run a simulation to populate Analysis.
          </p>
          {isDebug && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 m-0">
              Neutral snapshot missing or store not hydrated.
            </p>
          )}
          <button
            type="button"
            onClick={async () => {
              const result = await runSimulation(10000);
              if (!result.ran && result.blockReason === "invalid") {
                setRunBlockedInvalidCount(result.invalidCount);
              }
            }}
            disabled={hasDraftRisks || invalidRunnableCount > 0}
            className="mt-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            Run simulation
          </button>
        </div>
      )}

      {hasData && (
        <>
          {/* B) Tile grid */}
          <section className="mt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <MetricTile
                label="Baseline P20 (Neutral)"
                value={formatCost(neutralSummary!.p20Cost)}
                helper="20th percentile cost"
                showSource={isDebug}
                sourceLabel="source: neutral snapshot"
              />
              <MetricTile
                label="Baseline P50 (Neutral)"
                value={formatCost(neutralSummary!.p50Cost)}
                helper="Median cost, neutral scenario"
                showSource={isDebug}
                sourceLabel="source: neutral snapshot"
              />
              <MetricTile
                label="Baseline P80 (Neutral)"
                value={formatCost(neutralSummary!.p80Cost)}
                helper="80th percentile cost"
                showSource={isDebug}
                sourceLabel="source: neutral snapshot"
              />
              <MetricTile
                label="Baseline P90 (Neutral)"
                value={formatCost(neutralSummary!.p90Cost)}
                helper="90th percentile cost"
                showSource={isDebug}
                sourceLabel="source: neutral snapshot"
              />
              <MetricTile
                label="Expected Cost (Mean)"
                value={formatCost(neutralSummary!.totalExpectedCost)}
                helper="Probability-weighted mean"
                showSource={isDebug}
                sourceLabel="source: neutral snapshot"
              />
              {[
                { label: "Schedule (P20)", valueFieldName: "p20Time", rawDays: neutralSummary!.p20Time, helper: "20th percentile duration" },
                { label: "Schedule (P50)", valueFieldName: "p50Time", rawDays: neutralSummary!.p50Time, helper: "50th percentile duration" },
                { label: "Schedule (P80)", valueFieldName: "p80Time", rawDays: neutralSummary!.p80Time, helper: "80th percentile duration" },
                { label: "Schedule (P90)", valueFieldName: "p90Time", rawDays: neutralSummary!.p90Time, helper: "90th percentile duration" },
              ].map(({ label, rawDays, helper }) => (
                <MetricTile
                  key={label}
                  label={label}
                  value={formatDurationDays(rawDays)}
                  helper={helper}
                  showSource={isDebug}
                  sourceLabel="neutral.summary"
                />
              ))}
              <MetricTile
                label="Top Risk Driver"
                value={topDriver ?? "—"}
                helper="Highest impact risk"
                showSource={isDebug}
                sourceLabel={topDriver ? "source: neutral snapshot" : undefined}
              />
              <MetricTile
                label="Mitigation ROI (Top)"
                value={topMitigation?.roi ?? "—"}
                helper="Best mitigation return"
                showSource={isDebug}
                sourceLabel={topMitigation ? "source: mitigation API" : undefined}
              />
              <MetricTile
                label="Contingency Sufficiency"
                value={contingencySufficiency}
                helper={`Contingency − cost at ${targetPLabel ?? "nominated P"} (surplus/shortfall)`}
                showSource={isDebug}
                sourceLabel={contingencySufficiency !== "—" ? "source: settings + neutral" : undefined}
              />
              <MetricTile
                label="Model Status"
                value={modelStatus.status}
                helper={modelStatus.reason}
                showSource={isDebug}
                sourceLabel="source: neutral snapshot"
              />
            </div>
          </section>

          {/* C) Project Risk Position */}
          <section className="mt-8">
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
              <h2 className="text-base font-semibold text-[var(--foreground)] px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 m-0">
                Project Risk Position
              </h2>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <CostDistributionChart
                  distribution={distribution}
                  samples={samples ?? null}
                  isDerived={isDerived}
                  isDebug={isDebug}
                  iterationCount={
                    samples && samples.length > 0
                      ? samples.length
                      : (simulation.neutral?.iterationCount ?? 1)
                  }
                  targetPNumeric={targetPNumeric}
                  targetPLabel={targetPLabel}
                />
                <TimeDistributionChart
                  distribution={timeDistribution}
                  samples={timeSamples ?? null}
                  isDerived={timeIsDerived}
                  isDebug={isDebug}
                  iterationCount={
                    timeSamples && timeSamples.length > 0
                      ? timeSamples.length
                      : (simulation.neutral?.iterationCount ?? 1)
                  }
                />
                <div className="md:col-span-2">
                  <CumulativeProbabilityChart
                    cdfData={cdfData}
                    p50Cost={neutralSummary!.p50Cost}
                    p80Cost={neutralSummary!.p80Cost}
                    isDerived={isDerived}
                    isDebug={isDebug}
                    targetPCost={targetPCost}
                    targetPLabel={targetPLabel}
                    contingencyCost={contingencyCost}
                    contingencyPLabel={contingencyPLabel}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* D) Mitigation Decisions */}
          <section className="mt-8">
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
              <h2 className="text-base font-semibold text-[var(--foreground)] px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 m-0">
                Mitigation Decisions
              </h2>
              <div className="p-4 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">
                        Rank
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">
                        Mitigation
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">
                        Cost Band
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">
                        Benefit
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">
                        ROI
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {MITIGATION_ROWS_PLACEHOLDER.map((row) => (
                      <tr
                        key={row.rank}
                        className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                      >
                        <td className="py-2.5 px-3 text-[var(--foreground)]">{row.rank}</td>
                        <td className="py-2.5 px-3 text-[var(--foreground)]">{row.mitigation}</td>
                        <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                          {row.costBand}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                          {row.benefit}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[var(--foreground)]">{row.roi}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* E) Debug-only: Simulation Diagnostics */}
          {isDebug && (
            <section className="mt-8">
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
                <h2 className="text-base font-semibold text-[var(--foreground)] px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 m-0">
                  Simulation Diagnostics
                </h2>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PlaceholderChart label="Scenario Comparison (placeholder)" />
                  <PlaceholderChart label="Forecast / Momentum (placeholder)" />
                </div>
              </div>
            </section>
          )}

          {/* E) Debug-only: Engine Health */}
          {isDebug && (
            <section className="mt-8">
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
                <h2 className="text-base font-semibold text-[var(--foreground)] px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 m-0">
                  Engine Health
                </h2>
                <div className="p-4">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {Object.entries(engineHealth).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <dt className="font-mono text-neutral-500 dark:text-neutral-400 shrink-0">
                          {key}:
                        </dt>
                        <dd className="font-mono text-[var(--foreground)] truncate" title={value}>
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </section>
          )}

          {/* Parity Audit (dev): side-by-side Outputs vs Analysis raw values */}
          {isDebug && <ParityAuditPanel />}

          {/* F) Debug-only: Math Audit — data lineage and inputs used for Cost + Programme */}
          {isDebug && analysisAudit && (
            <section className="mt-8">
              <details className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden group">
                <summary className="list-none px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 cursor-pointer font-semibold text-[var(--foreground)] hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <span className="select-none">Math Audit</span>
                  <span className="ml-2 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    risks included: {analysisAudit.risksIncluded} · excluded (Closed): {analysisAudit.risksExcludedClosed} · post: {analysisAudit.usingPostMitigation} · pre: {analysisAudit.usingPreMitigation}
                  </span>
                </summary>
                <div className="p-4 space-y-4 text-sm">
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                    <div>
                      <dt className="text-neutral-500 dark:text-neutral-400">Risks included</dt>
                      <dd className="font-mono font-medium">{analysisAudit.risksIncluded}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500 dark:text-neutral-400">Excluded (Closed)</dt>
                      <dd className="font-mono font-medium">{analysisAudit.risksExcludedClosed}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500 dark:text-neutral-400">Using post-mitigation</dt>
                      <dd className="font-mono font-medium">{analysisAudit.usingPostMitigation}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500 dark:text-neutral-400">Fallback pre-mitigation</dt>
                      <dd className="font-mono font-medium">{analysisAudit.usingPreMitigation}</dd>
                    </div>
                  </dl>
                  {analysisAudit.first5.length > 0 && (
                    <>
                      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                        First 5 included risks
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-neutral-200 dark:border-neutral-700">
                              <th className="text-left py-1.5 px-2 font-medium">Risk</th>
                              <th className="text-left py-1.5 px-2 font-medium">Probability</th>
                              <th className="text-left py-1.5 px-2 font-medium">Cost impact</th>
                              <th className="text-left py-1.5 px-2 font-medium">Time impact (days)</th>
                              <th className="text-left py-1.5 px-2 font-medium">Source</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysisAudit.first5.map((row) => (
                              <tr key={row.riskId} className="border-b border-neutral-100 dark:border-neutral-800">
                                <td className="py-1.5 px-2 font-mono truncate max-w-[120px]" title={row.title}>
                                  {row.title || row.riskId}
                                </td>
                                <td className="py-1.5 px-2 font-mono">{row.chosenProbability.toFixed(3)}</td>
                                <td className="py-1.5 px-2 font-mono">{row.chosenCostImpact.toLocaleString()}</td>
                                <td className="py-1.5 px-2 font-mono">{row.chosenTimeImpact}</td>
                                <td className="py-1.5 px-2 font-mono">{row.sourceUsed}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 italic">{analysisAudit.first5[0]?.units ?? "cost: AUD, time: days"}</p>
                    </>
                  )}
                  {(analysisAudit.costPercentiles != null || analysisAudit.programmePercentiles != null) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                      {analysisAudit.costPercentiles && (
                        <div>
                          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">Cost percentiles (from combined distribution)</p>
                          <p className="font-mono text-[var(--foreground)]">
                            P20: {formatCost(analysisAudit.costPercentiles.p20)} · P50: {formatCost(analysisAudit.costPercentiles.p50)} · P80: {formatCost(analysisAudit.costPercentiles.p80)} · P90: {formatCost(analysisAudit.costPercentiles.p90)}
                          </p>
                        </div>
                      )}
                      {analysisAudit.programmePercentiles && (
                        <div>
                          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">Programme percentiles (from combined distribution, same formatter as tiles)</p>
                          <p className="font-mono text-[var(--foreground)]">
                            P20: {formatDurationDays(analysisAudit.programmePercentiles.p20)} · P50: {formatDurationDays(analysisAudit.programmePercentiles.p50)} · P80: {formatDurationDays(analysisAudit.programmePercentiles.p80)} · P90: {formatDurationDays(analysisAudit.programmePercentiles.p90)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </details>
            </section>
          )}
        </>
      )}
    </main>
  );
}
