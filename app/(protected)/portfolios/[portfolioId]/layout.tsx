import { supabaseServerClient } from "@/lib/supabase/server";
import { PortfolioPageHeader } from "@/components/PortfolioPageHeader";
import { NotFoundContent } from "../../../not-found-content";

export default async function PortfolioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const supabase = await supabaseServerClient();

  const { data: portfolio, error } = await supabase
    .from("portfolios")
    .select("id, name")
    .eq("id", portfolioId)
    .single();

  if (error || !portfolio) {
    return <NotFoundContent />;
  }

  return (
    <>
      <PortfolioPageHeader portfolioId={portfolioId} portfolioName={portfolio.name} />
      {children}
    </>
  );
}
