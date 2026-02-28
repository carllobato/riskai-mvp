"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadFiles, saveFile, deleteFile, type StoredFileMeta } from "@/lib/uploadedRiskRegisterStore";

const ACCEPT_EXCEL = ".xlsx";

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
  const [files, setFiles] = useState<StoredFileMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const list = await loadFiles();
      setFiles(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load files");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    try {
      await deleteFile(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove file.");
    }
  };

  return (
    <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4 sm:p-5 mb-4">
      <h2 className="text-base font-semibold text-[var(--foreground)] mb-3 border-b border-neutral-200 dark:border-neutral-700 pb-2">
        Risk Register Files (Excel)
      </h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
        Upload Excel risk register files here. They will be available on the Risk Register page to generate risks. This list is only visible on this page.
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
          <ul className="space-y-2 text-sm mt-2">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center gap-2 py-2 px-3 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50"
              >
                <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                  {f.name}
                </span>
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
        )}
      </div>
    </section>
  );
}
