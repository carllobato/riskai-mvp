import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/projects — Returns current user's projects (id, name, created_at) ordered by created_at asc.
 * Used by home redirect to resolve last-active or first project.
 */
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const supabase = await supabaseServerClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ projects: projects ?? [] });
}
