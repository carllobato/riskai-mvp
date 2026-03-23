import { redirect } from "next/navigation";
import { DASHBOARD_PATH } from "@/lib/routes";

/** RiskAI app root: send users to the dashboard. */
export default function RiskaiAppRootPage() {
  redirect(DASHBOARD_PATH);
}
