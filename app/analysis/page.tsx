"use client";

import React, { useMemo } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useProjectionScenario } from "@/context/ProjectionScenarioContext";
import type { UiMode } from "@/lib/debugGating";
import { useRiskRegister } from "@/store/risk-register.store";
import {
  getNeutralSummary,
  getNeutralSamples,
  getTopRiskDriver,
  getTopMitigation,
  getModelStatus,
  getEngineHealth,
  type NeutralSummary,
} from "@/store/selectors";
import { loadProjectContext } from "@/lib/projectContext";

// --- Chart data types ---
type DistributionPoint = { cost: number; frequency: number };
type CdfPoint = { cost: number; cumulativePct: number };

// --- Chart styling helpers (theme-safe, board-ready) ---
const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${Math.round(n)}%`;

/** Nice tick step for distribution Y-axis based on max frequency (handles small values e.g. 0.5, 1, 2). */
function niceTickStep(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const scaled = max / pow; // 1..10
  let stepScaled = 1;
  if (scaled <= 2) stepScaled = 0.5;
  else if (scaled <= 5) stepScaled = 1;
  else stepScaled = 2;
  return stepScaled * pow;
}

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

/** Light smoothing via simple moving average; keeps cost, smooths frequency. */
function smoothMovingAverage(
  data: DistributionPoint[],
  windowSize: number = 3
): DistributionPoint[] {
  if (data.length === 0) return [];
  const half = Math.floor(windowSize / 2);
  return data.map((point, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(data.length - 1, i + half);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      sum += data[j].frequency;
      count++;
    }
    const averagedFrequency = count > 0 ? sum / count : point.frequency;
    return { cost: point.cost, frequency: averagedFrequency };
  });
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
const P10_DECILES = [10, 20, 30, 40, 50, 60, 70, 80, 90];

/** Stable empty array for when samples is null; avoids new reference every render so useMemo deps don't churn. */
const EMPTY_SAMPLES: number[] = [];

function CostDistributionChart({
  distribution,
  samples,
  isDerived,
  isDebug,
  iterationCount,
}: {
  distribution: DistributionPoint[] | null;
  samples: number[] | null;
  isDerived?: boolean;
  isDebug?: boolean;
  iterationCount: number;
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
        {!empty && subtitle && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 m-0">
            {subtitle}
          </p>
        )}
        {!empty && !isDebug && (
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 m-0">
            Bars = histogram, line = smoothed
          </p>
        )}
        {!empty && isDebug && (
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 m-0 italic">
            Smoothed display (moving average window=3). Raw samples preserved.
          </p>
        )}
        {!empty && isDebug && (
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 m-0">
            Deciles shown: P10..P90 (labels: P50/P80)
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
            <ComposedChart data={smoothData} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.2} />
              <XAxis
                dataKey="cost"
                domain={[0, "auto"]}
                tickFormatter={(v) => fmtMoney(Number(v))}
                interval="preserveStartEnd"
                minTickGap={40}
                tickMargin={10}
                tick={{ fontSize: 11, fill: "var(--foreground)" }}
                axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.3 }}
                tickLine={{ stroke: "var(--foreground)", strokeOpacity: 0.3 }}
              />
              <YAxis
                domain={[0, yMax]}
                ticks={yTicks}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: "var(--foreground)" }}
                axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.3 }}
                tickLine={{ stroke: "var(--foreground)", strokeOpacity: 0.3 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--background)",
                  border: "1px solid var(--foreground)",
                  borderRadius: 8,
                  color: "var(--foreground)",
                }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length || label == null) return null;
                  const bar = payload.find((p) => p.dataKey === "barPct");
                  const smooth = payload.find((p) => p.dataKey === "smoothPct");
                  const barVal = bar?.value != null ? Number(bar.value).toFixed(1) : "—";
                  const smoothVal = smooth?.value != null ? Number(smooth.value).toFixed(1) : "—";
                  return (
                    <div className="px-2.5 py-2 text-sm space-y-1">
                      <div className="font-medium">{fmtMoney(Number(label))}</div>
                      <div className="text-neutral-500 dark:text-neutral-400">
                        Histogram: {barVal}%
                      </div>
                      <div className="text-neutral-500 dark:text-neutral-400">
                        Smoothed: {smoothVal}%
                      </div>
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
                isAnimationActive={false}
              />
              {deciles.map((d) => (
                <ReferenceLine
                  key={d.p}
                  x={d.x}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  strokeOpacity={0.65}
                  label={
                    d.p === 50 || d.p === 80
                      ? {
                          value: `P${d.p}`,
                          position: "insideTop",
                          fontSize: 12,
                          fontWeight: 500,
                          fill: "var(--foreground)",
                        }
                      : undefined
                  }
                />
              ))}
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
}: {
  cdfData: CdfPoint[] | null;
  p50Cost: number | undefined;
  p80Cost: number | undefined;
  isDerived?: boolean;
  isDebug?: boolean;
}) {
  const empty = !cdfData || cdfData.length === 0;
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
        {!empty && subtitle && (
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
            <LineChart data={cdfData} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.2} />
              <XAxis
                dataKey="cost"
                tickFormatter={(v) => fmtMoney(Number(v))}
                interval="preserveStartEnd"
                tick={{ fontSize: 11, fill: "var(--foreground)" }}
                axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.3 }}
                tickLine={{ stroke: "var(--foreground)", strokeOpacity: 0.3 }}
              />
              <YAxis
                domain={[0, 100]}
                ticks={CDF_Y_TICKS}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: "var(--foreground)" }}
                axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.3 }}
                tickLine={{ stroke: "var(--foreground)", strokeOpacity: 0.3 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--background)",
                  border: "1px solid var(--foreground)",
                  borderRadius: 8,
                  color: "var(--foreground)",
                }}
                labelFormatter={(label) => fmtMoney(Number(label))}
                formatter={(value: number | undefined) => [fmtPct(value ?? 0), "Cumulative %"]}
              />
              <Line
                type="monotone"
                dataKey="cumulativePct"
                stroke="currentColor"
                strokeWidth={2}
                dot={false}
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

function formatScheduleP80(days: number | undefined): string {
  if (days == null || !Number.isFinite(days)) return "—";
  if (days >= 7) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days)} days`;
}

