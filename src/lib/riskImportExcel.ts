/**
 * Parse Excel (.xlsx) risk register: first worksheet, first row = headers.
 * Returns headers, all rows as objects, and first 10 rows for preview.
 */

import * as XLSX from "xlsx";

const PREVIEW_ROW_COUNT = 10;

export type ParseExcelResult = {
  headers: string[];
  rows: Record<string, unknown>[];
  preview: Record<string, unknown>[];
};

function isRowEmpty(cells: unknown[]): boolean {
  return cells.every((c) => c === undefined || c === null || String(c).trim() === "");
}

/**
 * Parse first worksheet from Excel blob.
 * - First row = headers (strings)
 * - Rows = array of objects keyed by header
 * - Preview = first 10 data rows
 * - Completely empty rows are omitted
 */
export async function parseExcel(blob: Blob): Promise<ParseExcelResult> {
  const arrayBuffer = await blob.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Workbook has no worksheets");
  }
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    throw new Error("First worksheet could not be read");
  }
  // header: 1 => array of arrays; first row = headers
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  if (!raw.length) {
    return { headers: [], rows: [], preview: [] };
  }

  const headerRow = raw[0] ?? [];
  const headers = headerRow.map((h, j) => String(h ?? "").trim() || `Column${j}`);

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < raw.length; i++) {
    const cellRow = raw[i] ?? [];
    if (isRowEmpty(cellRow as unknown[])) continue;
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      const value = cellRow[j];
      row[key] = value === undefined || value === null ? "" : value;
    }
    rows.push(row);
  }

  const preview = rows.slice(0, PREVIEW_ROW_COUNT);
  return { headers, rows, preview };
}

const MAX_ROWS_FOR_AI = 300;

/**
 * Convert parsed sheet to structured text for the AI extraction endpoint.
 * Format:
 * Headers: header1, header2, ...
 * Rows: Row N: key1=value, key2=value ...
 * Limited to MAX_ROWS_FOR_AI rows.
 */
export function sheetToDocumentText(parsed: ParseExcelResult): string {
  const { headers, rows } = parsed;
  if (headers.length === 0) return "";
  const capped = rows.slice(0, MAX_ROWS_FOR_AI);
  const headerLine = "Headers:\n- " + headers.join(", ");
  const rowLines = capped.map((row, i) => {
    const parts = headers.map((h) => `${h}=${String(row[h] ?? "").trim()}`).filter((p) => p !== "=");
    return `Row ${i + 1}: ${parts.join(", ")}`;
  });
  return headerLine + "\n\nRows:\n" + rowLines.join("\n");
}
