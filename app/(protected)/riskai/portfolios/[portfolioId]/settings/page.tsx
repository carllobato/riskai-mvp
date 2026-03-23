import { supabaseServerClient } from "@/lib/supabase/server";
import { assertPortfolioAdminAccess } from "@/lib/portfolios-server";
import { NotFoundContent } from "../../../../../not-found-content";
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
    return <NotFoundContent />;
  }

  const result = await assertPortfolioAdminAccess(
    portfolioId,
    supabase,
    user.id
  );

  if ("error" in result) {
    return <NotFoundContent />;
  }

  const { portfolio, ...memberCapabilities } = result;

  return (
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
  );
}
