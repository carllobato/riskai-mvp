import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getProjectIfAccessible } from "@/lib/db/projectAccess";
import {
  countProjectOwners,
  getProjectMembersViewerContext,
} from "@/lib/db/projectMemberAccess";
import type { ProjectMemberRole } from "@/types/projectMembers";
import { supabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ROLES: ProjectMemberRole[] = ["owner", "editor", "viewer"];

function isRole(v: unknown): v is ProjectMemberRole {
  return typeof v === "string" && (ROLES as string[]).includes(v);
}

/**
 * PATCH /api/projects/[projectId]/members/[memberId] — Update role (owners only; not self).
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; memberId: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId, memberId } = await context.params;
  if (!projectId || !memberId) {
    return NextResponse.json({ error: "Project ID and member ID required" }, { status: 400 });
  }

  const supabase = await supabaseServerClient();
  const viewer = await getProjectMembersViewerContext(supabase, projectId, user.id);
  if (!viewer?.canChangeMemberRoles) {
    return NextResponse.json(
      { error: "PERMISSION_DENIED", message: "Permission denied" },
      { status: 403 }
    );
  }

  const project = await getProjectIfAccessible(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let body: { role?: unknown };
  try {
    body = (await request.json()) as { role?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isRole(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const nextRole = body.role;

  const { data: row, error: fetchErr } = await supabase
    .from("project_members")
    .select("id, user_id, role, project_id")
    .eq("id", memberId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (row.user_id === user.id) {
    return NextResponse.json(
      {
        error: "CANNOT_CHANGE_SELF",
        message: "You cannot change your own role here.",
      },
      { status: 400 }
    );
  }

  const ownerCount = await countProjectOwners(supabase, projectId);
  const wasOwner = row.role === "owner";
  const becomesNonOwner = nextRole !== "owner";
  if (wasOwner && becomesNonOwner && ownerCount <= 1) {
    return NextResponse.json(
      {
        error: "LAST_OWNER",
        message: "Cannot remove the last project owner.",
      },
      { status: 400 }
    );
  }

  const { data: updated, error: updErr } = await supabase
    .from("project_members")
    .update({ role: nextRole })
    .eq("id", memberId)
    .eq("project_id", projectId)
    .select("id, project_id, user_id, role, created_at, updated_at")
    .single();

  if (updErr) {
    if (updErr.code === "42501" || updErr.message?.toLowerCase().includes("policy")) {
      return NextResponse.json(
        { error: "PERMISSION_DENIED", message: "Permission denied" },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ member: updated });
}

/**
 * DELETE /api/projects/[projectId]/members/[memberId] — Remove member (owners only).
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string; memberId: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId, memberId } = await context.params;
  if (!projectId || !memberId) {
    return NextResponse.json({ error: "Project ID and member ID required" }, { status: 400 });
  }

  const supabase = await supabaseServerClient();
  const viewer = await getProjectMembersViewerContext(supabase, projectId, user.id);
  if (!viewer?.canRemoveMembers) {
    return NextResponse.json(
      { error: "PERMISSION_DENIED", message: "Permission denied" },
      { status: 403 }
    );
  }

  const project = await getProjectIfAccessible(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: row, error: fetchErr } = await supabase
    .from("project_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const ownerCount = await countProjectOwners(supabase, projectId);
  if (row.role === "owner" && ownerCount <= 1) {
    return NextResponse.json(
      {
        error: "LAST_OWNER",
        message: "Cannot remove the last project owner.",
      },
      { status: 400 }
    );
  }

  const { error: delErr } = await supabase
    .from("project_members")
    .delete()
    .eq("id", memberId)
    .eq("project_id", projectId);

  if (delErr) {
    if (delErr.code === "42501" || delErr.message?.toLowerCase().includes("policy")) {
      return NextResponse.json(
        { error: "PERMISSION_DENIED", message: "Permission denied" },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
