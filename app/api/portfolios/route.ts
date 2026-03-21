import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getAccessiblePortfolios } from "@/lib/portfolios-server";
import { supabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache",
  Pragma: "no-cache",
};

/**
 * POST /api/portfolios — Create a portfolio owned by the current user (RLS: owner_id = auth.uid()).
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawName =
    typeof body === "object" && body !== null && "name" in body
      ? (body as { name: unknown }).name
      : undefined;
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Portfolio name is required." }, { status: 400 });
  }

  const supabase = await supabaseServerClient();
  const { data, error } = await supabase
    .from("portfolios")
    .insert({ name, owner_id: user.id })
    .select("id, name, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ portfolio: data }, { status: 201, headers: CACHE_HEADERS });
}

/**
 * GET /api/portfolios — Returns portfolios the current user can access (owner or member).
 * Uses shared getAccessiblePortfolios() so behaviour matches the "/" home route.
 */
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const supabase = await supabaseServerClient();
  const result = await getAccessiblePortfolios(supabase, user.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ portfolios: result.portfolios }, {
    headers: CACHE_HEADERS,
  });
}
