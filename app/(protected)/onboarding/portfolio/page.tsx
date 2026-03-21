import { redirect } from "next/navigation";

/** Portfolio onboarding runs as a modal in the protected shell; this route keeps old links working. */
export default function PortfolioOnboardingPage() {
  redirect("/");
}
