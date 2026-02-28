"use client";

import { useState } from "react";
import type { Risk, RiskDraft } from "@/domain/risk/risk.schema";
import { RiskSchema, RiskDraftSchema } from "@/domain/risk/risk.schema";
import { draftsToRisks } from "@/domain/risk/risk.mapper";
import { useRiskRegister } from "@/store/risk-register.store";

type Status = "idle" | "loading" | "error";

function isDraftLike(item: unknown): item is RiskDraft {
  if (!item || typeof item !== "object") return false;
  const o = item as Record<string, unknown>;
  return (
    typeof o.probability === "number" &&
    typeof o.consequence === "number" &&
    o.inherentRating === undefined
  );
}

function isRiskLike(item: unknown): item is Risk {
  if (!item || typeof item !== "object") return false;
  const o = item as Record<string, unknown>;
  return o.inherentRating != null && typeof o.inherentRating === "object";
}

function normalizeRisks(raw: unknown): Risk[] {
  const list = Array.isArray(raw) ? raw : [];
  const result: Risk[] = [];

  for (const item of list) {
    if (isRiskLike(item)) {
      const parsed = RiskSchema.safeParse(item);
      if (parsed.success) result.push(parsed.data);
    } else if (isDraftLike(item)) {
      const parsed = RiskDraftSchema.safeParse(item);
      if (parsed.success) result.push(draftsToRisks([parsed.data])[0]);
    }
  }

  return result;
}

export function RiskExtractPanel() {
  const [documentText, setDocumentText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const { appendRisks } = useRiskRegister();

  async function handleExtract() {
    setErrorMessage(null);
    setStatus("loading");

    try {
      const res = await fetch("/api/risks/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentText }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : "Extract failed";
        setErrorMessage(msg);
        setStatus("error");
        return;
      }

      const risks = normalizeRisks(data?.risks);
      appendRisks(risks);
      setStatus("idle");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network or unexpected error";
      setErrorMessage(msg);
      setStatus("error");
    }
  }

  return (
    <div
      className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 mb-4"
      style={{ marginBottom: 16 }}
    >
      <div className="flex flex-wrap items-center gap-2 mb-0">
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
          Generate Risks from text entry
        </h2>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="ml-auto px-2 py-1 text-xs rounded border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-800 dark:hover:text-neutral-200 flex items-center gap-1"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              Collapse
              <span className="inline-block w-3 h-3" aria-hidden>▲</span>
            </>
          ) : (
            <>
              Show details
              <span className="inline-block w-3 h-3" aria-hidden>▼</span>
            </>
          )}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 mt-3">
          <textarea
            value={documentText}
            onChange={(e) => setDocumentText(e.target.value)}
            placeholder="Paste document text here..."
            rows={6}
            className="w-full box-border px-3 py-2.5 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-sm font-[inherit] resize-y focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:border-transparent"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExtract}
              disabled={status === "loading"}
              className="px-4 py-2 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:pointer-events-none"
            >
              Extract
            </button>
            <span
              className={`text-sm ${status === "error" ? "text-red-600 dark:text-red-400" : "text-neutral-500 dark:text-neutral-400"}`}
            >
              {status === "idle" && "Idle"}
              {status === "loading" && "Loading…"}
              {status === "error" && errorMessage}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
