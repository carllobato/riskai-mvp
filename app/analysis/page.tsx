"use client";

import React, { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
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

/** Fixed set of percentile markers (P10–P90) shown on the CDF chart. */
const CDF_PERCENTILE_MARKERS = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;

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

function CostDistributionChart({
  distribution,
  isDerived,
  isDebug,
}: {
  distribution: DistributionPoint[] | null;
  isDerived?: boolean;
  isDebug?: boolean;
}) {
  const empty = !distribution || distribution.length === 0;
  const sortedHistogramData = useMemo(
    () => (distribution ? [...distribution].sort((a, b) => a.cost - b.cost) : []),
    [distribution]
  );
  const smoothedHistogramData = useMemo(
    () => smoothMovingAverage(sortedHistogramData, 3),
    [sortedHistogramData]
  );
  const subtitle = empty
    ? null
    : isDerived && isDebug
      ? "Derived from percentiles (no raw samples stored)"
      : isDerived
        ? "Derived from percentiles"
        : "Monte Carlo Simulation";
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
        <h3 className="text-base font-semibold text-[var(--foreground)] m-0">Cost Distribution</h3>
        {subtitle && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 m-0">{subtitle}</p>
        )}
        {!empty && isDebug && (
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 m-0 italic">
            Smoothed (moving average, window=3)
          </p>
        )}
      </div>
      <div className="p-4 w-full text-[var(--foreground)]" style={{ height: 300 }}>
        {empty ? (
          <div className="h-full flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
            No data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={smoothedHistogramData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" vertical={true} horizontal={true} />
              <XAxis
                dataKey="cost"
                tickFormatter={(v) =>
                  new Intl.NumberFormat("en-AU", {
                    style: "currency",
                    currency: "AUD",
                    maximumFractionDigits: 0,
                  }).format(Number(v))
                }
                tick={{ fontSize: 11, fill: "var(--foreground)" }}
                stroke="var(--foreground)"
                strokeOpacity={0.5}
                axisLine={{ stroke: "rgba(0,0,0,0.1)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--foreground)" }}
                stroke="var(--foreground)"
                strokeOpacity={0.5}
                axisLine={{ stroke: "rgba(0,0,0,0.1)" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--background)",
                  border: "1px solid rgba(75, 192, 192, 0.5)",
                  borderRadius: 8,
                  color: "var(--foreground)",
                }}
                labelFormatter={(label) =>
                  new Intl.NumberFormat("en-AU", {
                    style: "currency",
                    currency: "AUD",
                    maximumFractionDigits: 0,
                  }).format(Number(label))
                }
                formatter={(value) => [Math.round(Number(value)), "Frequency"]}
              />
              <Line
                dataKey="frequency"
                type="monotone"
                dot={false}
                stroke="rgb(75, 192, 192)"
                strokeWidth={3}
                fill="rgba(75, 192, 192, 0.1)"
                fillOpacity={1}
                isAnimationActive={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

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
        {subtitle && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 m-0">{subtitle}</p>
        )}
      </div>
      <div className="p-4 w-full text-[var(--foreground)]" style={{ height: 300 }}>
        {empty ? (
          <div className="h-full flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
            No data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={cdfData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" vertical={true} horizontal={true} />
              <XAxis
                dataKey="cost"
                tickFormatter={(v) => formatCost(v)}
                tick={{ fontSize: 11, fill: "var(--foreground)" }}
                stroke="var(--foreground)"
                strokeOpacity={0.5}
                axisLine={{ stroke: "rgba(0,0,0,0.1)" }}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: "var(--foreground)" }}
                stroke="var(--foreground)"
                strokeOpacity={0.5}
                axisLine={{ stroke: "rgba(0,0,0,0.1)" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--background)",
                  border: "1px solid rgba(54, 162, 235, 0.5)",
                  borderRadius: 8,
                  color: "var(--foreground)",
                }}
                formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, "Cumulative %"]}
                labelFormatter={(label) => formatCost(Number(label))}
              />
              <Line
                type="monotone"
                dataKey="cumulativePct"
                stroke="rgb(54, 162, 235)"
                strokeWidth={3}
                fill="rgba(54, 162, 235, 0.1)"
                fillOpacity={1}
                dot={false}
                isAnimationActive={true}
                connectNulls
              />
              {/* Constant horizontal reference lines at each percentile (P10–P90) */}
              {CDF_PERCENTILE_MARKERS.map((pct) => (
                <ReferenceLine
                  key={`h-${pct}`}
                  y={pct}
                  stroke="var(--foreground)"
                  strokeOpacity={0.2}
                  strokeDasharray="2 2"
                  label={{ value: `P${pct}`, position: "right", fontSize: 9, fill: "var(--foreground)" }}
                />
              ))}
              {/* Vertical line + dot at cost for each percentile (intersection with CDF) */}
              {CDF_PERCENTILE_MARKERS.map((pct) => {
                const cost = costAtPercentile(cdfData, pct);
                if (cost == null) return null;
                return (
                  <React.Fragment key={`v-${pct}`}>
                    <ReferenceLine
                      x={cost}
                      stroke="var(--foreground)"
                      strokeOpacity={0.4}
                      strokeDasharray="4 2"
                    />
                    <ReferenceDot
                      x={cost}
                      y={pct}
                      r={4}
                      fill="rgb(54, 162, 235)"
                      stroke="var(--background)"
                      strokeWidth={1.5}
                    />
                  </React.Fragment>
                );
              })}
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
          onClick={() => runSimulation(isDebug ? 1000 : 100)}
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
            onClick={() => runSimulation(isDebug ? 1000 : 100)}
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
                label="Expected Cost (Mean)"
                value={formatCost(neutralSummary!.totalExpectedCost)}
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
                  isDerived={isDerived}
                  isDebug={isDebug}
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
