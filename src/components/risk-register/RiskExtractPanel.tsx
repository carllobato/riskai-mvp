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
    o.inherent === undefined
  );
}

function isRiskLike(item: unknown): item is Risk {
  if (!item || typeof item !== "object") return false;
  const o = item as Record<string, unknown>;
  return o.inherent != null && typeof o.inherent === "object";
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
  const { setRisks } = useRiskRegister();

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
      setRisks(risks);
      setStatus("idle");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network or unexpected error";
      setErrorMessage(msg);
      setStatus("error");
    }
  }

  return (
    <div
      style={{
        padding: 16,
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        marginBottom: 16,
      }}
    >
      <textarea
        value={documentText}
        onChange={(e) => setDocumentText(e.target.value)}
        placeholder="Paste document text here..."
        rows={6}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #ddd",
          fontFamily: "inherit",
          fontSize: 14,
          resize: "vertical",
        }}
      />
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={handleExtract}
          disabled={status === "loading"}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: status === "loading" ? "#f0f0f0" : "transparent",
            cursor: status === "loading" ? "not-allowed" : "pointer",
            fontWeight: 500,
          }}
        >
          Extract
        </button>
        <span
          style={{
            fontSize: 13,
            color: status === "error" ? "#c00" : "#666",
          }}
        >
          {status === "idle" && "Idle"}
          {status === "loading" && "Loading..."}
          {status === "error" && errorMessage}
        </span>
      </div>
    </div>
  );
}
