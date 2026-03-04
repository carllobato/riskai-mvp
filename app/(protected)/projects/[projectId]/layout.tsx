import { redirect } from "next/navigation";
import { assertProjectAccess } from "@/lib/auth/assertProjectAccess";
import { SetActiveProjectClient } from "./SetActiveProjectClient";

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
    redirect("/");
  }

  return (
    <>
      <SetActiveProjectClient projectId={projectId} storageKey={ACTIVE_PROJECT_KEY} />
      {children}
    </>
  );
}
