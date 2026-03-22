import { canonicalUserId } from "@/lib/profileDisplayCoerce";

/** True when PostgREST has not picked up the RPC yet (migration not applied or schema cache stale). */
export function isMemberAuthEmailsRpcMissing(err: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!err) return false;
  const msg = (err.message ?? "").toLowerCase();
  const code = err.code ?? "";
  return (
    code === "PGRST202" ||
    msg.includes("schema cache") ||
    msg.includes("could not find the function")
  );
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/**
 * PostgREST may return `RETURNS TABLE` RPCs as a JSON array of rows or, for a single row,
 * as one plain object. Some responses wrap the row list in an extra array layer (`[[{...}]]`);
 * peel until we get a list of plain row objects (see `firstRpcTableRow` in rpcTableFirstRow.ts).
 */
function memberAuthEmailRpcRows(data: unknown): Record<string, unknown>[] {
  if (data == null) return [];

  let v: unknown = data;
  for (let depth = 0; depth < 8 && Array.isArray(v); depth++) {
    const arr = v as unknown[];
    if (arr.length === 0) return [];
    if (arr.every(isPlainRecord)) {
      return arr.filter(isPlainRecord);
    }
    v = arr[0];
  }

  if (isPlainRecord(v) && (v.user_id != null || v.id != null)) {
    return [v];
  }
  return [];
}

/** Normalise RPC rows from riskai_*_member_auth_emails to a canonical user_id → email map. */
export function authEmailMapFromRpcRows(data: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of memberAuthEmailRpcRows(data)) {
    const uidRaw = r.user_id ?? r.id;
    if (uidRaw == null) continue;
    const em = typeof r.email === "string" ? r.email.trim() : "";
    if (!em) continue;
    const key = canonicalUserId(String(uidRaw));
    if (key) out[key] = em;
  }
  return out;
}

export function memberAuthEmailLookup(
  map: Record<string, string>,
  userId: string | null | undefined
): string | undefined {
  if (userId == null || userId === "") return undefined;
  return map[canonicalUserId(userId)];
}
