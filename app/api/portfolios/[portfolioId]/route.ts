import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { assertPortfolioAdminAccess } from "@/lib/portfolios-server";
import { supabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/portfolios/[portfolioId] — Portfolio row if the user may access settings (member or table owner).
 */
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
  const result = await assertPortfolioAdminAccess(portfolioId, supabase, user.id);

  if ("error" in result) {
    if (result.error === "not_found") {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    ...result.portfolio,
    canEditPortfolioDetails: result.canEditPortfolioDetails,
  });
}

/**
 * PATCH /api/portfolios/[portfolioId] — Update name/description. Owner-level only (not editors/viewers).
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ portfolioId: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { portfolioId } = await context.params;
  if (!portfolioId) {
    return NextResponse.json({ error: "Portfolio ID required" }, { status: 400 });
  }

  const supabase = await supabaseServerClient();
  const result = await assertPortfolioAdminAccess(portfolioId, supabase, user.id);

  if ("error" in result) {
    if (result.error === "not_found") {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!result.canEditPortfolioDetails) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { name?: string; description?: string };
  try {
    body = (await request.json()) as { name?: string; description?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const description =
    body?.description === null || typeof body?.description === "string"
      ? (body.description === null ? null : body.description.trim() || null)
      : undefined;

  if (name === undefined && description === undefined) {
    return NextResponse.json(
      { error: "Provide at least one of name or description" },
      { status: 400 }
    );
  }

  const updates: { name?: string; description?: string | null } = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;

  const { error } = await supabase
    .from("portfolios")
    .update(updates)
    .eq("id", portfolioId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: portfolioId,
    name: name ?? result.portfolio.name,
    description: description !== undefined ? description : result.portfolio.description,
  });
}
