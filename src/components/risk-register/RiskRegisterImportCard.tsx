"use client";

import { useCallback, useEffect, useState } from "react";
import type { Risk, RiskDraft } from "@/domain/risk/risk.schema";
import { RiskDraftSchema, RiskSchema } from "@/domain/risk/risk.schema";
import { draftsToRisks } from "@/domain/risk/risk.mapper";
import { useRiskRegister } from "@/store/risk-register.store";
import {
  loadFiles,
  deleteFile,
  markFileImported,
  type StoredFileMeta,
} from "@/lib/uploadedRiskRegisterStore";
import { parseExcel, sheetToDocumentText, type ParseExcelResult } from "@/lib/riskImportExcel";

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

function hasMeaningfulTitle(risk: Risk): boolean {
  const t = risk.title && String(risk.title).trim();
  return !!t && t.length > 0;
}

function deduplicateByTitle(risks: Risk[]): Risk[] {
  const seen = new Set<string>();
  return risks.filter((r) => {
    const key = String(r.title).trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatUploadedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function RiskRegisterImportCard() {
  const { appendRisks } = useRiskRegister();
  const [storedFiles, setStoredFiles] = useState<StoredFileMeta[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseExcelResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [completeExpanded, setCompleteExpanded] = useState(false);

  const loadStored = useCallback(async () => {
    setParseError(null);
    try {
      const files = await loadFiles();
      setStoredFiles(files);
      if (files.length > 0 && !selectedFileId) {
        setSelectedFileId(files[0].id);
      }
      if (files.length === 0) {
        setSelectedFileId(null);
        setParsed(null);
      }
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to load stored files");
      setParsed(null);
    }
  }, []);

  useEffect(() => {
    loadStored();
  }, [loadStored]);

  // When selected file changes, parse it
  useEffect(() => {
    if (!selectedFileId || storedFiles.length === 0) {
      setParsed(null);
      return;
    }
    const file = storedFiles.find((f) => f.id === selectedFileId);
    if (!file) {
      setParsed(null);
      return;
    }
    setParseError(null);
    parseExcel(file.blob)
      .then((result) => {
        if (result.rows.length === 0 && result.headers.length === 0) {
          setParseError("Sheet is empty.");
          setParsed(null);
        } else {
          setParsed(result);
        }
      })
      .catch((err) => {
        setParseError(err instanceof Error ? err.message : "Failed to parse file.");
        setParsed(null);
      });
  }, [selectedFileId, storedFiles]);

  const handleRemoveFile = async (id: string) => {
    setParseError(null);
    setImportMessage(null);
    setImportStatus("idle");
    try {
      await deleteFile(id);
      const files = await loadFiles();
      setStoredFiles(files);
      if (selectedFileId === id) {
        setSelectedFileId(files[0]?.id ?? null);
        setParsed(null);
      }
    } catch {
      setParseError("Failed to remove file from storage.");
    }
  };

  const handleGenerateRisks = async () => {
    if (!selectedFileId || !parsed || parsed.rows.length === 0) {
      setImportStatus("error");
      setImportMessage("Select a file and ensure it has data, then try again.");
      return;
    }
    setImportStatus("loading");
    setImportMessage(null);
    try {
      const documentText = sheetToDocumentText(parsed);
      const res = await fetch("/api/risks/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : "AI extraction failed";
        setImportMessage(msg);
        setImportStatus("error");
        return;
      }
      let list = normalizeRisks(data?.risks);
      list = list.filter(hasMeaningfulTitle);
      list = deduplicateByTitle(list);
      appendRisks(list);
      await markFileImported(selectedFileId);
      await loadStored();
      setImportStatus("success");
      setImportMessage(`Imported ${list.length} risks.`);
    } catch (e) {
      setImportMessage(e instanceof Error ? e.message : "Network or unexpected error");
      setImportStatus("error");
    }
  };

  const hasData = parsed && parsed.rows.length > 0;
  const selectedFile = storedFiles.find((f) => f.id === selectedFileId);
  const allImported = storedFiles.length > 0 && storedFiles.every((f) => f.importedAt);

  if (storedFiles.length === 0) return null;

  if (allImported && !completeExpanded) {
    return (
      <div
        className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20 px-4 py-2.5 mb-4 flex flex-wrap items-center gap-2"
        style={{ marginBottom: 16 }}
      >
        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
          Generate Risks from existing risk register
        </span>
        <span
          className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
          title="All uploaded files have been imported to the register"
        >
          ✓ Complete
        </span>
        <button
          type="button"
          onClick={() => setCompleteExpanded(true)}
          className="ml-auto px-2 py-1 text-xs rounded border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-neutral-800 dark:hover:text-neutral-200 flex items-center gap-1"
          aria-expanded="false"
        >
          Show details
          <span className="inline-block w-3 h-3" aria-hidden>▼</span>
        </button>
      </div>
    );
  }

  const isCompleteView = allImported && completeExpanded;

  return (
    <div
      className={`rounded-lg border p-4 mb-4 ${
        isCompleteView
          ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10"
          : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
      }`}
      style={{ marginBottom: 16 }}
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
          Generate Risks from existing risk register
        </h2>
        {isCompleteView && (
          <>
            <span
              className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
              title="All uploaded files have been imported to the register"
            >
              ✓ Complete
            </span>
            <button
              type="button"
              onClick={() => setCompleteExpanded(false)}
              className="ml-auto px-2 py-1 text-xs rounded border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center gap-1"
              aria-expanded="true"
            >
              Collapse
              <span className="inline-block w-3 h-3" aria-hidden>▲</span>
            </button>
          </>
        )}
      </div>
      {!isCompleteView && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
          Select an uploaded file and generate risks with AI.
        </p>
      )}

      <div
        className={`space-y-3 ${isCompleteView ? "opacity-60 pointer-events-none select-none" : ""}`}
      >
        <ul className="space-y-2 text-sm">
            {storedFiles.map((f) => (
              <li
                key={f.id}
                className={`flex flex-wrap items-center gap-2 py-2 px-3 rounded-md border ${
                  selectedFileId === f.id
                    ? "border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/20"
                    : "border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedFileId(f.id)}
                  className="text-left flex-1 min-w-0 font-medium text-neutral-800 dark:text-neutral-200 truncate"
                >
                  {f.name}
                </button>
                <span className="text-neutral-500 dark:text-neutral-400 shrink-0">
                  {formatUploadedAt(f.uploadedAt)}
                </span>
                {f.importedAt ? (
                  <span
                    className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 shrink-0"
                    title={`Translated to risks: ${formatUploadedAt(f.importedAt)}`}
                  >
                    Translated to risks
                  </span>
                ) : null}
                {!isCompleteView && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(f.id)}
                    className="px-2 py-1 text-xs rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 shrink-0"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>

        {parseError && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {parseError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleGenerateRisks}
            disabled={!hasData || importStatus === "loading" || isCompleteView}
            className="px-4 py-2 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:pointer-events-none"
          >
            Generate Risks with AI
            {selectedFile ? ` (from ${selectedFile.name})` : ""}
          </button>
          {importStatus === "loading" && (
            <span className="text-sm text-neutral-500">Loading…</span>
          )}
          {importStatus === "success" && importMessage && (
            <span className="text-sm text-blue-600 dark:text-blue-400" role="status">
              {importMessage}
            </span>
          )}
          {importStatus === "error" && importMessage && (
            <span className="text-sm text-red-600 dark:text-red-400" role="alert">
              {importMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
