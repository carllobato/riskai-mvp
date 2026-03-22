import type { ProfileDisplayRow } from "@/types/projectMembers";

export function canonicalUserId(id: string): string {
  return String(id).replace(/\s+/g, "").toLowerCase();
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

function recordLooksLikeProfileRow(r: Record<string, unknown>): boolean {
  return (
    "id" in r ||
    "email" in r ||
    "first_name" in r ||
    "surname" in r ||
    "company" in r ||
    "firstName" in r ||
    "lastName" in r
  );
}

/** Normalizes API/PostgREST profile shapes (arrays, nested wrappers, camelCase). */
export function coerceProfileFromUnknown(v: unknown): ProfileDisplayRow | null {
  if (v == null) return null;

  let o: unknown = v;
  if (Array.isArray(o)) {
    const obj = o.find(
      (item) => item != null && typeof item === "object" && !Array.isArray(item)
    );
    o = obj ?? o[0];
  }
  if (typeof o !== "object" || o === null) return null;

  let r = o as Record<string, unknown>;
  if (!recordLooksLikeProfileRow(r)) {
    const inner =
      r.profile && typeof r.profile === "object"
        ? (r.profile as Record<string, unknown>)
        : r.data && typeof r.data === "object"
          ? (r.data as Record<string, unknown>)
          : null;
    if (inner && recordLooksLikeProfileRow(inner)) {
      r = inner;
    }
  }

  if (!recordLooksLikeProfileRow(r)) return null;

  const first_name = strOrNull(r.first_name) ?? strOrNull(r.firstName) ?? null;
  const surname = strOrNull(r.surname) ?? strOrNull(r.lastName) ?? null;
  const email = strOrNull(r.email) ?? null;
  const company = strOrNull(r.company) ?? null;

  const idRaw = r.id;
  const id =
    typeof idRaw === "string"
      ? idRaw.trim()
      : typeof idRaw === "number"
        ? String(idRaw)
        : "";

  return {
    id,
    first_name,
    surname,
    email,
    company,
  };
}
