"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { runAllChecks, type CheckStatus, type CheckGroup } from "@/dev/healthChecks";
import { buildIntrospectionPayload } from "@/dev/engineIntrospection";

type CheckResultRow = {
  group: CheckGroup;
  name: string;
  status: CheckStatus;
  message: string;
  details?: unknown;
};

const GROUPS: CheckGroup[] = [
  "Scenario Math",
  "Mitigation Logic",
  "Time Weighting",
  "Exposure Engine",
  "Governance Metrics",
  "UI Gating",
  "Lens Range Integrity",
  "Baseline Lock (Governance Integrity)",
];

const isDev = process.env.NODE_ENV === "development";
const PERF_WARN_MS = 100;

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "pass") return <span className="text-green-600 dark:text-green-400" aria-hidden>✅</span>;
  if (status === "warn") return <span className="text-amber-600 dark:text-amber-400" aria-hidden>⚠️</span>;
  return <span className="text-red-600 dark:text-red-400" aria-hidden>❌</span>;
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export default function DevHealthPage() {
  const [runResult, setRunResult] = useState<{ results: CheckResultRow[]; durationMs: number } | null>(null);
  const [strictMode, setStrictMode] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [introspectionPayload, setIntrospectionPayload] = useState<unknown>(null);

  const runChecks = useCallback(() => {
    if (!isDev) return;
    const out = runAllChecks();
    setRunResult({ results: out.results as CheckResultRow[], durationMs: out.durationMs });
    try {
      setIntrospectionPayload(buildIntrospectionPayload());
    } catch {
      setIntrospectionPayload(null);
    }
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  if (!isDev) {
    return (
      <main className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold m-0 mb-4">Engine Health</h1>
        <p className="text-neutral-600 dark:text-neutral-400">Dev tools disabled.</p>
      </main>
    );
  }

  const results = runResult?.results ?? [];
  const durationMs = runResult?.durationMs ?? 0;
  const effectiveStatus = (row: CheckResultRow): CheckStatus =>
    strictMode && row.status === "warn" ? "fail" : row.status;
  const passCount = results.filter((r) => effectiveStatus(r) === "pass").length;
  const warnCount = results.filter((r) => r.status === "warn" && !strictMode).length;
  const failCount = results.filter((r) => effectiveStatus(r) === "fail").length;

  const worstStatus: CheckStatus = results.length
    ? results.reduce<CheckStatus>((worst, r) => {
        const s = effectiveStatus(r);
        if (s === "fail") return "fail";
        if (s === "warn" && worst !== "fail") return "warn";
        return worst;
      }, "pass")
    : "pass";

  const bannerBg =
    worstStatus === "fail"
      ? "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800"
      : worstStatus === "warn"
        ? "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800"
        : "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800";
  const bannerText =
    worstStatus === "fail"
      ? "text-red-800 dark:text-red-200"
      : worstStatus === "warn"
        ? "text-amber-800 dark:text-amber-200"
        : "text-green-800 dark:text-green-200";

  const debugBundle = JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      durationMs,
      results,
      introspection: introspectionPayload,
    },
    null,
    2
  );

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <main className="p-6 max-w-5xl">
      <h1 className="text-2xl font-semibold m-0 mb-2">Engine Health</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
        Deterministic validation harness: scenario math, mitigation, time weighting, exposure engine, governance, UI gating, lens range integrity, baseline lock.
      </p>

      {results.length > 0 && (
        <>
          <div className={`rounded-lg border px-4 py-3 mb-4 ${bannerBg} ${bannerText}`}>
            <div className="flex flex-wrap items-center gap-4">
              <span>
                <strong>Overall: </strong>
                {worstStatus === "fail" ? "FAIL" : worstStatus === "warn" ? "WARN" : "PASS"}
                {strictMode && " (strict: warnings = failures)"}
              </span>
              <span className="text-sm">
                ✅ {passCount} passed · ⚠️ {warnCount} warned · ❌ {failCount} failed
              </span>
            </div>
          </div>

          {durationMs > PERF_WARN_MS && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 mb-4 text-amber-800 dark:text-amber-200 text-sm">
              ⚠️ Performance: all checks took {durationMs.toFixed(0)}ms (threshold {PERF_WARN_MS}ms).
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 mb-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={strictMode}
                onChange={(e) => setStrictMode(e.target.checked)}
                className="rounded border-neutral-400"
              />
              Strict mode (warnings count as failures)
            </label>
            <button
              type="button"
              onClick={runChecks}
              className="px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-700 text-sm font-medium"
            >
              Re-run checks
            </button>
            <CopyButton text={debugBundle} label="Copy debug bundle" />
          </div>

          {GROUPS.map((group) => {
            const groupRows = results.filter((r) => r.group === group);
            if (groupRows.length === 0) return null;
            return (
              <div key={group} className="mb-8">
                <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-200 mb-2 border-b border-neutral-200 dark:border-neutral-700 pb-1">
                  {group}
                </h2>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] overflow-hidden">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                        <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400 w-10">Status</th>
                        <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Check</th>
                        <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Message</th>
                        <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400 w-28">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupRows.map((row) => {
                        const key = `${row.group}:${row.name}`;
                        const effective = effectiveStatus(row);
                        const hasDetails = row.details !== undefined && row.details !== null;
                        const isExpanded = expanded.has(key);
                        return (
                          <Fragment key={key}>
                            <tr className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                              <td className="py-2 px-3">
                                <StatusIcon status={effective} />
                              </td>
                              <td className="py-2 px-3 font-medium text-neutral-800 dark:text-neutral-200">{row.name}</td>
                              <td className="py-2 px-3 text-neutral-700 dark:text-neutral-300">{row.message}</td>
                              <td className="py-2 px-3 flex items-center gap-2">
                                {hasDetails && (
                                  <>
                                    <CopyButton text={JSON.stringify(row.details, null, 2)} label="Copy details" />
                                    <button
                                      type="button"
                                      onClick={() => toggleExpand(key)}
                                      className="text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                    >
                                      {isExpanded ? "Hide" : "Show"} details
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                            {hasDetails && isExpanded && (
                              <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                                <td colSpan={4} className="p-0">
                                  <pre className="p-3 text-xs overflow-x-auto whitespace-pre-wrap break-words m-0">
                                    {JSON.stringify(row.details, null, 2)}
                                  </pre>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {introspectionPayload != null && (
            <div className="mb-8">
              <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-200 mb-2 border-b border-neutral-200 dark:border-neutral-700 pb-1">
                Introspection payload
              </h2>
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] overflow-hidden">
                <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 flex justify-between items-center">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">Scenario multipliers, raw vs adjusted params, time weights, mitigation by month</span>
                  <CopyButton text={JSON.stringify(introspectionPayload, null, 2)} label="Copy" />
                </div>
                {expanded.has("introspection") ? (
                  <>
                    <pre className="p-3 text-xs overflow-x-auto whitespace-pre-wrap break-words m-0">
                      {JSON.stringify(introspectionPayload, null, 2)}
                    </pre>
                    <button
                      type="button"
                      onClick={() => toggleExpand("introspection")}
                      className="w-full text-left px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    >
                      Hide introspection
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleExpand("introspection")}
                    className="w-full text-left px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  >
                    Show introspection JSON
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {isDev && runResult === null && (
        <p className="text-neutral-500 dark:text-neutral-400">Running checks…</p>
      )}
    </main>
  );
}
