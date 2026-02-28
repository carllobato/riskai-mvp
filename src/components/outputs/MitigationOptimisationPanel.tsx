"use client";

import { useCallback, useEffect, useState } from "react";

type RankedRow = {
  riskId: string;
  riskName: string;
  bestROIBand: { from: number; to: number };
  topBandBenefitPerDollar: number;
  explanation: string;
};

type ApiResult = {
  baseline: { neutralP80: number };
  ranked: RankedRow[];
  meta?: { spendStepsUsed?: number[]; metricUsed?: string };
};

const DEFAULT_BODY = {
  spendSteps: [0, 25_000, 50_000, 100_000, 200_000],
  benefitMetric: "p80CostReduction" as const,
};

function formatCost(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatBand(band: { from: number; to: number }): string {
  return `${formatCost(band.from)} – ${formatCost(band.to)}`;
}

export function MitigationOptimisationPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResult | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mitigation-optimisation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEFAULT_BODY),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? `HTTP ${res.status}`);
        setData(null);
        return;
      }
      if (json && typeof json.baseline === "object" && Array.isArray(json.ranked)) {
        setData(json as ApiResult);
      } else {
        setError("Invalid response shape");
        setData(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Wait for store sync (300ms debounce) to complete before first fetch so API sees current context.
  useEffect(() => {
    const t = setTimeout(() => {
      fetchData();
    }, 400);
    return () => clearTimeout(t);
  }, [fetchData]);

  if (loading && !data) {
    return (
      <section className="mt-6 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 overflow-hidden">
        <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-200 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 m-0">
          Project P80 improvement per $
        </h2>
        <div className="p-4">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading mitigation leverage…</p>
        </div>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="mt-6 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 overflow-hidden">
        <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-200 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 m-0">
          Project P80 improvement per $
        </h2>
        <div className="p-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (!data) return null;

  return (
    <section className="mt-6 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 overflow-hidden">
      <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-200 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 m-0">
        Project P80 improvement per $
      </h2>
      <div className="p-4">
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
          Baseline (Neutral) P80 and ranked mitigation leverage by benefit per dollar.
        </p>
        <div className="mb-4">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Baseline (Neutral) P80</span>
          <div className="mt-0.5 text-lg font-semibold text-neutral-800 dark:text-neutral-200">
            {formatCost(data.baseline.neutralP80)}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-600">
                <th className="text-left py-2 px-2 font-medium text-neutral-600 dark:text-neutral-300">#</th>
                <th className="text-left py-2 px-2 font-medium text-neutral-600 dark:text-neutral-300">Risk</th>
                <th className="text-left py-2 px-2 font-medium text-neutral-600 dark:text-neutral-300">Best ROI band</th>
                <th className="text-right py-2 px-2 font-medium text-neutral-600 dark:text-neutral-300">Benefit per $</th>
                <th className="text-left py-2 px-2 font-medium text-neutral-600 dark:text-neutral-300">Explanation</th>
              </tr>
            </thead>
            <tbody>
              {data.ranked.map((row, i) => (
                <tr key={row.riskId} className="border-b border-neutral-100 dark:border-neutral-700/50">
                  <td className="py-2 px-2 text-neutral-600 dark:text-neutral-400">{i + 1}</td>
                  <td className="py-2 px-2 text-neutral-800 dark:text-neutral-200">{row.riskName}</td>
                  <td className="py-2 px-2 text-neutral-700 dark:text-neutral-300">{formatBand(row.bestROIBand)}</td>
                  <td className="py-2 px-2 text-right font-medium text-neutral-800 dark:text-neutral-200">
                    {row.topBandBenefitPerDollar.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-neutral-600 dark:text-neutral-400 max-w-xs truncate" title={row.explanation}>
                    {row.explanation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
