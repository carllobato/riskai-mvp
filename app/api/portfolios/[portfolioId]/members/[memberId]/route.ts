import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  countPortfolioOwners,
  getPortfolioMembersViewerContext,
} from "@/lib/db/portfolioMemberAccess";
import type { PortfolioMemberRole } from "@/types/portfolioMembers";
import { supabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ROLES: PortfolioMemberRole[] = ["owner", "editor", "viewer"];

function isRole(v: unknown): v is PortfolioMemberRole {
  return typeof v === "string" && (ROLES as string[]).includes(v);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ portfolioId: string; memberId: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { portfolioId, memberId } = await context.params;
  if (!portfolioId || !memberId) {
    return NextResponse.json(
      { error: "Portfolio ID and member ID required" },
      { status: 400 }
    );
  }

  const supabase = await supabaseServerClient();
  const viewer = await getPortfolioMembersViewerContext(supabase, portfolioId, user.id);
  if (!viewer?.canChangeMemberRoles) {
    return NextResponse.json(
      { error: "PERMISSION_DENIED", message: "Permission denied" },
      { status: 403 }
    );
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
    .from("portfolio_members")
    .select("id, user_id, role, portfolio_id")
    .eq("id", memberId)
    .eq("portfolio_id", portfolioId)
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

  const ownerCount = await countPortfolioOwners(supabase, portfolioId);
  const wasOwner = row.role === "owner";
  const becomesNonOwner = nextRole !== "owner";
  if (wasOwner && becomesNonOwner && ownerCount <= 1) {
    return NextResponse.json(
      {
        error: "LAST_OWNER",
        message: "Cannot remove the last portfolio member with the owner role.",
      },
      { status: 400 }
    );
  }

  const { data: updated, error: updErr } = await supabase
    .from("portfolio_members")
    .update({ role: nextRole })
    .eq("id", memberId)
    .eq("portfolio_id", portfolioId)
    .select("id, portfolio_id, user_id, role, created_at")
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

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ portfolioId: string; memberId: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { portfolioId, memberId } = await context.params;
  if (!portfolioId || !memberId) {
    return NextResponse.json(
      { error: "Portfolio ID and member ID required" },
      { status: 400 }
    );
  }

  const supabase = await supabaseServerClient();
  const viewer = await getPortfolioMembersViewerContext(supabase, portfolioId, user.id);
  if (!viewer?.canRemoveMembers) {
    return NextResponse.json(
      { error: "PERMISSION_DENIED", message: "Permission denied" },
      { status: 403 }
    );
  }

  const { data: row, error: fetchErr } = await supabase
    .from("portfolio_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("portfolio_id", portfolioId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const ownerCount = await countPortfolioOwners(supabase, portfolioId);
  if (row.role === "owner" && ownerCount <= 1) {
    return NextResponse.json(
      {
        error: "LAST_OWNER",
        message: "Cannot remove the last portfolio member with the owner role.",
      },
      { status: 400 }
    );
  }

  const { error: delErr } = await supabase
    .from("portfolio_members")
    .delete()
    .eq("id", memberId)
    .eq("portfolio_id", portfolioId);

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
