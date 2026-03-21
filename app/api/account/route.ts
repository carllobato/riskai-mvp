import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/account — Permanently delete the authenticated user's auth user (and dependent rows per DB FK rules).
 * Requires SUPABASE_SERVICE_ROLE_KEY on the server.
 */
export async function DELETE() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  let admin;
  try {
    admin = supabaseAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Admin client unavailable.";
    const missingServiceRole =
      msg.includes("SUPABASE_SERVICE_ROLE_KEY") || msg.includes("admin operations");
    return NextResponse.json(
      {
        error: missingServiceRole
          ? "Account deletion is not configured: add SUPABASE_SERVICE_ROLE_KEY to the server environment (see .env.example)."
          : msg,
        code: missingServiceRole ? "SERVICE_ROLE_MISSING" : undefined,
      },
      { status: 503 }
    );
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
