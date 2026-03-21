import Link from "next/link";
import { LegalBulletList, LegalSection, legalBodyClass, legalInlineLinkClass, legalSubheadClass } from "./LegalDocumentSections";

export function TermsContent({ fullWidth = false, inModal = false }: { fullWidth?: boolean; inModal?: boolean }) {
  return (
    <div
      className={`${
        inModal
          ? "mx-auto w-full max-w-prose px-8 pb-8 pt-6 sm:px-10 sm:pb-10 sm:pt-7"
          : fullWidth
            ? "w-full px-4 pb-12 pt-4 sm:px-6 sm:pb-16 sm:pt-6"
            : "mx-auto max-w-[700px] px-4 pb-12 pt-4 sm:px-6 sm:pb-16 sm:pt-6"
      }`}
    >
      {!inModal && (
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-[1.65rem] sm:leading-snug">
            Terms &amp; Conditions
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 sm:text-[15px]">Rules for using Visualify and RiskAI</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-500">Effective date: March 21, 2026</p>
        </header>
      )}

      <div className={`${inModal ? "mt-0" : "mt-5"} space-y-3 ${legalBodyClass}`}>
        <p>
          These terms govern your use of RiskAI, a product offered by Visualify (&quot;we&quot;, &quot;us&quot;). By
          accessing or using the service, you agree to them. If you don&apos;t agree, don&apos;t use RiskAI.
        </p>
      </div>

      <div className={inModal ? "mt-7 space-y-8 sm:mt-8 sm:space-y-9" : "mt-5 space-y-5 sm:mt-6 sm:space-y-6"}>
        <LegalSection title="1. The service" inModal={inModal}>
          <p>
            RiskAI is a software platform for risk-related workflows, analysis, and collaboration. We may update,
            change, or discontinue features to improve security, reliability, or the product experience.
          </p>
        </LegalSection>

        <LegalSection title="2. Your account" inModal={inModal}>
          <p>You&apos;re responsible for:</p>
          <LegalBulletList
            items={[
              "Keeping your login credentials confidential",
              "All activity under your account, unless you tell us promptly about unauthorised access",
              "Providing accurate information when you sign up or use the product",
            ]}
          />
          <p>You must be legally able to enter a binding agreement to use the service.</p>
        </LegalSection>

        <LegalSection title="3. Acceptable use" inModal={inModal}>
          <p>You agree not to misuse RiskAI. For example, you won&apos;t:</p>
          <LegalBulletList
            items={[
              "Break the law, infringe others&apos; rights, or upload content you&apos;re not allowed to process",
              "Probe, scan, or attack our systems, or interfere with other users",
              "Reverse engineer or try to extract our models or source code except where the law allows",
              "Use the service to build a competing product or resell access without our written consent",
            ]}
          />
        </LegalSection>

        <LegalSection title="4. AI and automated outputs" inModal={inModal}>
          <p>
            Parts of RiskAI use artificial intelligence. Outputs are generated automatically and are provided for
            assistance only—they are not professional advice (legal, financial, medical, or otherwise).
          </p>
          <div className="space-y-2.5">
            <h3 className={legalSubheadClass}>What you should expect</h3>
            <LegalBulletList
              items={[
                "AI results can be wrong, incomplete, or outdated. You must review and validate outputs before relying on them for decisions.",
                "You are solely responsible for how you use AI-generated content in your business or compliance context.",
                "We do not guarantee that outputs will meet your requirements or be free from bias or error.",
              ]}
            />
          </div>
          <p>
            To the fullest extent permitted by law, we are not liable for any loss or damage arising from your use of or
            reliance on AI outputs, including decisions you make based on them.
          </p>
        </LegalSection>

        <LegalSection title="5. Your content and licence" inModal={inModal}>
          <p>You retain ownership of content you submit. You grant us a licence to host, process, and display that content only to provide and improve the service for you, as described in our Privacy Policy.</p>
        </LegalSection>

        <LegalSection title="6. Our intellectual property" inModal={inModal}>
          <p>
            Visualify and RiskAI names, branding, software, and documentation are ours or our licensors&apos;. Except
            for the limited rights we grant you to use the service, no rights are transferred to you.
          </p>
        </LegalSection>

        <LegalSection title="7. Disclaimers" inModal={inModal}>
          <p>
            The service is provided &quot;as is&quot; and &quot;as available&quot;. We don&apos;t warrant uninterrupted
            or error-free operation, or that the service will meet every use case. Where the law doesn&apos;t allow
            certain disclaimers, they apply only to the extent permitted.
          </p>
        </LegalSection>

        <LegalSection title="8. Limitation of liability" inModal={inModal}>
          <p>
            To the maximum extent permitted by law, we (and our suppliers) are not liable for indirect, incidental,
            special, consequential, or punitive damages, or for loss of profits, data, or goodwill.
          </p>
          <p>
            Our total liability for any claim relating to the service is limited to the greater of (a) what you paid us
            for RiskAI in the twelve months before the claim, or (b) one hundred Australian dollars (AUD $100), except
            where the law requires otherwise.
          </p>
        </LegalSection>

        <LegalSection title="9. Indemnity" inModal={inModal}>
          <p>
            You&apos;ll defend and hold us harmless from claims brought by third parties that arise from your content,
            your misuse of the service, or your breach of these terms—subject to our prompt notice and reasonable
            cooperation.
          </p>
        </LegalSection>

        <LegalSection title="10. Suspension and termination" inModal={inModal}>
          <p>
            We may suspend or end access if you breach these terms, if we must for legal or security reasons, or if we
            wind down the product with reasonable notice where practicable. You may stop using RiskAI at any time.
            Provisions that should survive (such as liability limits and IP) continue after termination.
          </p>
        </LegalSection>

        <LegalSection title="11. Changes" inModal={inModal}>
          <p>
            We may update these terms. We&apos;ll post the new version here and adjust the effective date. Material
            changes may be communicated by email or in-product notice. Continued use after the effective date means you
            accept the update.
          </p>
        </LegalSection>

        <LegalSection title="12. Governing law" inModal={inModal}>
          <p>These terms are governed by the laws of Australia. Courts in Australia have non-exclusive jurisdiction over disputes, unless mandatory consumer protections in your country say otherwise.</p>
        </LegalSection>

        <LegalSection title="13. Contact" inModal={inModal}>
          <p>Questions about these terms:</p>
          <p className="space-y-2">
            <span className="block">
              Email:{" "}
              <a href="mailto:help@visualify.com.au" className={legalInlineLinkClass}>
                help@visualify.com.au
              </a>
            </span>
            <span className="block">
              Website:{" "}
              <Link href="https://visualify.com.au" className={legalInlineLinkClass}>
                visualify.com.au
              </Link>
            </span>
          </p>
        </LegalSection>
      </div>
    </div>
  );
}
