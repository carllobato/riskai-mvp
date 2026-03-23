import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getPortfolioMembersViewerContext } from "@/lib/db/portfolioMemberAccess";
import { supabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache",
  Pragma: "no-cache",
};

/**
 * GET /api/projects — Returns projects the user can access (id, name, created_at) ordered by created_at asc.
 * Used by home redirect to resolve last-active or first project. Rows are filtered by RLS (owner,
 * project_members, portfolio).
 */
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const supabase = await supabaseServerClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ projects: projects ?? [] }, {
    headers: CACHE_HEADERS,
  });
}

type CreateProjectBody = {
  name?: unknown;
  portfolioId?: unknown;
};

async function resolveCreatablePortfolioIdForUser(
  userId: string,
  preferredPortfolioId?: string
): Promise<{ portfolioId: string } | { error: "not_found" | "forbidden" }> {
  const supabase = await supabaseServerClient();

  if (preferredPortfolioId) {
    const viewer = await getPortfolioMembersViewerContext(supabase, preferredPortfolioId, userId);
    if (!viewer) return { error: "not_found" };
    if (!viewer.canInviteMembers) return { error: "forbidden" };
    return { portfolioId: preferredPortfolioId };
  }

  const { data: ownedPortfolios, error: ownedErr } = await supabase
    .from("portfolios")
    .select("id, created_at")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true });
  if (ownedErr) return { error: "not_found" };
  if ((ownedPortfolios ?? []).length > 0) {
    return { portfolioId: ownedPortfolios![0]!.id as string };
  }

  const { data: editableMemberships, error: memberErr } = await supabase
    .from("portfolio_members")
    .select("portfolio_id, created_at")
    .eq("user_id", userId)
    .in("role", ["owner", "editor", "admin"])
    .order("created_at", { ascending: true });
  if (memberErr) return { error: "not_found" };
  if ((editableMemberships ?? []).length > 0) {
    return { portfolioId: editableMemberships![0]!.portfolio_id as string };
  }

  const { data: viewerMemberships, error: viewerErr } = await supabase
    .from("portfolio_members")
    .select("portfolio_id")
    .eq("user_id", userId)
    .limit(1);
  if (!viewerErr && (viewerMemberships ?? []).length > 0) {
    return { error: "forbidden" };
  }

  return { error: "not_found" };
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  let body: CreateProjectBody;
  try {
    body = (await request.json()) as CreateProjectBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Project name is required." }, { status: 400 });
  }

  const portfolioId =
    typeof body.portfolioId === "string" && body.portfolioId.trim().length > 0
      ? body.portfolioId.trim()
      : undefined;

  const target = await resolveCreatablePortfolioIdForUser(user.id, portfolioId);
  if ("error" in target) {
    if (target.error === "forbidden") {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const supabase = await supabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      owner_user_id: user.id,
      name,
      portfolio_id: target.portfolioId,
    })
    .select("id, name, portfolio_id, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Project already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project: data }, { status: 201, headers: CACHE_HEADERS });
}
