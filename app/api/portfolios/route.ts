import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/portfolios — Returns portfolios the current user can access (owner or member).
 * RLS on portfolios restricts to owner_id = auth.uid() OR membership in portfolio_members.
 */
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const supabase = await supabaseServerClient();
  const { data: portfolios, error } = await supabase
    .from("portfolios")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ portfolios: portfolios ?? [] });
}
