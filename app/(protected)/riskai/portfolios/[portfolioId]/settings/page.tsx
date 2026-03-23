import { RegisterPageHeaderTitle } from "@/components/RegisterPageHeaderTitle";
import { redirect } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabase/server";
import { assertPortfolioAdminAccess } from "@/lib/portfolios-server";
import { riskaiPath } from "@/lib/routes";
import PortfolioSettingsContent from "../../../portfolio/PortfolioSettingsContent";

/** Portfolio settings: table owner or any portfolio member (owner / editor / viewer); non-members denied. */
export default async function PortfolioSettingsPage({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(riskaiPath("/not-found"));
  }

  const result = await assertPortfolioAdminAccess(
    portfolioId,
    supabase,
    user.id
  );

  if ("error" in result) {
    redirect(riskaiPath("/not-found"));
  }

  const { portfolio, ...memberCapabilities } = result;

  return (
    <>
      <RegisterPageHeaderTitle titleSuffix="Settings" />
      <PortfolioSettingsContent
        portfolioId={portfolioId}
        memberCapabilities={memberCapabilities}
        initial={{
          name: portfolio.name,
          description: portfolio.description,
          owner_user_id: portfolio.owner_user_id,
          created_at: portfolio.created_at,
        }}
      />
    </>
  );
}
