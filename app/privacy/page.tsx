import type { Metadata } from "next";
import { PrivacyPolicyContent } from "@/components/legal/PrivacyPolicyContent";

export const metadata: Metadata = {
  title: "Privacy Policy — RiskAI by Visualify",
  description: "How Visualify handles your data when you use RiskAI.",
};

export default function PrivacyPage() {
  return (
    <main>
      <PrivacyPolicyContent />
    </main>
  );
}
