/**
 * PostgREST RPC for `RETURNS TABLE (...)` may return one row as a JSON object or as a one-element array.
 * Normalise to a single row object for parsing.
 *
 * Some responses wrap the row in an extra array layer (`[[{ ... }]]`); peel until we get a plain object.
 */
export function firstRpcTableRow(found: unknown): Record<string, unknown> | null {
  if (found == null) return null;
  let v: unknown = found;
  for (let i = 0; i < 4 && Array.isArray(v); i++) {
    if (v.length === 0) return null;
    v = v[0];
  }
  if (v != null && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}
