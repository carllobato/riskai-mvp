import Link from "next/link";
import { LegalBulletList, LegalSection, legalBodyClass, legalInlineLinkClass, legalSubheadClass } from "./LegalDocumentSections";

export function PrivacyPolicyContent({ fullWidth = false, inModal = false }: { fullWidth?: boolean; inModal?: boolean }) {
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
            Privacy Policy
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 sm:text-[15px]">How Visualify handles your data</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-500">Effective date: March 21, 2026</p>
        </header>
      )}

      <div className={`${inModal ? "mt-0" : "mt-5"} space-y-3 ${legalBodyClass}`}>
        <p>
          RiskAI is a product of Visualify. This policy describes what we collect when you use the service, how we use
          it, and the choices you have. If anything here doesn't match how we operate, contact us—we'll make it right.
        </p>
      </div>

      <div className={inModal ? "mt-7 space-y-8 sm:mt-8 sm:space-y-9" : "mt-5 space-y-5 sm:mt-6 sm:space-y-6"}>
        <LegalSection title="1. What we collect" inModal={inModal}>
          <p>We limit collection to what we need to run your account, deliver RiskAI, and keep the product reliable.</p>
          <div className="space-y-2.5">
            <h3 className={legalSubheadClass}>Account information</h3>
            <p>Name, email, company or organisation, and similar details you provide when you sign up or update your profile.</p>
          </div>
          <div className="space-y-2.5">
            <h3 className={legalSubheadClass}>Product usage</h3>
            <p>
              How you use RiskAI—such as features accessed, session activity, and product analytics. We may also collect
              device and browser information needed for security, debugging, and performance.
            </p>
          </div>
          <div className="space-y-2.5">
            <h3 className={legalSubheadClass}>Workspace data</h3>
            <p>Content you add to the product, including:</p>
            <LegalBulletList
              items={[
                "Projects and risk registers",
                "Simulation inputs and outputs",
                "Files and documents you upload",
              ]}
            />
          </div>
        </LegalSection>

        <LegalSection title="2. Why we use this information" inModal={inModal}>
          <p>We process data to:</p>
          <LegalBulletList
            items={[
              "Provide, operate, and improve RiskAI",
              "Authenticate accounts and help prevent abuse",
              "Run simulations, analytics, and reporting you request",
              "Respond to support requests",
              "Monitor reliability, performance, and security",
            ]}
          />
          <p>
            We do not sell your personal information. We do not use your workspace data to train models for unrelated
            products.
          </p>
        </LegalSection>

        <LegalSection title="3. AI features and your content" inModal={inModal}>
          <p>Some capabilities use AI to help analyse, organise, or generate insights from your data.</p>
          <p>When you use those features:</p>
          <LegalBulletList
            items={[
              "Inputs may be processed by vetted third-party AI providers under strict agreements",
              "Outputs are generated automatically and may be incomplete or inaccurate—review before relying on them",
              "You are responsible for ensuring you're allowed to upload and process any sensitive or third-party information",
            ]}
          />
        </LegalSection>

        <LegalSection title="4. Service providers and locations" inModal={inModal}>
          <p>
            We use trusted infrastructure partners (for example hosting, databases, authentication, email, and AI
            services). They process data on our behalf only as needed to run RiskAI.
          </p>
          <p>
            Some providers may process or store data outside Australia. We limit access to what's necessary and use
            contractual safeguards where appropriate.
          </p>
        </LegalSection>

        <LegalSection title="5. Security" inModal={inModal}>
          <p>We apply administrative, technical, and organisational measures intended to protect your information, including:</p>
          <LegalBulletList items={["Access controls and least-privilege practices", "Encryption in transit", "Secure infrastructure and monitoring"]} />
          <p>
            No online service is perfectly secure. If we learn of an incident that affects you, we'll notify you when
            required by law and handle it according to our security practices.
          </p>
        </LegalSection>

        <LegalSection title="6. Your choices" inModal={inModal}>
          <p>You can:</p>
          <LegalBulletList
            items={[
              "Access and update your account details",
              "Request deletion of your account and associated data (we may retain certain records where the law requires)",
              "Reach out with privacy questions or requests",
            ]}
          />
        </LegalSection>

        <LegalSection title="7. Contact" inModal={inModal}>
          <p>Privacy questions or requests:</p>
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
