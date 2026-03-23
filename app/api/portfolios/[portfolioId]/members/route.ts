import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  authEmailMapFromRpcRows,
  isMemberAuthEmailsRpcMissing,
  memberAuthEmailLookup,
} from "@/lib/db/memberAuthEmailsMap";
import { getPortfolioMembersViewerContext } from "@/lib/db/portfolioMemberAccess";
import { coerceProfileFromUnknown } from "@/lib/profileDisplayCoerce";
import type { ProfileDisplayRow } from "@/types/projectMembers";
import type {
  PortfolioMemberRole,
  PortfolioMemberWithProfileRow,
} from "@/types/portfolioMembers";
import { firstRpcTableRow } from "@/lib/supabase/rpcTableFirstRow";
import { supabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const ROLES: PortfolioMemberRole[] = ["owner", "editor", "viewer"];

function isRole(v: unknown): v is PortfolioMemberRole {
  return typeof v === "string" && (ROLES as string[]).includes(v);
}

function portfolioInviteDebugEnabled() {
  return process.env.NODE_ENV === "development" || env.PORTFOLIO_INVITE_DEBUG;
}

function portfolioInviteTraceResponse(body: unknown, status: number) {
  if (portfolioInviteDebugEnabled()) {
    console.warn("[portfolio-invite] final response", { status, body });
  }
  return NextResponse.json(body, { status });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ portfolioId: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { portfolioId } = await context.params;
  if (!portfolioId) {
    return NextResponse.json({ error: "Portfolio ID required" }, { status: 400 });
  }

  const supabase = await supabaseServerClient();
  const viewer = await getPortfolioMembersViewerContext(supabase, portfolioId, user.id);
  if (!viewer) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const { data: members, error: mErr } = await supabase
    .from("portfolio_members")
    .select("id, portfolio_id, user_id, role, created_at")
    .eq("portfolio_id", portfolioId)
    .order("created_at", { ascending: true });

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  const rawRows = (members ?? []) as Record<string, unknown>[];

  if (portfolioInviteDebugEnabled()) {
    console.warn("[portfolio-members] GET raw portfolio_members rows", {
      portfolioId,
      count: rawRows.length,
      rows: rawRows,
    });
  }

  let shaped: PortfolioMemberWithProfileRow[] = rawRows.map((raw) => ({
    id: raw.id as string,
    portfolio_id: raw.portfolio_id as string,
    user_id: raw.user_id as string,
    role: String(raw.role ?? ""),
    created_at: raw.created_at as string,
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
      "riskai_portfolio_member_auth_emails",
      { p_portfolio_id: portfolioId, p_user_ids: memberUserIds }
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
    if (portfolioInviteDebugEnabled()) {
      console.warn("[portfolio-members] GET auth email RPC", {
        portfolioId,
        authErr: authErr
          ? { message: authErr.message, code: authErr.code, details: authErr.details, hint: authErr.hint }
          : null,
        rawAuthRows: authRows,
        authEmailsMap: authEmails,
      });
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

  if (portfolioInviteDebugEnabled()) {
    const sample = shaped.find((r) => r.email) ?? shaped[0];
    console.warn("[portfolio-members] GET merged payload sample", {
      portfolioId,
      memberCount: shaped.length,
      sampleMember: sample ?? null,
    });
  }

  return NextResponse.json({
    members: shaped,
    profiles,
    viewer,
    roleSemantics: {
      owner: "Edit portfolio details, invite, and manage member roles",
      editor: "Invite members; cannot edit portfolio details or manage roles",
      viewer: "View settings and members only",
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ portfolioId: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { portfolioId } = await context.params;
  if (!portfolioId) {
    return portfolioInviteTraceResponse({ error: "Portfolio ID required" }, 400);
  }

  const supabase = await supabaseServerClient();
  const viewer = await getPortfolioMembersViewerContext(supabase, portfolioId, user.id);
  if (!viewer) {
    return portfolioInviteTraceResponse({ error: "Portfolio not found" }, 404);
  }
  if (!viewer.canInviteMembers) {
    return portfolioInviteTraceResponse({ error: "Permission denied" }, 403);
  }

  let body: { email?: unknown; role?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; role?: unknown };
  } catch {
    return portfolioInviteTraceResponse({ error: "Invalid JSON" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    return portfolioInviteTraceResponse({ error: "Email is required" }, 400);
  }
  if (!isRole(body.role)) {
    return portfolioInviteTraceResponse({ error: "Invalid role" }, 400);
  }
  const role = body.role;

  const { data: found, error: rpcErr } = await supabase.rpc(
    "riskai_find_profile_by_email_for_portfolio",
    { p_email: email, p_portfolio_id: portfolioId }
  );

  if (portfolioInviteDebugEnabled()) {
    console.warn("[portfolio-invite] raw RPC result", {
      email,
      portfolioId,
      rpcErr: rpcErr
        ? { message: rpcErr.message, code: rpcErr.code, details: rpcErr.details, hint: rpcErr.hint }
        : null,
      rawRpc: found,
      rawRpcType: found === null ? "null" : Array.isArray(found) ? "array" : typeof found,
    });
  }

  if (rpcErr) {
    const msg = rpcErr.message?.toLowerCase() ?? "";
    if (msg.includes("permission") || msg.includes("policy") || msg.includes("denied")) {
      return portfolioInviteTraceResponse(
        { error: "PERMISSION_DENIED", message: "Permission denied" },
        403
      );
    }
    return portfolioInviteTraceResponse({ error: rpcErr.message }, 500);
  }

  const match = firstRpcTableRow(found);

  const rpcUserIdRaw = match?.user_id ?? match?.id;

  if (portfolioInviteDebugEnabled()) {
    const idParsed =
      rpcUserIdRaw == null
        ? null
        : typeof rpcUserIdRaw === "string"
          ? rpcUserIdRaw
          : String(rpcUserIdRaw);
    console.warn("[portfolio-invite] parsed lookup row", {
      parsedRow: match,
      parsedUserId: idParsed,
      parsedAlreadyMember: match?.already_member === true,
    });
  }

  if (!match || rpcUserIdRaw == null) {
    return portfolioInviteTraceResponse(
      {
        error: "USER_NOT_FOUND",
        message: "User not found. They need to sign up first.",
      },
      404
    );
  }

  const newUserId = typeof rpcUserIdRaw === "string" ? rpcUserIdRaw : String(rpcUserIdRaw);
  const profileRow = {
    id: newUserId,
    already_member: match.already_member === true,
  };
  if (profileRow.already_member === true) {
    return portfolioInviteTraceResponse(
      {
        error: "DUPLICATE_MEMBER",
        message: "This user is already a member of the portfolio.",
      },
      409
    );
  }

  const insertPayload = {
    portfolio_id: portfolioId,
    user_id: profileRow.id,
    role,
  };

  if (portfolioInviteDebugEnabled()) {
    console.warn("[portfolio-invite] insert payload", insertPayload);
  }

  const { data: inserted, error: insErr } = await supabase
    .from("portfolio_members")
    .insert(insertPayload)
    .select("id, portfolio_id, user_id, role, created_at")
    .single();

  if (portfolioInviteDebugEnabled()) {
    console.warn("[portfolio-invite] insert result", {
      insertPayload,
      inserted,
      insertError: insErr
        ? {
            code: insErr.code,
            message: insErr.message,
            details: insErr.details,
            hint: insErr.hint,
          }
        : null,
    });
  }

  if (insErr) {
    if (insErr.code === "23505") {
      return portfolioInviteTraceResponse(
        {
          error: "DUPLICATE_MEMBER",
          message: "This user is already a member of the portfolio.",
        },
        409
      );
    }
    if (insErr.code === "42501" || insErr.message?.toLowerCase().includes("policy")) {
      return portfolioInviteTraceResponse(
        { error: "PERMISSION_DENIED", message: "Permission denied" },
        403
      );
    }
    return portfolioInviteTraceResponse({ error: insErr.message }, 500);
  }

  return portfolioInviteTraceResponse({ member: inserted }, 200);
}
