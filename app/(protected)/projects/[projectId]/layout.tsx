import { redirect } from "next/navigation";
import { assertProjectAccess } from "@/lib/auth/assertProjectAccess";
import { PageHeader } from "@/components/PageHeader";
import { SetActiveProjectClient } from "./SetActiveProjectClient";
import { supabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ACTIVE_PROJECT_KEY = "activeProjectId";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const access = await assertProjectAccess(projectId);
  if ("error" in access && access.error === "unauthorized") {
    redirect("/login");
  }
  if ("error" in access && access.error === "forbidden") {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[projects] access denied or not found", { projectId });
    }
    redirect("/project-not-found");
  }

  const { project } = access;
  let portfolioId: string | null = null;
  let portfolioName: string | null = null;
  const supabase = await supabaseServerClient();
  const { data: projectRow } = await supabase
    .from("projects")
    .select("portfolio_id")
    .eq("id", projectId)
    .single();
  if (projectRow?.portfolio_id) {
    portfolioId = projectRow.portfolio_id;
    const { data: portfolio } = await supabase
      .from("portfolios")
      .select("name")
      .eq("id", projectRow.portfolio_id)
      .single();
    portfolioName = portfolio?.name ?? null;
  }

  return (
    <>
      <SetActiveProjectClient projectId={projectId} storageKey={ACTIVE_PROJECT_KEY} />
      <PageHeader
        projectId={projectId}
        projectName={project.name}
        portfolioId={portfolioId}
        portfolioName={portfolioName}
      />
      {children}
    </>
  );
}
