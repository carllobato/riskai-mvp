import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  authEmailMapFromRpcRows,
  isMemberAuthEmailsRpcMissing,
  memberAuthEmailLookup,
} from "@/lib/db/memberAuthEmailsMap";
import { getProjectIfAccessible } from "@/lib/db/projectAccess";
import { getProjectMembersViewerContext } from "@/lib/db/projectMemberAccess";
import type {
  ProjectMemberRole,
  ProjectMemberRow,
  ProfileDisplayRow,
  ProjectMemberWithProfileRow,
} from "@/types/projectMembers";
import { coerceProfileFromUnknown } from "@/lib/profileDisplayCoerce";
import { firstRpcTableRow } from "@/lib/supabase/rpcTableFirstRow";
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

  // Load members without embedding `profiles`: PostgREST only exposes embeds for FKs present
  // in the live DB schema cache (e.g. user_id → profiles). If user_id still references
  // auth.users, embed fails; batch-fetch profiles below instead.
  const { data: members, error: mErr } = await supabase
    .from("project_members")
    .select("id, project_id, user_id, role, created_at, updated_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  const rawRows = (members ?? []) as Record<string, unknown>[];

  let shaped: ProjectMemberWithProfileRow[] = rawRows.map((raw) => ({
    id: raw.id as string,
    project_id: raw.project_id as string,
    user_id: raw.user_id as string,
    role: raw.role as ProjectMemberRole,
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
    profiles: null,
    email: null,
    resolvedProfile: null,
  }));

  const memberUserIds = [...new Set(shaped.map((r) => r.user_id))];
  const profilesMap: Record<string, ProfileDisplayRow> = {};

  if (memberUserIds.length > 0) {
    const { data: profileRows, error: profilesErr } = await supabase
      .from("profiles")
      .select("id, email, first_name, surname, company")
      .in("id", memberUserIds);

    if (profilesErr) {
      return NextResponse.json({ error: profilesErr.message }, { status: 500 });
    }

    for (const row of profileRows ?? []) {
      const p = coerceProfileFromUnknown(row);
      if (!p?.id) continue;
      profilesMap[p.id] = p;
      if (typeof row === "object" && row !== null && "id" in row) {
        const raw = (row as { id: unknown }).id;
        const rawStr = raw == null ? "" : String(raw);
        if (rawStr && rawStr !== p.id) profilesMap[rawStr] = p;
      }
    }
  }

  let authEmails: Record<string, string> = {};
  if (memberUserIds.length > 0) {
    const { data: authRows, error: authErr } = await supabase.rpc(
      "riskai_project_member_auth_emails",
      { p_project_id: projectId, p_user_ids: memberUserIds }
    );
    if (authErr) {
      if (isMemberAuthEmailsRpcMissing(authErr)) {
        authEmails = {};
      } else {
        return NextResponse.json({ error: authErr.message }, { status: 500 });
      }
    } else {
      authEmails = authEmailMapFromRpcRows(authRows);
    }
  }

  shaped = shaped.map((r) => {
    const canonical = profilesMap[r.user_id] ?? null;
    const profileEmail = canonical?.email?.trim();
    return {
      ...r,
      profiles: canonical,
      resolvedProfile: canonical,
      email: profileEmail || memberAuthEmailLookup(authEmails, r.user_id) || r.email || null,
    };
  });

  const profiles: Record<string, ProfileDisplayRow> = {};
  for (const r of shaped) {
    const p = r.profiles;
    if (p && !Array.isArray(p) && p.id) {
      profiles[r.user_id] = p;
    }
  }

  return NextResponse.json({
    members: shaped,
    profiles,
    viewer,
    roleSemantics: {
      owner: "Full access",
      editor: "Can view settings, edit project details, invite members",
      viewer: "View only",
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
  if (!viewer.canInviteMembers) {
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
    { p_email: email, p_project_id: projectId }
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

  const match = firstRpcTableRow(found);
  const rpcUserIdRaw = match?.user_id ?? match?.id;
  if (!match || rpcUserIdRaw == null) {
    return NextResponse.json(
      {
        error: "USER_NOT_FOUND",
        message: "User not found. They need to sign up first.",
      },
      { status: 404 }
    );
  }

  const newUserId = typeof rpcUserIdRaw === "string" ? rpcUserIdRaw : String(rpcUserIdRaw);
  const profileRow = {
    id: newUserId,
    already_member: match.already_member === true,
  };
  if (profileRow.already_member === true) {
    return NextResponse.json(
      {
        error: "DUPLICATE_MEMBER",
        message: "This user is already a member of the project.",
      },
      { status: 409 }
    );
  }

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

  return NextResponse.json({ member: inserted });
}
