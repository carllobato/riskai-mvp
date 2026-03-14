import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/requireUser";
import { getProjectIfAccessible } from "@/lib/db/projectAccess";
import { supabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/[projectId] — Returns the project (id, name, created_at) if the current user can access it.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  if (!projectId) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }

  const project = await getProjectIfAccessible(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

/**
 * PATCH /api/projects/[projectId] — Update project name. Body: { name: string }.
 * Access: same as GET (user must have access via RLS).
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  if (!projectId) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }

  const project = await getProjectIfAccessible(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let body: { name?: string };
  try {
    body = (await request.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const supabase = await supabaseServerClient();
  const { error } = await supabase
    .from("projects")
    .update({ name })
    .eq("id", projectId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);

  return NextResponse.json({ id: projectId, name });
}
