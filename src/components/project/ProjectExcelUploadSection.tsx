"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadFiles, saveFile, deleteFile, markFileImported, type StoredFileMeta } from "@/lib/uploadedRiskRegisterStore";
import { parseExcel, sheetToDocumentText, type ParseExcelResult } from "@/lib/riskImportExcel";
import type { Risk, RiskDraft } from "@/domain/risk/risk.schema";
import { RiskDraftSchema, RiskSchema } from "@/domain/risk/risk.schema";
import { draftsToRisks } from "@/domain/risk/risk.mapper";
import { useRiskRegister } from "@/store/risk-register.store";

const ACCEPT_EXCEL = ".xlsx";

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

/**
 * Excel file upload section for Project Information page only.
 * Files are stored in IndexedDB. Add and remove files here; upload UI is only visible on this page.
 */
export function ProjectExcelUploadSection() {
  const { appendRisks } = useRiskRegister();
  const [files, setFiles] = useState<StoredFileMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseExcelResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFileIdRef = useRef(selectedFileId);
  selectedFileIdRef.current = selectedFileId;

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const list = await loadFiles();
      setFiles(list);
      if (list.length > 0 && !selectedFileIdRef.current) {
        setSelectedFileId(list[0].id);
      }
      if (list.length === 0) {
        setSelectedFileId(null);
        setParsed(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load files");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // When selected file changes, parse it (with cleanup so stale parse doesn't overwrite state)
  useEffect(() => {
    if (!selectedFileId || files.length === 0) {
      setParsed(null);
      return;
    }
    const file = files.find((f) => f.id === selectedFileId);
    if (!file) {
      setParsed(null);
      return;
    }
    let cancelled = false;
    setParseError(null);
    parseExcel(file.blob)
      .then((result) => {
        if (cancelled) return;
        if (result.rows.length === 0 && result.headers.length === 0) {
          setParseError("Sheet is empty.");
          setParsed(null);
        } else {
          setParsed(result);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setParseError(err instanceof Error ? err.message : "Failed to parse file.");
        setParsed(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFileId, files]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Only .xlsx files are allowed.");
      return;
    }
    setError(null);
    try {
      await saveFile(file);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save file.");
    }
  };

  const handleRemoveFile = async (id: string) => {
    setError(null);
    setParseError(null);
    setImportMessage(null);
    setImportStatus("idle");
    try {
      await deleteFile(id);
      const list = await loadFiles();
      setFiles(list);
      if (selectedFileId === id) {
        setSelectedFileId(list[0]?.id ?? null);
        setParsed(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove file.");
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
      await refresh();
      setImportStatus("success");
      setImportMessage(`Imported ${list.length} risks.`);
    } catch (e) {
      setImportMessage(e instanceof Error ? e.message : "Network or unexpected error");
      setImportStatus("error");
    }
  };

  const hasData = parsed && parsed.rows.length > 0;
  const selectedFile = files.find((f) => f.id === selectedFileId);

  return (
    <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4 sm:p-5 mb-4">
      <h2 className="text-base font-semibold text-[var(--foreground)] mb-3 border-b border-neutral-200 dark:border-neutral-700 pb-2">
        Risk Register Files (Excel)
      </h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
        Upload Excel risk register files, then select one and generate risks with AI. Generated risks are added to the Risk Register.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_EXCEL}
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload Excel file"
      />
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          Add .xlsx file
        </button>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {files.length > 0 && (
          <>
            <ul className="space-y-2 text-sm mt-2">
              {files.map((f) => (
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
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(f.id)}
                    className="ml-auto px-2 py-1 text-xs rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 shrink-0"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            {parseError && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2" role="alert">
                {parseError}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <button
                type="button"
                onClick={handleGenerateRisks}
                disabled={!hasData || importStatus === "loading"}
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
          </>
        )}
      </div>
    </section>
  );
}