export default function AnalysisPage() {
  const { uiMode, setUiMode } = useProjectionScenario();
  const isDebug = uiMode === "Debug";
  const { risks, simulation, runSimulation, clearSimulationHistory, hasDraftRisks } = useRiskRegister();

  const analysisState = useMemo(
    () => ({ risks, simulation: { ...simulation } }),
    [risks, simulation]
  );

  const neutralSummary = useMemo(() => getNeutralSummary(analysisState), [analysisState]);
  const samples = useMemo(() => getNeutralSamples(analysisState), [analysisState]);
  const topDriver = useMemo(() => getTopRiskDriver(analysisState), [analysisState]);
  const topMitigation = useMemo(() => getTopMitigation(analysisState), [analysisState]);
  const modelStatus = useMemo(() => getModelStatus(analysisState), [analysisState]);
  const engineHealth = useMemo(() => getEngineHealth(analysisState), [analysisState]);

  const projectContext = useMemo(() => loadProjectContext(), []);

  const contingencySufficiency = useMemo((): string => {
    if (!neutralSummary || !projectContext) return "—";
    const { p50Cost, p80Cost } = neutralSummary;
    const band = p80Cost - p50Cost;
    if (!Number.isFinite(band) || band <= 0) return "—";
    const contingencyDollars = (projectContext.contingencyValue_m ?? 0) * 1e6;
    if (!Number.isFinite(contingencyDollars) || contingencyDollars <= 0) return "—";
    const pct = (contingencyDollars / band) * 100;
    return `${Math.round(pct)}%`;
  }, [neutralSummary, projectContext]);

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
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-neutral-500 dark:text-neutral-400 text-xs select-none">View</span>
          <div
            className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-0.5"
            role="group"
            aria-label="Analysis view mode"
          >
            <button
              type="button"
              onClick={() => setUiMode("MVP" as UiMode)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                !isDebug
                  ? "bg-neutral-200 dark:bg-neutral-600 text-[var(--foreground)] shadow-sm"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)]"
              }`}
            >
              Final
            </button>
            <button
              type="button"
              onClick={() => setUiMode("Debug" as UiMode)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                isDebug
                  ? "bg-neutral-200 dark:bg-neutral-600 text-[var(--foreground)] shadow-sm"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)]"
              }`}
            >
              Debug
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => runSimulation(10000)}
          disabled={hasDraftRisks}
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
            onClick={() => runSimulation(10000)}
            className="mt-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
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
                label="Baseline P50 (Neutral)"
                value={fmtMoney(neutralSummary!.p50Cost)}
                helper="Median cost, neutral scenario"
                showSource={isDebug}
                sourceLabel="source: neutral snapshot"
              />
              <MetricTile
                label="Baseline P80 (Neutral)"
                value={fmtMoney(neutralSummary!.p80Cost)}
                helper="80th percentile cost"
                showSource={isDebug}
                sourceLabel="source: neutral snapshot"
              />
              <MetricTile
                label="Expected Cost (Mean)"
                value={fmtMoney(neutralSummary!.totalExpectedCost)}
                helper="Probability-weighted mean"
                showSource={isDebug}
                sourceLabel="source: neutral snapshot"
              />
              <MetricTile
                label="Schedule Risk (P80)"
                value={formatScheduleP80(neutralSummary!.p80Time)}
                helper="80th percentile duration"
                showSource={isDebug}
                sourceLabel="source: neutral snapshot"
              />
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
                helper="Coverage vs P80 exposure"
                showSource={isDebug}
                sourceLabel={contingencySufficiency !== "—" ? "source: project context + neutral" : undefined}
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
                />
                <CumulativeProbabilityChart
                  cdfData={cdfData}
                  p50Cost={neutralSummary!.p50Cost}
                  p80Cost={neutralSummary!.p80Cost}
                  isDerived={isDerived}
                  isDebug={isDebug}
                />
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
        </>
      )}
    </main>
  );
}
