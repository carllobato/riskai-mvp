import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getProjectIfAccessible } from "@/lib/db/projectAccess";
import { getProjectMembersViewerContext } from "@/lib/db/projectMemberAccess";
import type {
  ProjectMemberRole,
  ProjectMemberRow,
  ProfileDisplayRow,
} from "@/types/projectMembers";
import { supabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ROLES: ProjectMemberRole[] = ["owner", "editor", "viewer"];

function isRole(v: unknown): v is ProjectMemberRole {
  return typeof v === "string" && (ROLES as string[]).includes(v);
}

/**
 * GET /api/projects/[projectId]/members — Member rows + profiles map (merge on client).
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

  const supabase = await supabaseServerClient();
  const viewer = await getProjectMembersViewerContext(supabase, projectId, user.id);
  if (!viewer) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: members, error: mErr } = await supabase
    .from("project_members")
    .select("id, project_id, user_id, role, created_at, updated_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  const rows = (members ?? []) as ProjectMemberRow[];
  const userIds = [...new Set(rows.map((r) => r.user_id))];

  let profiles: Record<string, ProfileDisplayRow> = {};
  if (userIds.length > 0) {
    const { data: profRows, error: pErr } = await supabase
      .from("profiles")
      .select("id, first_name, surname, email")
      .in("id", userIds);

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    profiles = Object.fromEntries(
      (profRows ?? []).map((p) => [p.id as string, p as ProfileDisplayRow])
    );
  }

  // Temporary log (acceptance / debugging)
  console.log("[project-members] members fetched", {
    projectId,
    count: rows.length,
  });

  return NextResponse.json({
    members: rows,
    profiles,
    viewer,
    roleSemantics: {
      owner: "Full access",
      editor: "Can edit risks and project settings",
      viewer: "Read-only",
    },
  });
}

/**
 * POST /api/projects/[projectId]/members — Add member by email (existing profile only).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  if (!projectId) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }

  const supabase = await supabaseServerClient();
  const viewer = await getProjectMembersViewerContext(supabase, projectId, user.id);
  if (!viewer) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!viewer.canManageMembers) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  const project = await getProjectIfAccessible(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let body: { email?: unknown; role?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; role?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!isRole(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const role = body.role;

  const { data: found, error: rpcErr } = await supabase.rpc(
    "riskai_find_profile_by_email_for_project",
    { p_project_id: projectId, p_email: email }
  );

  if (rpcErr) {
    const msg = rpcErr.message?.toLowerCase() ?? "";
    if (msg.includes("permission") || msg.includes("policy") || msg.includes("denied")) {
      return NextResponse.json(
        { error: "PERMISSION_DENIED", message: "Permission denied" },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  const match = Array.isArray(found) ? found[0] : null;
  if (!match || typeof match !== "object" || !("id" in match)) {
    return NextResponse.json(
      {
        error: "USER_NOT_FOUND",
        message: "User not found. They need to sign up first.",
      },
      { status: 404 }
    );
  }

  const newUserId = (match as { id: string }).id;

  const { data: inserted, error: insErr } = await supabase
    .from("project_members")
    .insert({
      project_id: projectId,
      user_id: newUserId,
      role,
    })
    .select("id, project_id, user_id, role, created_at, updated_at")
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json(
        {
          error: "DUPLICATE_MEMBER",
          message: "This user is already a member of the project.",
        },
        { status: 409 }
      );
    }
    if (insErr.code === "42501" || insErr.message?.toLowerCase().includes("policy")) {
      return NextResponse.json(
        { error: "PERMISSION_DENIED", message: "Permission denied" },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  console.log("[project-members] member added", {
    projectId,
    memberId: inserted?.id,
    userId: newUserId,
    role,
  });

  return NextResponse.json({ member: inserted });
}
