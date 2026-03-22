import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/requireUser";
import { getProjectAccessForUser } from "@/lib/db/projectAccess";
import { supabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/[projectId] — Project row + `permissions` (owner/editor/viewer/portfolio) for UI gating.
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

  const bundle = await getProjectAccessForUser(projectId, user.id);
  if (!bundle) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[project-access] GET /api/projects/[id] permissions", {
      projectId,
      accessMode: bundle.permissions.accessMode,
    });
  }

  return NextResponse.json({
    ...bundle.project,
    permissions: bundle.permissions,
  });
}

/**
 * PATCH /api/projects/[projectId] — Update project name. Body: { name: string }.
 * Allowed for table owner or project_members with role owner/editor (matches RLS).
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

  const bundle = await getProjectAccessForUser(projectId, user.id);
  if (!bundle) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!bundle.permissions.canEditProjectMetadata) {
    if (process.env.NODE_ENV === "development") {
      console.log("[project-access] PATCH project denied", {
        projectId,
        accessMode: bundle.permissions.accessMode,
      });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
