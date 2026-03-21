import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { USER_PROFILE_TABLE } from "@/lib/profiles/profileDb";
import { OnboardingMetaKey } from "@/lib/onboarding/types";
import { supabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/me/profile — Upsert the signed-in user’s row in `public.users` (cookie session).
 * Uses the server Supabase client so RLS sees the same JWT as other API routes.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const first_name = typeof o.first_name === "string" ? o.first_name.trim() : "";
  const last_name = typeof o.last_name === "string" ? o.last_name.trim() : "";
  const company = typeof o.company === "string" ? o.company.trim() : "";
  const roleRaw = typeof o.role === "string" ? o.role.trim() : "";
  const role = roleRaw.length > 0 ? roleRaw : null;

  if (!first_name || !last_name || !company) {
    return NextResponse.json(
      { error: "First name, surname, and company are required." },
      { status: 400 },
    );
  }

  const supabase = await supabaseServerClient();
  const { error: upErr } = await supabase.from(USER_PROFILE_TABLE).upsert(
    {
      id: user.id,
      first_name,
      last_name,
      company,
    },
    { onConflict: "id" },
  );

  if (upErr) {
    return NextResponse.json(
      { error: upErr.message, details: upErr.details, hint: upErr.hint, code: upErr.code },
      { status: 500 },
    );
  }

  const { error: metaErr } = await supabase.auth.updateUser({
    data: {
      [OnboardingMetaKey.profileComplete]: true,
      [OnboardingMetaKey.role]: role,
    },
  });

  if (metaErr) {
    return NextResponse.json({ error: metaErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
