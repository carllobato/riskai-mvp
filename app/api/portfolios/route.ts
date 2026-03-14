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
