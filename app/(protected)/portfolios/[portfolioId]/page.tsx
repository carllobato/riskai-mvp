import { redirect } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabase/server";
import { NotFoundContent } from "../../../not-found-content";

/**
 * Handles /portfolios/[portfolioId] (no sub-path). Valid portfolio → redirect to
 * projects. Invalid or no access → render 404 inline (redirect to /404 can cause bad render).
 */
export default async function PortfolioIdPage({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const supabase = await supabaseServerClient();

  const { data: portfolio, error } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .single();

  if (error || !portfolio) {
    return <NotFoundContent />;
  }

  redirect(`/portfolios/${portfolioId}/projects`);
}
