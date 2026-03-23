"use client";

import { useCallback, useEffect, useState } from "react";

type StatusData = {
  url: string;
  json: unknown;
  headers: Record<string, string>;
  error?: string;
};

type PostResult = {
  json: unknown;
  error?: string;
  textPreview?: string;
  httpStatus?: number;
  updatedAt: number;
};

const SIMCTX_HEADERS = [
  "x-simctx-risk-count",
  "x-simctx-has-neutral",
  "x-simctx-neutral-p80",
  "x-simctx-last-updated",
];

function pickHeaders(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  SIMCTX_HEADERS.forEach((key) => {
    const v = res.headers.get(key);
    if (v != null) out[key] = v;
  });
  return out;
}

async function parsePostResponse(res: Response): Promise<{ json: unknown; textPreview?: string }> {
  const text = await res.text();
  try {
    const json = text ? JSON.parse(text) : null;
    return { json };
  } catch {
    return { json: null, textPreview: text.slice(0, 200) };
  }
}

export function MitigationDebugClient() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [mitOpt, setMitOpt] = useState<StatusData | null>(null);
  const [mitPost, setMitPost] = useState<PostResult | null>(null);

  const load = useCallback(async () => {
    try {
      const statusRes = await fetch("/api/simulation-context/status");
      const statusJson = await statusRes.json().catch(() => ({}));
      setStatus({
        url: "/api/simulation-context/status",
        json: statusJson,
        headers: pickHeaders(statusRes),
        error: statusRes.ok ? undefined : `HTTP ${statusRes.status}`,
      });
    } catch (e) {
      setStatus({
        url: "/api/simulation-context/status",
        json: {},
        headers: {},
        error: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const mitRes = await fetch("/api/mitigation-optimisation");
      const mitJson = await mitRes.json().catch(() => ({}));
      setMitOpt({
        url: "/api/mitigation-optimisation",
        json: mitJson,
        headers: pickHeaders(mitRes),
        error: mitRes.ok ? undefined : `HTTP ${mitRes.status}`,
      });
    } catch (e) {
      setMitOpt({
        url: "/api/mitigation-optimisation",
        json: {},
        headers: {},
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runPost = useCallback(async () => {
    const updatedAt = Date.now();
    try {
      const res = await fetch("/api/mitigation-optimisation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spendSteps: [0, 25000, 50000, 100000, 200000],
          budgetCap: 200000,
          benefitMetric: "p80CostReduction",
        }),
      });
      const { json, textPreview } = await parsePostResponse(res);
      if (!res.ok) {
        setMitPost({ json, error: `HTTP ${res.status}`, textPreview, httpStatus: res.status, updatedAt });
        return;
      }
      setMitPost({ json, textPreview, httpStatus: res.status, updatedAt });
    } catch (e) {
      setMitPost({
        json: null,
        error: e instanceof Error ? e.message : String(e),
        httpStatus: undefined,
        updatedAt,
      });
    }
  }, []);

  const postPayload = mitPost?.json as {
    baseline?: { neutralP80?: number };
    ranked?: Array<{
      riskName?: string;
      bestROIBand?: { from?: number; to?: number };
      topBandBenefitPerDollar?: number;
    }>;
    error?: string;
  } | undefined;

  const jsonIsNull = mitPost != null && mitPost.json === null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <button type="button" onClick={load} style={{ marginRight: 8 }}>
          Refresh
        </button>
        <button type="button" onClick={runPost}>
          Run POST optimisation
        </button>
      </div>

      {mitPost && (
        <section style={{ marginBottom: 24, border: "2px solid #333", padding: 16 }}>
          <h2 style={{ fontSize: 18 }}>POST /api/mitigation-optimisation result</h2>
          <p style={{ fontSize: 16, fontWeight: "bold", margin: "8px 0" }}>
            HTTP status: {mitPost.httpStatus ?? "—"} · Error: {mitPost.error ?? "none"} · Response JSON: {jsonIsNull ? "null" : "ok"}
          </p>
          {mitPost.error && <p style={{ color: "#c00" }}>{mitPost.error}</p>}
          {jsonIsNull && mitPost.textPreview != null && (
            <p style={{ marginTop: 8 }}>
              <strong>textPreview (first 200 chars):</strong>
              <pre style={{ background: "#f5f5f5", padding: 8, fontSize: 12, overflow: "auto" }}>{mitPost.textPreview}</pre>
            </p>
          )}
          {postPayload && !mitPost.error && (
            <div style={{ marginBottom: 8 }}>
              <p>
                <strong>baseline.neutralP80:</strong> {postPayload.baseline?.neutralP80 ?? "—"}
              </p>
              <p>
                <strong>ranked.length:</strong> {postPayload.ranked?.length ?? 0}
              </p>
              {postPayload.ranked && postPayload.ranked.length > 0 && (
                <p>
                  <strong>Top ranked:</strong> {postPayload.ranked[0].riskName ?? "—"} — bestROIBand:{" "}
                  {postPayload.ranked[0].bestROIBand
                    ? `$${postPayload.ranked[0].bestROIBand.from ?? ""}–$${postPayload.ranked[0].bestROIBand.to ?? ""}`
                    : "—"}{" "}
                  · topBandBenefitPerDollar: {postPayload.ranked[0].topBandBenefitPerDollar ?? "—"}
                </p>
              )}
            </div>
          )}
          <details>
            <summary>Full JSON</summary>
            <pre style={{ background: "#f5f5f5", padding: 8, fontSize: 12, overflow: "auto" }}>
              {JSON.stringify(mitPost.json, null, 2)}
            </pre>
          </details>
        </section>
      )}

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18 }}>GET /api/simulation-context/status</h2>
        {status?.headers && Object.keys(status.headers).length > 0 && (
          <pre style={{ background: "#f5f5f5", padding: 8, fontSize: 12, overflow: "auto" }}>
            {JSON.stringify(status.headers, null, 2)}
          </pre>
        )}
        {status?.error && <p style={{ color: "#c00" }}>{status.error}</p>}
        <pre style={{ background: "#f5f5f5", padding: 8, fontSize: 12, overflow: "auto" }}>
          {JSON.stringify(status?.json ?? {}, null, 2)}
        </pre>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18 }}>GET /api/mitigation-optimisation</h2>
        {mitOpt?.headers && Object.keys(mitOpt.headers).length > 0 && (
          <pre style={{ background: "#f5f5f5", padding: 8, fontSize: 12, overflow: "auto" }}>
            {JSON.stringify(mitOpt.headers, null, 2)}
          </pre>
        )}
        {mitOpt?.error && <p style={{ color: "#c00" }}>{mitOpt.error}</p>}
        <pre style={{ background: "#f5f5f5", padding: 8, fontSize: 12, overflow: "auto" }}>
          {JSON.stringify(mitOpt?.json ?? {}, null, 2)}
        </pre>
      </section>
    </div>
  );
}
