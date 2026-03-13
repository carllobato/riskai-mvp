"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Area,
  ComposedChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LabelProps } from "recharts";
import {
  costAtPercentile,
  timeAtPercentile,
  percentileAtCost,
  percentileAtTime,
  binSamplesIntoHistogram,
  binSamplesIntoTimeHistogram,
  distributionToCostCdf,
  barDataToCostCdf,
  barDataToTimeCdf,
  percentileFromSorted,
  deriveCostHistogramFromPercentiles,
  deriveTimeHistogramFromPercentiles,
  P10_DECILES,
  type CostCdfPoint,
  type TimeCdfPoint,
  type DistributionPoint,
  type CostSummary,
  type TimeSummary,
} from "@/lib/simulationDisplayUtils";
import { formatDurationDays } from "@/lib/formatDuration";
import type { SimulationRiskSnapshot } from "@/domain/simulation/simulation.types";

const CHART_HEIGHT = 300;
const CHART_MARGIN = { top: 10, right: 16, left: 8, bottom: 28 };
const DISTRIBUTION_BIN_COUNT = 28;

/** Offset (px) to shift label left/right from the line so two labels on same row don't clash. */
const REF_LINE_LABEL_OFFSET_X = 8;

/** Renders reference line label at the bottom of the chart (below x-axis). Use offsetX to shift left (negative) or right (positive). */
function RefLineLabelBottom({
  value,
  fontWeight = 500,
  offsetX = 0,
  viewBox,
  x: lineXProp,
}: {
  value: string;
  viewBox?: LabelProps["viewBox"];
  x?: number;
  fontWeight?: number;
  /** Pixels to shift label from line: negative = left, positive = right. */
  offsetX?: number;
}) {
  // Recharts passes Cartesian or Polar viewBox; we only support Cartesian (x, y, width, height)
  if (!viewBox || !("width" in viewBox)) return null;
  const lineX = lineXProp ?? viewBox.x + viewBox.width / 2;
  const x = lineX + offsetX;
  const y = viewBox.y + viewBox.height + 14;
  return (
    <text
      x={x}
      y={y}
      textAnchor={offsetX < 0 ? "end" : offsetX > 0 ? "start" : "middle"}
      fontSize={12}
      fontWeight={fontWeight}
      fill="var(--foreground)"
    >
      {value}
    </text>
  );
}

function formatCost(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCostCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}m`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}k`;
  return formatCost(value);
}

