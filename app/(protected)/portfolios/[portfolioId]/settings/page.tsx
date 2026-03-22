import { supabaseServerClient } from "@/lib/supabase/server";
import {
  assertPortfolioAdminAccess,
  type PortfolioMemberRow,
} from "@/lib/portfolios-server";
import { NotFoundContent } from "../../../../not-found-content";
import PortfolioSettingsContent from "../../../portfolio/PortfolioSettingsContent";

/** Portfolio settings: only owner or member with role 'admin' can access. */
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

  const { portfolio } = result;

  const { data: members, error: membersError } = await supabase
    .from("portfolio_members")
    .select("id, portfolio_id, user_id, role, created_at")
    .eq("portfolio_id", portfolioId)
    .order("created_at", { ascending: true });

  const memberList: PortfolioMemberRow[] = membersError ? [] : (members ?? []);

  return (
    <PortfolioSettingsContent
      portfolioId={portfolioId}
      initial={{
        name: portfolio.name,
        description: portfolio.description,
        owner_user_id: portfolio.owner_user_id,
        created_at: portfolio.created_at,
      }}
      members={memberList}
    />
  );
}
