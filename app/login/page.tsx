import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAppHost } from "@/lib/host";
import { LoginPageShell } from "./LoginPageShell";

/** Sign-in on the marketing host only; app host uses `/` (see app/page.tsx). */
export default async function LoginPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  if (isAppHost(host)) {
    redirect("/");
  }
  return <LoginPageShell />;
}