function smoothBarPct(
  data: { cost: number; barPct: number }[],
  windowSize: number = 3
): { cost: number; barPct: number; smoothPct: number }[] {
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

export type SimulationSectionBaseline = {
  targetPNumeric: number;
  targetPLabel: string;
  /** For cost: approved budget in dollars. For time: planned duration in days. */
  approvedValue: number;
};

export type CostResults = {
  samples: number[] | null;
  summary: CostSummary | null;
  iterationCount: number;
  risks: SimulationRiskSnapshot[];
};

export type TimeResults = {
  samples: number[] | null;
  summary: TimeSummary | null;
  iterationCount: number;
  risks: SimulationRiskSnapshot[];
};

export type SimulationSectionProps = {
  title: "Cost Simulation" | "Schedule Simulation";
  mode: "cost" | "time";
  baseline: SimulationSectionBaseline;
  results: CostResults | TimeResults;
  isDebug?: boolean;
  /** Cost CDF for current P / delta (precomputed by page). */
  costCdf?: CostCdfPoint[] | null;
  /** Time CDF for current P / delta (precomputed by page). */
  timeCdf?: TimeCdfPoint[] | null;
  /** Label for "top 10" table when using proxy (e.g. "Top Cost Drivers (proxy)"). */
  tableSubtitle?: string | null;
  /** Format cost (dollars) for display in project unit (e.g. $m). If omitted, uses raw $ formatting. */
  formatCostValue?: (dollars: number) => string;
  /** For cost mode: contingency value in dollars. When provided, first tile = P at contingency; third tile = (cost at target P) − contingency. */
  contingencyValueDollars?: number | null;
  /** Optional href for "Target P-Value" / settings link (debug only). When provided, used instead of /project. */
  settingsHref?: string | null;
};

const RAG_RED = "#ef4444";
const RAG_GREEN = "#22c55e";
const RAG_AMBER = "#f59e0b";

function CostChart({
  results,
  targetPNumeric,
  targetPLabel,
  isDebug,
  currentPCost,
  currentPLabel,
  deltaToTargetP,
}: {
  results: CostResults;
  targetPNumeric: number;
  targetPLabel: string;
  isDebug?: boolean;
  /** Cost at current P (e.g. contingency); vertical line on chart. */
  currentPCost?: number | null;
  /** Label for current P line, e.g. "P33". */
  currentPLabel?: string | null;
  /** Delta to target P (cost); used for RAG fill between current and target lines. */
  deltaToTargetP?: number | null;
}) {
  const { samples, summary, iterationCount } = results;
  const costSamples = useMemo(() => samples ?? [], [samples]);
  const divisor = costSamples.length > 0 ? iterationCount : 1;

  const { smoothData, deciles } = useMemo(() => {
    let barData: { cost: number; barPct: number }[] = [];
    let dist: DistributionPoint[] = [];
    if (costSamples.length > 0) {
      dist = binSamplesIntoHistogram(costSamples, DISTRIBUTION_BIN_COUNT);
      barData = dist.map((b) => ({
        cost: b.cost,
        barPct: (Number(b.frequency) / divisor) * 100,
      }));
    } else if (summary) {
      dist = deriveCostHistogramFromPercentiles(summary, DISTRIBUTION_BIN_COUNT);
      const total = dist.reduce((s, d) => s + Number(d.frequency), 0);
      const div = total > 0 ? total : 1;
      barData = dist.map((d) => ({
        cost: d.cost,
        barPct: (Number(d.frequency) / div) * 100,
      }));
    }
    const smooth = smoothBarPct(barData, 3);
    const sorted = [...costSamples].sort((a, b) => a - b);
    const deciles =
      sorted.length > 0
        ? P10_DECILES.map((p) => ({ p, x: percentileFromSorted(sorted, p) }))
        : smooth.length > 0
          ? (() => {
              const c = barDataToCostCdf(smooth);
              return P10_DECILES.map((p) => ({
                p,
                x: costAtPercentile(c, p) ?? smooth[0]?.cost ?? 0,
              }));
            })()
          : [];
    const cdfFromDist = dist.length > 0 ? distributionToCostCdf(dist) : [];
    return { smoothData: smooth, deciles, cdf: cdfFromDist.length > 0 ? cdfFromDist : (smooth.length > 0 ? barDataToCostCdf(smooth) : []) };
  }, [costSamples, summary, divisor]);

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

  const targetLineX = useMemo(
    () => deciles.find((d) => d.p === targetPNumeric)?.x ?? null,
    [deciles, targetPNumeric]
  );

  /** RAG-colored band between current P and target P: gradient color and x bounds. Darker end toward target. */
  const ragBand = useMemo(() => {
    if (
      currentPCost == null ||
      !Number.isFinite(currentPCost) ||
      targetLineX == null ||
      !Number.isFinite(targetLineX) ||
      deltaToTargetP == null
    )
      return null;
    const x1 = Math.min(currentPCost, targetLineX);
    const x2 = Math.max(currentPCost, targetLineX);
    const color =
      deltaToTargetP > 0 ? RAG_RED : deltaToTargetP < 0 ? RAG_GREEN : RAG_AMBER;
    const targetAtLeft = targetLineX <= currentPCost;
    return { x1, x2, color, targetAtLeft };
  }, [currentPCost, targetLineX, deltaToTargetP]);

  /** Interpolate smoothPct at a given cost from chart data. */
  const interpolateSmoothPct = useMemo(() => {
    return (data: { cost: number; smoothPct?: number }[], cost: number): number => {
      if (data.length === 0) return 0;
      const sorted = [...data].sort((a, b) => a.cost - b.cost);
      if (cost <= sorted[0]!.cost) return sorted[0]!.smoothPct ?? 0;
      if (cost >= sorted[sorted.length - 1]!.cost) return sorted[sorted.length - 1]!.smoothPct ?? 0;
      let i = 0;
      while (i < sorted.length - 1 && sorted[i + 1]!.cost < cost) i++;
      const a = sorted[i]!;
      const b = sorted[i + 1]!;
      const t = (cost - a.cost) / (b.cost - a.cost);
      return (a.smoothPct ?? 0) + t * ((b.smoothPct ?? 0) - (a.smoothPct ?? 0));
    };
  }, []);

  /** Chart data with ragBandPct: fill only between current and target lines, up to the curve. */
  const chartDataWithRagBand = useMemo(() => {
    const interp = interpolateSmoothPct;
    if (!ragBand) {
      return chartData.map((p) => ({ ...p, ragBandPct: null as number | null }));
    }
    const { x1, x2 } = ragBand;
    const withBand = chartData.map((p) => ({
      ...p,
      ragBandPct: p.cost >= x1 && p.cost <= x2 ? (p.smoothPct ?? 0) : null as number | null,
    }));
    const hasCost = (c: number) => withBand.some((p) => Math.abs(p.cost - c) < 1e-6);
    const points: { cost: number; barPct: number; smoothPct: number; ragBandPct: number | null }[] = [...withBand];
    if (!hasCost(x1)) {
      points.push({ cost: x1, barPct: 0, smoothPct: interp(chartData, x1), ragBandPct: interp(chartData, x1) });
    }
    if (!hasCost(x2)) {
      points.push({ cost: x2, barPct: 0, smoothPct: interp(chartData, x2), ragBandPct: interp(chartData, x2) });
    }
    return points.sort((a, b) => a.cost - b.cost);
  }, [chartData, ragBand, interpolateSmoothPct]);

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

  const currentFundingCurvePoint = useMemo(() => {
    if (currentPCost == null || !Number.isFinite(currentPCost) || chartData.length === 0) return null;
    const sorted = [...chartData].sort((a, b) => a.cost - b.cost);
    const costMin = sorted[0]!.cost;
    const costMax = sorted[sorted.length - 1]!.cost;
    if (currentPCost < costMin || currentPCost > costMax) return null;
    const y = interpolateSmoothPct(chartData, currentPCost);
    return { x: currentPCost, y };
  }, [chartData, currentPCost, interpolateSmoothPct]);

  const targetLineCurveY = useMemo(() => {
    if (targetLineX == null || !Number.isFinite(targetLineX) || chartData.length === 0) return null;
    const crossing = decileCrossings.find((c) => c.p === targetPNumeric);
    if (crossing) return crossing.y;
    const sorted = [...chartData].sort((a, b) => a.cost - b.cost);
    const costMin = sorted[0]!.cost;
    const costMax = sorted[sorted.length - 1]!.cost;
    if (targetLineX < costMin || targetLineX > costMax) return null;
    return interpolateSmoothPct(chartData, targetLineX);
  }, [chartData, decileCrossings, targetLineX, targetPNumeric, interpolateSmoothPct]);

  const tooltipValidCosts = useMemo(() => {
    const costs = decileCrossings.map((c) => c.x);
    if (targetLineX != null && Number.isFinite(targetLineX)) costs.push(targetLineX);
    if (currentPCost != null && Number.isFinite(currentPCost)) costs.push(currentPCost);
    return costs;
  }, [decileCrossings, targetLineX, currentPCost]);

  const tooltipMarkers = useMemo(() => {
    const list: { pLabel: string; cost: number }[] = decileCrossings.map((c) => ({
      pLabel: `P${c.p}`,
      cost: c.x,
    }));
    if (targetLineX != null && Number.isFinite(targetLineX) && targetPLabel) {
      list.push({ pLabel: `Target (${targetPLabel})`, cost: targetLineX });
    }
    if (currentPCost != null && Number.isFinite(currentPCost) && currentPLabel) {
      list.push({ pLabel: currentPLabel ? `Current Funding Position (${currentPLabel})` : "Current Funding Position", cost: currentPCost });
    }
    return list;
  }, [decileCrossings, targetLineX, targetPLabel, currentPCost, currentPLabel]);

  const costRange = useMemo(() => {
    if (chartData.length === 0) return 1;
    const costs = chartData.map((d) => d.cost);
    return Math.max(1, Math.max(...costs) - Math.min(...costs));
  }, [chartData]);

  const xDomain = useMemo((): [number, number] => {
    if (chartData.length === 0 && deciles.length === 0) return [0, 1];
    const costMax = chartData.length > 0 ? Math.max(...chartData.map((d) => d.cost)) : 0;
    const p100Max = deciles.length > 0 ? Math.max(...deciles.map((d) => d.x)) : 0;
    return [0, Math.max(costMax, p100Max, 1)];
  }, [chartData, deciles]);

  const [activeCost, setActiveCost] = useState<number | null>(null);
  const activeCostTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (activeCostTimeoutRef.current) clearTimeout(activeCostTimeoutRef.current); }, []);

  const costMarkerProximity = useMemo(() => {
    const binWidth = costRange / DISTRIBUTION_BIN_COUNT;
    if (tooltipValidCosts.length < 2) return Math.max(costRange * 0.02, binWidth);
    const sorted = [...tooltipValidCosts].sort((a, b) => a - b);
    let minGap = costRange;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1]! - sorted[i]!;
      if (gap > 0) minGap = Math.min(minGap, gap);
    }
    return Math.max(minGap * 0.35, binWidth);
  }, [tooltipValidCosts, costRange]);

  /** Only deciles we actually render (exclude P100) — active index is over this list so hover near P100 highlights P90. */
  const decileCrossingsVisible = useMemo(
    () => decileCrossings.filter((c) => c.p !== 100),
    [decileCrossings]
  );

  const activeCostDotIndex = useMemo(() => {
    if (activeCost == null || decileCrossingsVisible.length === 0) return -1;
    if (currentPCost != null && Math.abs(activeCost - currentPCost) < 1e-9) return -1;
    if (targetLineX != null && Number.isFinite(targetLineX) && Math.abs(activeCost - targetLineX) < 1e-9) return -1;
    let bestIdx = 0;
    let bestDist = Math.abs(decileCrossingsVisible[0]!.x - activeCost);
    for (let i = 1; i < decileCrossingsVisible.length; i++) {
      const d = Math.abs(decileCrossingsVisible[i]!.x - activeCost);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [activeCost, decileCrossingsVisible, currentPCost, targetLineX]);

  const yMax = useMemo(() => {
    if (smoothData.length === 0) return 5;
    const maxPct = smoothData.reduce((m, d) => Math.max(m, d.barPct ?? 0, d.smoothPct ?? 0), 0);
    const step = maxPct <= 5 ? 0.5 : maxPct <= 10 ? 1 : 2;
    return Math.ceil(maxPct / step) * step;
  }, [smoothData]);

  const empty = smoothData.length === 0;

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
        <h3 className="text-base font-semibold text-[var(--foreground)] m-0">Cost Distribution</h3>
        {!empty && isDebug && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 m-0">
            {costSamples.length > 0
              ? `Monte Carlo (${iterationCount.toLocaleString()} iterations)`
              : "Derived from percentiles"}
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
            <ComposedChart data={chartDataWithRagBand} margin={CHART_MARGIN}>
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
              <YAxis hide domain={[0, yMax]} />
              <Tooltip
                cursor={false}
                offset={5}
                contentStyle={{
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: 8,
                  boxShadow: "none",
                  padding: 0,
                }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length || label == null) {
                    if (activeCostTimeoutRef.current) clearTimeout(activeCostTimeoutRef.current);
                    activeCostTimeoutRef.current = setTimeout(() => setActiveCost(null), 0);
                    return null;
                  }
                  if (tooltipMarkers.length === 0) {
                    if (activeCostTimeoutRef.current) clearTimeout(activeCostTimeoutRef.current);
                    activeCostTimeoutRef.current = setTimeout(() => setActiveCost(null), 0);
                    return null;
                  }
                  const cost = Number(label);
                  const closest = tooltipMarkers.reduce(
                    (best, m) => (Math.abs(cost - m.cost) < Math.abs(cost - best.cost) ? m : best),
                    tooltipMarkers[0]!
                  );
                  const distToMarker = Math.abs(cost - closest.cost);
                  if (distToMarker > costMarkerProximity) {
                    if (activeCostTimeoutRef.current) clearTimeout(activeCostTimeoutRef.current);
                    activeCostTimeoutRef.current = setTimeout(() => setActiveCost(null), 0);
                    return null;
                  }
                  if (activeCostTimeoutRef.current) clearTimeout(activeCostTimeoutRef.current);
                  activeCostTimeoutRef.current = setTimeout(() => setActiveCost(closest.cost), 0);
                  return (
                    <div className="px-2.5 py-2 text-sm space-y-1 rounded-lg border bg-white text-neutral-900 shadow-md dark:bg-black dark:text-white dark:border-white dark:shadow-none">
                      <div className="font-medium">{closest.pLabel}</div>
                      <div className="text-neutral-700 dark:text-neutral-300">{formatCostCompact(closest.cost)}</div>
                    </div>
                  );
                }}
              />
              <defs>
                <linearGradient id="simDistDepthCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="currentColor" stopOpacity={0.01} />
                </linearGradient>
                {ragBand && (
                  <linearGradient id="costChartRagFill" x1="0" y1="0" x2="1" y2="0">
                    {(() => {
                      const isGreen = ragBand.color === RAG_GREEN;
                      const darkerAtLeft = isGreen ? !ragBand.targetAtLeft : ragBand.targetAtLeft;
                      return darkerAtLeft ? (
                        <>
                          <stop offset="0%" stopColor={ragBand.color} stopOpacity={0.28} />
                          <stop offset="100%" stopColor={ragBand.color} stopOpacity={0.08} />
                        </>
                      ) : (
                        <>
                          <stop offset="0%" stopColor={ragBand.color} stopOpacity={0.08} />
                          <stop offset="100%" stopColor={ragBand.color} stopOpacity={0.28} />
                        </>
                      );
                    })()}
                  </linearGradient>
                )}
              </defs>
              <Area
                type="natural"
                dataKey="smoothPct"
                stroke="currentColor"
                strokeWidth={2}
                fill="url(#simDistDepthCost)"
                fillOpacity={1}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
              {ragBand && (
                <Area
                  type="natural"
                  dataKey="ragBandPct"
                  stroke="none"
                  fill="url(#costChartRagFill)"
                  fillOpacity={1}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              )}
              {decileCrossingsVisible.map((c) => {
                const activeP =
                  activeCostDotIndex >= 0 ? decileCrossingsVisible[activeCostDotIndex]?.p : undefined;
                const isActive = activeP != null && c.p === activeP;
                return (
                  <ReferenceDot
                    key={c.p}
                    x={c.x}
                    y={c.y}
                    r={isActive ? 5 : 3}
                    fill="var(--foreground)"
                    stroke="var(--background)"
                    strokeWidth={1.5}
                  />
                );
              })}
              {currentFundingCurvePoint && (
                <ReferenceDot
                  key="current-funding"
                  x={currentFundingCurvePoint.x}
                  y={currentFundingCurvePoint.y}
                  r={
                    activeCost != null &&
                    currentPCost != null &&
                    Math.abs(activeCost - currentPCost) < 1e-9
                      ? 5
                      : 3
                  }
                  fill="var(--foreground)"
                  stroke="var(--background)"
                  strokeWidth={1.5}
                />
              )}
              {targetLineX != null && Number.isFinite(targetLineX) && targetPLabel && (
                <ReferenceLine
                  segment={
                    targetLineCurveY != null
                      ? [{ x: targetLineX, y: 0 }, { x: targetLineX, y: targetLineCurveY }]
                      : undefined
                  }
                  x={targetLineCurveY == null ? targetLineX : undefined}
                  stroke="var(--foreground)"
                  strokeWidth={2}
                  strokeOpacity={0.9}
                  label={{
                    content: (p: LabelProps) => (
                      <RefLineLabelBottom
                        value={`Target (${targetPLabel})`}
                        fontWeight={500}
                        offsetX={deltaToTargetP != null && deltaToTargetP > 0 ? REF_LINE_LABEL_OFFSET_X : -REF_LINE_LABEL_OFFSET_X}
                        viewBox={p.viewBox}
                        x={p.x as number | undefined}
                      />
                    ),
                  }}
                />
              )}
              {currentPCost != null && Number.isFinite(currentPCost) && currentPLabel && (
                currentFundingCurvePoint ? (
                  <ReferenceLine
                    segment={[{ x: currentPCost, y: 0 }, { x: currentPCost, y: currentFundingCurvePoint.y }]}
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                    strokeOpacity={0.7}
                    strokeDasharray="4 4"
                    label={{
                      content: (p: LabelProps) => (
                        <RefLineLabelBottom
                          value={currentPLabel ? `Current Funding Position (${currentPLabel})` : "Current Funding Position"}
                          fontWeight={500}
                          offsetX={deltaToTargetP != null && deltaToTargetP > 0 ? -REF_LINE_LABEL_OFFSET_X : REF_LINE_LABEL_OFFSET_X}
                          viewBox={p.viewBox}
                          x={p.x as number | undefined}
                        />
                      ),
                    }}
                  />
                ) : (
                  <ReferenceLine
                    x={currentPCost}
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                    strokeOpacity={0.7}
                    strokeDasharray="4 4"
                    label={{
                      content: (p: LabelProps) => (
                        <RefLineLabelBottom
                          value={currentPLabel ? `Current Funding Position (${currentPLabel})` : "Current Funding Position"}
                          fontWeight={500}
                          offsetX={deltaToTargetP != null && deltaToTargetP > 0 ? -REF_LINE_LABEL_OFFSET_X : REF_LINE_LABEL_OFFSET_X}
                          viewBox={p.viewBox}
                          x={p.x as number | undefined}
                        />
                      ),
                    }}
                  />
                )
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function TimeChart({
  results,
  targetPNumeric,
  targetPLabel,
  isDebug,
}: {
  results: TimeResults;
  targetPNumeric: number;
  targetPLabel: string;
  isDebug?: boolean;
}) {
  const { samples, summary, iterationCount } = results;
  const timeSamples = useMemo(() => samples ?? [], [samples]);

  const { smoothData, deciles } = useMemo(() => {
    let barData: { time: number; barPct: number }[] = [];
    const divisor = timeSamples.length > 0 ? iterationCount : 1;
    if (timeSamples.length > 0) {
      const buckets = binSamplesIntoTimeHistogram(timeSamples, DISTRIBUTION_BIN_COUNT);
      barData = buckets.map((b) => ({
        time: b.time,
        barPct: (Number(b.frequency) / divisor) * 100,
      }));
    } else if (summary) {
      const dist = deriveTimeHistogramFromPercentiles(summary, DISTRIBUTION_BIN_COUNT);
      const total = dist.reduce((s, d) => s + Number(d.frequency), 0);
      const div = total > 0 ? total : 1;
      barData = dist.map((d) => ({
        time: d.time,
        barPct: (Number(d.frequency) / div) * 100,
      }));
    }
    const smooth = smoothBarPctTime(barData, 3);
    const sorted = [...timeSamples].sort((a, b) => a - b);
    const deciles =
      sorted.length > 0
        ? P10_DECILES.map((p) => ({ p, x: percentileFromSorted(sorted, p) }))
        : smooth.length > 0
          ? (() => {
              const c = barDataToTimeCdf(smooth);
              return P10_DECILES.map((p) => ({
                p,
                x: timeAtPercentile(c, p) ?? smooth[0]?.time ?? 0,
              }));
            })()
          : [];
    return { smoothData: smooth, deciles };
  }, [timeSamples, summary, iterationCount]);

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

  const targetLineX = useMemo(
    () => deciles.find((d) => d.p === targetPNumeric)?.x ?? null,
    [deciles, targetPNumeric]
  );

  const targetLineCurveY = useMemo(() => {
    const crossing = decileCrossings.find((c) => c.p === targetPNumeric);
    return crossing?.y ?? null;
  }, [decileCrossings, targetPNumeric]);

  const tooltipValidTimes = useMemo(() => {
    const times = decileCrossings.map((c) => c.x);
    if (targetLineX != null && Number.isFinite(targetLineX)) times.push(targetLineX);
    return times;
  }, [decileCrossings, targetLineX]);

  const tooltipMarkers = useMemo(() => {
    const list: { pLabel: string; time: number }[] = decileCrossings.map((c) => ({
      pLabel: `P${c.p}`,
      time: c.x,
    }));
    if (targetLineX != null && Number.isFinite(targetLineX) && targetPLabel) {
      list.push({ pLabel: `Target (${targetPLabel})`, time: targetLineX });
    }
    return list;
  }, [decileCrossings, targetLineX, targetPLabel]);

  const timeRange = useMemo(() => {
    if (chartData.length === 0) return 1;
    const times = chartData.map((d) => d.time);
    return Math.max(1, Math.max(...times) - Math.min(...times));
  }, [chartData]);

  const xDomain = useMemo((): [number, number] => {
    if (chartData.length === 0 && deciles.length === 0) return [0, 1];
    const timeMax = chartData.length > 0 ? Math.max(...chartData.map((d) => d.time)) : 0;
    const p100Max = deciles.length > 0 ? Math.max(...deciles.map((d) => d.x)) : 0;
    return [0, Math.max(timeMax, p100Max, 1)];
  }, [chartData, deciles]);

  const [activeTime, setActiveTime] = useState<number | null>(null);
  const activeTimeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (activeTimeTimeoutRef.current) clearTimeout(activeTimeTimeoutRef.current); }, []);

  const timeMarkerProximity = useMemo(() => {
    const binWidth = timeRange / DISTRIBUTION_BIN_COUNT;
    if (tooltipValidTimes.length < 2) return Math.max(timeRange * 0.02, binWidth);
    const sorted = [...tooltipValidTimes].sort((a, b) => a - b);
    let minGap = timeRange;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1]! - sorted[i]!;
      if (gap > 0) minGap = Math.min(minGap, gap);
    }
    return Math.max(minGap * 0.35, binWidth);
  }, [tooltipValidTimes, timeRange]);

  /** Only deciles we actually render (exclude P100) — active index is over this list so hover near P100 highlights P90. */
  const decileCrossingsVisible = useMemo(
    () => decileCrossings.filter((c) => c.p !== 100),
    [decileCrossings]
  );

  const activeTimeDotIndex = useMemo(() => {
    if (activeTime == null || decileCrossingsVisible.length === 0) return -1;
    if (targetLineX != null && Number.isFinite(targetLineX) && Math.abs(activeTime - targetLineX) < 1e-9) return -1;
    let bestIdx = 0;
    let bestDist = Math.abs(decileCrossingsVisible[0]!.x - activeTime);
    for (let i = 1; i < decileCrossingsVisible.length; i++) {
      const d = Math.abs(decileCrossingsVisible[i]!.x - activeTime);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [activeTime, decileCrossingsVisible, targetLineX]);

  const yMax = useMemo(() => {
    if (smoothData.length === 0) return 5;
    const maxPct = smoothData.reduce((m, d) => Math.max(m, d.barPct ?? 0, d.smoothPct ?? 0), 0);
    const step = maxPct <= 5 ? 0.5 : maxPct <= 10 ? 1 : 2;
    return Math.ceil(maxPct / step) * step;
  }, [smoothData]);

  const empty = smoothData.length === 0;

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
        <h3 className="text-base font-semibold text-[var(--foreground)] m-0">Time Distribution</h3>
        {!empty && isDebug && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 m-0">
            {timeSamples.length > 0
              ? `Monte Carlo (${iterationCount.toLocaleString()} iterations)`
              : "Derived from percentiles"}
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
              <YAxis hide domain={[0, yMax]} />
              <Tooltip
                cursor={false}
                offset={5}
                contentStyle={{
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: 8,
                  boxShadow: "none",
                  padding: 0,
                }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length || label == null) {
                    if (activeTimeTimeoutRef.current) clearTimeout(activeTimeTimeoutRef.current);
                    activeTimeTimeoutRef.current = setTimeout(() => setActiveTime(null), 0);
                    return null;
                  }
                  if (tooltipMarkers.length === 0) {
                    if (activeTimeTimeoutRef.current) clearTimeout(activeTimeTimeoutRef.current);
                    activeTimeTimeoutRef.current = setTimeout(() => setActiveTime(null), 0);
                    return null;
                  }
                  const time = Number(label);
                  const closest = tooltipMarkers.reduce(
                    (best, m) => (Math.abs(time - m.time) < Math.abs(time - best.time) ? m : best),
                    tooltipMarkers[0]!
                  );
                  const distToMarker = Math.abs(time - closest.time);
                  if (distToMarker > timeMarkerProximity) {
                    if (activeTimeTimeoutRef.current) clearTimeout(activeTimeTimeoutRef.current);
                    activeTimeTimeoutRef.current = setTimeout(() => setActiveTime(null), 0);
                    return null;
                  }
                  if (activeTimeTimeoutRef.current) clearTimeout(activeTimeTimeoutRef.current);
                  activeTimeTimeoutRef.current = setTimeout(() => setActiveTime(closest.time), 0);
                  return (
                    <div className="px-2.5 py-2 text-sm space-y-1 rounded-lg border bg-white text-neutral-900 shadow-md dark:bg-black dark:text-white dark:border-white dark:shadow-none">
                      <div className="font-medium">{closest.pLabel}</div>
                      <div className="text-neutral-700 dark:text-neutral-300">{formatDurationDays(closest.time)}</div>
                    </div>
                  );
                }}
              />
              <defs>
                <linearGradient id="simDistDepthTime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="currentColor" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <Area
                type="natural"
                dataKey="smoothPct"
                stroke="currentColor"
                strokeWidth={2}
                fill="url(#simDistDepthTime)"
                fillOpacity={1}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
              {decileCrossingsVisible.map((c) => {
                const activeP =
                  activeTimeDotIndex >= 0 ? decileCrossingsVisible[activeTimeDotIndex]?.p : undefined;
                const isActive = activeP != null && c.p === activeP;
                return (
                  <ReferenceDot
                    key={c.p}
                    x={c.x}
                    y={c.y}
                    r={isActive ? 5 : 3}
                    fill="var(--foreground)"
                    stroke="var(--background)"
                    strokeWidth={1.5}
                  />
                );
              })}
              {targetLineX != null && Number.isFinite(targetLineX) && targetPLabel && (
                <ReferenceLine
                  segment={
                    targetLineCurveY != null
                      ? [{ x: targetLineX, y: 0 }, { x: targetLineX, y: targetLineCurveY }]
                      : undefined
                  }
                  x={targetLineCurveY == null ? targetLineX : undefined}
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

export function SimulationSection(props: SimulationSectionProps) {
  const { title, mode, baseline, results, isDebug, costCdf, timeCdf, tableSubtitle, formatCostValue, contingencyValueDollars, settingsHref } = props;
  const { targetPNumeric, targetPLabel, approvedValue } = baseline;
  const formatCostDisplay = formatCostValue ?? formatCost;

  /** First tile: cost mode with contingency = P at contingency value; else P at approved budget. Time mode = P at planned duration. */
  const currentPValue = useMemo(() => {
    if (mode === "cost" && costCdf?.length) {
      const costValue = contingencyValueDollars != null && Number.isFinite(contingencyValueDollars)
        ? contingencyValueDollars
        : approvedValue;
      if (costValue <= 0) return null;
      const p = percentileAtCost(costCdf, costValue);
      return p != null ? Math.round(p) : null;
    }
    if (mode === "time" && timeCdf?.length) {
      if (approvedValue <= 0) return null;
      const p = percentileAtTime(timeCdf, approvedValue);
      return p != null ? Math.round(p) : null;
    }
    return null;
  }, [mode, costCdf, timeCdf, approvedValue, contingencyValueDollars]);

  /** Cost ($) or time (days) at the target P percentile. */
  const valueAtTargetP = useMemo(() => {
    if (mode === "cost" && costCdf?.length) {
      return costAtPercentile(costCdf, targetPNumeric);
    }
    if (mode === "time" && timeCdf?.length) {
      return timeAtPercentile(timeCdf, targetPNumeric);
    }
    return null;
  }, [mode, costCdf, timeCdf, targetPNumeric]);

  /** Delta to Target P-Value: target P value (sum) less current contingency. Cost mode only when contingency is set. */
  const deltaToTargetP = useMemo(() => {
    if (mode !== "cost" || valueAtTargetP == null || contingencyValueDollars == null || !Number.isFinite(contingencyValueDollars))
      return null;
    return valueAtTargetP - contingencyValueDollars;
  }, [mode, valueAtTargetP, contingencyValueDollars]);

  /** Cost at current P (for vertical line on cost chart). */
  const costAtCurrentP = useMemo(() => {
    if (mode !== "cost" || currentPValue == null || !costCdf?.length) return null;
    return costAtPercentile(costCdf, currentPValue);
  }, [mode, currentPValue, costCdf]);

  const costResults = mode === "cost" ? (results as CostResults) : null;
  const timeResults = mode === "time" ? (results as TimeResults) : null;

  const top10 = useMemo(() => {
    const r = mode === "cost" ? costResults : timeResults;
    if (!r?.risks?.length) return [];
    if (mode === "cost") {
      return [...r.risks].sort((a, b) => (b.simMeanCost ?? b.expectedCost) - (a.simMeanCost ?? a.expectedCost)).slice(0, 10);
    }
    return [...r.risks].sort((a, b) => (b.simMeanDays ?? b.expectedDays) - (a.simMeanDays ?? a.expectedDays)).slice(0, 10);
  }, [mode, costResults, timeResults]);

  const tableLabel = mode === "cost" ? "Top 10 Cost Risks" : "Top 10 Time Risks";
  const tableLabelDisplay = tableSubtitle ? `${tableLabel} (${tableSubtitle})` : tableLabel;

  return (
    <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 overflow-hidden">
      <h2 className="text-base font-semibold text-[var(--foreground)] px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 m-0">
        {title}
      </h2>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4 transition-colors hover:border-neutral-300 dark:hover:border-neutral-600">
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              {mode === "cost" ? "Current Funding Confidence" : "Current P-Value (Time)"}
            </div>
            <div className="mt-1 text-lg font-semibold text-[var(--foreground)]">
              {currentPValue != null ? `P${currentPValue}` : "—"}
            </div>
            {mode === "cost" && (
              <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                {contingencyValueDollars != null ? "Likelihood of delivery within current funding" : "Confidence at approved budget"}
              </div>
            )}
            {isDebug && mode === "time" && (
              <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                Confidence at planned duration
              </div>
            )}
          </div>
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4 transition-colors hover:border-neutral-300 dark:hover:border-neutral-600">
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Funding Position vs Target{mode === "cost" ? "" : " (Time)"}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-semibold text-[var(--foreground)]">
                {mode === "cost"
                  ? (deltaToTargetP != null
                      ? formatCostDisplay(Math.abs(deltaToTargetP))
                      : "—")
                  : (valueAtTargetP != null ? formatDurationDays(valueAtTargetP) : "—")}
              </span>
              {mode === "cost" && deltaToTargetP != null && (
                <span
                  className="shrink-0 w-2.5 h-2.5 rounded-full border border-neutral-300 dark:border-neutral-600"
                  title={deltaToTargetP > 0 ? "Shortfall" : deltaToTargetP < 0 ? "Headroom" : "On target"}
                  style={{
                    backgroundColor:
                      deltaToTargetP > 0
                        ? "var(--rag-red, #ef4444)"
                        : deltaToTargetP < 0
                          ? "var(--rag-green, #22c55e)"
                          : "var(--rag-amber, #f59e0b)",
                  }}
                  aria-hidden
                />
              )}
            </div>
            {mode === "cost" &&
            ((contingencyValueDollars != null && deltaToTargetP != null) ||
              (contingencyValueDollars != null && isDebug) ||
              (contingencyValueDollars == null && isDebug)) ? (
              <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                {contingencyValueDollars != null && deltaToTargetP != null ? (
                  deltaToTargetP > 0
                    ? `Below ${targetPLabel} Target`
                    : deltaToTargetP < 0
                      ? `Target ${targetPLabel} achieved`
                      : `Target ${targetPLabel} achieved`
                ) : contingencyValueDollars != null && isDebug ? (
                  <>
                    Contingency adjustment to achieve{" "}
                    <Link href={settingsHref ?? "/projects"} className="underline hover:text-neutral-700 dark:hover:text-neutral-300">
                      Target P-Value ({targetPLabel})
                    </Link>
                  </>
                ) : (
                  "Confidence at approved budget"
                )}
              </div>
            ) : null}
            {isDebug && mode === "time" && (
              <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                Time at target P percentile
              </div>
            )}
          </div>
        </div>

        {mode === "cost" && costResults && (
          <CostChart
            results={costResults}
            targetPNumeric={targetPNumeric}
            targetPLabel={targetPLabel}
            isDebug={isDebug}
            currentPCost={costAtCurrentP}
            currentPLabel={currentPValue != null ? `P${currentPValue}` : null}
            deltaToTargetP={deltaToTargetP}
          />
        )}
        {mode === "time" && timeResults && (
          <TimeChart
            results={timeResults}
            targetPNumeric={targetPNumeric}
            targetPLabel={targetPLabel}
            isDebug={isDebug}
          />
        )}

        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] overflow-hidden">
          <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-sm font-semibold text-[var(--foreground)] m-0">{tableLabelDisplay}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">#</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Risk</th>
                  {mode === "cost" ? (
                    <th className="text-right py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Cost impact</th>
                  ) : (
                    <th className="text-right py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Time impact (days)</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {top10.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 px-3 text-neutral-500 dark:text-neutral-400 text-center">
                      No risks in simulation
                    </td>
                  </tr>
                ) : (
                  top10.map((risk, i) => (
                    <tr
                      key={risk.id}
                      className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    >
                      <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">{i + 1}</td>
                      <td className="py-2.5 px-3 text-[var(--foreground)] truncate max-w-[200px]" title={risk.title}>
                        {risk.title}
                      </td>
                      {mode === "cost" ? (
                        <td className="py-2.5 px-3 text-right font-medium">
                          {formatCostDisplay(risk.simMeanCost ?? risk.expectedCost)}
                        </td>
                      ) : (
                        <td className="py-2.5 px-3 text-right font-medium">
                          {formatDurationDays(risk.simMeanDays ?? risk.expectedDays)}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
