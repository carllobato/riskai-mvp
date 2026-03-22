import type { SupabaseClient, User } from "@supabase/supabase-js";
import { OnboardingMetaKey } from "@/lib/onboarding/types";

/** `public.profiles` — id matches `auth.users.id`. Job title (`role`) stays in `user_metadata.role`. */
export const USER_PROFILE_TABLE = "profiles";

/** PostgREST / DB error when the table is missing from the API (narrow — avoids silent fallback on RLS errors). */
function isUserProfileTableUnavailable(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("schema cache") ||
    m.includes("pgrst205") ||
    (m.includes("could not find the table") &&
      (m.includes("users") || m.includes("profiles"))) ||
    ((m.includes("relation") && m.includes("does not exist")) &&
      (m.includes("public.users") ||
        m.includes('"users"') ||
        m.includes("public.profiles") ||
        m.includes('"profiles"')))
  );
}

/** Save profile via POST /api/me/profile (server session + RLS). Prefer this from the browser. */
export async function saveUserProfileThroughApi(fields: {
  first_name: string;
  last_name: string;
  company: string;
  role: string | null;
}): Promise<{ error: string | null }> {
  const res = await fetch("/api/me/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(fields),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return {
      error:
        typeof data.error === "string" && data.error.trim()
          ? data.error
          : `Save failed (${res.status})`,
    };
  }
  return { error: null };
}

export type PublicProfileRow = {
  first_name: string | null;
  surname: string | null;
  email: string | null;
  company: string | null;
  user_type: string | null;
  /** Always from auth metadata in the app; not read from `public.profiles`. */
  role: string | null;
};

export async function fetchPublicProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<PublicProfileRow | null> {
  const { data, error } = await supabase
    .from(USER_PROFILE_TABLE)
    .select("first_name,surname,company,email,user_type")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    first_name: string | null;
    surname: string | null;
    company: string | null;
    email: string | null;
    user_type: string | null;
  };
  return { ...row, role: null };
}

/**
 * Persist name / company in `public.profiles`; role + onboarding flag in auth metadata.
 */
export async function upsertPublicProfile(
  supabase: SupabaseClient,
  userId: string,
  fields: {
    first_name: string;
    last_name: string;
    company: string;
    role: string | null;
  },
): Promise<{ error: string | null }> {
  const { error: upErr } = await supabase.from(USER_PROFILE_TABLE).upsert(
    {
      id: userId,
      first_name: fields.first_name,
      surname: fields.last_name,
      company: fields.company,
    },
    { onConflict: "id" },
  );
  if (upErr) {
    if (!isUserProfileTableUnavailable(upErr.message)) return { error: upErr.message };
    const { error: metaErr } = await supabase.auth.updateUser({
      data: {
        first_name: fields.first_name,
        last_name: fields.last_name,
        company: fields.company,
        [OnboardingMetaKey.role]: fields.role,
        [OnboardingMetaKey.profileComplete]: true,
      },
    });
    if (metaErr) return { error: metaErr.message };
    return { error: null };
  }
  const { error: metaErr } = await supabase.auth.updateUser({
    data: {
      [OnboardingMetaKey.profileComplete]: true,
      [OnboardingMetaKey.role]: fields.role,
    },
  });
  if (metaErr) return { error: metaErr.message };
  return { error: null };
}

/** “Triggered by” label; prefers `public.profiles` row, falls back to legacy `user_metadata`. */
export function formatTriggeredByLabel(user: User, profile: PublicProfileRow | null): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const first = (profile?.first_name ?? (meta?.first_name as string | undefined))?.trim();
  const last = (
    profile?.surname ??
    (meta?.last_name as string | undefined) ??
    (meta?.surname as string | undefined)
  )?.trim();
  const company = (profile?.company ?? (meta?.company as string | undefined))?.trim();
  const fullName =
    (meta?.full_name as string | undefined)?.trim() || (meta?.name as string | undefined)?.trim();
  let display: string;
  if (first || last) {
    const namePart = [first, last].filter(Boolean).join(", ");
    display = company ? `${namePart} - ${company}` : namePart;
  } else if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    const namePart = parts.length > 1 ? `${parts[0]}, ${parts.slice(1).join(" ")}` : (parts[0] ?? "");
    display = namePart && company ? `${namePart} - ${company}` : namePart || (user.email ?? user.id);
  } else {
    display = user.email ?? user.id;
  }
  return display || (user.email ?? user.id);
}
