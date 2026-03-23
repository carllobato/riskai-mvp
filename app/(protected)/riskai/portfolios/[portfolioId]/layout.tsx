import { supabaseServerClient } from "@/lib/supabase/server";
import { PortfolioPageHeader } from "@/components/PortfolioPageHeader";
import { PageHeaderExtrasProvider } from "@/contexts/PageHeaderExtrasContext";
import { redirect } from "next/navigation";
import { riskaiPath } from "@/lib/routes";

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
    redirect(riskaiPath("/not-found"));
  }

  return (
    <PageHeaderExtrasProvider>
      <PortfolioPageHeader portfolioId={portfolioId} portfolioName={portfolio.name} />
      {children}
    </PageHeaderExtrasProvider>
  );
}
