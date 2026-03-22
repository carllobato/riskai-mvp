import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getAccessiblePortfolios } from "@/lib/portfolios-server";
import { getRiskAIProductId } from "@/lib/products";
import type { OnboardingPortfolioInsertPayload } from "@/lib/onboarding/types";
import { supabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache",
  Pragma: "no-cache",
};

/**
 * POST /api/portfolios — Create a portfolio owned by the current user (RLS: owner_user_id = auth.uid()).
 * Always attaches the RiskAI product from `public.products` (key = 'riskai'); `product_id` is never omitted.
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

  const rawCode =
    typeof body === "object" && body !== null && "code" in body
      ? (body as { code: unknown }).code
      : undefined;
  const codeTrimmed =
    typeof rawCode === "string" && rawCode.trim().length > 0 ? rawCode.trim() : undefined;

  const supabase = await supabaseServerClient();
  let productId: string;
  try {
    productId = await getRiskAIProductId(supabase);
  } catch {
    return NextResponse.json(
      { error: "RiskAI product not found in products table" },
      { status: 500 }
    );
  }

  const insertPayload: OnboardingPortfolioInsertPayload = {
    name,
    product_id: productId,
    owner_user_id: user.id,
    ...(codeTrimmed !== undefined ? { code: codeTrimmed } : {}),
  };

  const { data, error } = await supabase
    .from("portfolios")
    .insert(insertPayload)
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
