"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchPublicProfile } from "@/lib/profiles/profileDb";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { isOnboardingProfileComplete, isOnboardingWizardComplete } from "@/lib/onboarding/guards";
import { ACCOUNT_PROFILE_UPDATED_EVENT, OnboardingMetaKey } from "@/lib/onboarding/types";
import { AddProjectOnboardingModal } from "./AddProjectOnboardingModal";
import { PortfolioOnboardingDetailModal } from "./PortfolioOnboardingDetailModal";
import { PortfolioSetupModal } from "./PortfolioSetupModal";
import { ProfileSetupModal } from "./ProfileSetupModal";
import { ProjectOnboardingSetupModal } from "./ProjectOnboardingSetupModal";

type PortfolioRow = { id: string; name: string };

async function fetchPortfolios(): Promise<PortfolioRow[]> {
  try {
    const res = await fetch("/api/portfolios", { cache: "no-store" });
    const data = (await res.json()) as { portfolios?: PortfolioRow[] };
    return Array.isArray(data.portfolios) ? data.portfolios : [];
  } catch {
    return [];
  }
}

async function fetchProjects(): Promise<{ id: string }[]> {
  try {
    const res = await fetch("/api/projects", { cache: "no-store" });
    const data = (await res.json()) as { projects?: { id: string }[] };
    return Array.isArray(data.projects) ? data.projects : [];
  } catch {
    return [];
  }
}

/**
 * Central place for first-run onboarding UI. Flow: profile → portfolio name → (optional portfolio
 * details if named) or add project if skipped → project setup → dashboard.
 */
export function OnboardingHost() {
  const router = useRouter();
  const pathname = usePathname();
  const [profileGateTick, setProfileGateTick] = useState(0);
  const [ready, setReady] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [showPortfolioDetailModal, setShowPortfolioDetailModal] = useState(false);
  const [portfolioDetailId, setPortfolioDetailId] = useState<string | null>(null);
  const [portfolioDetailInitialName, setPortfolioDetailInitialName] = useState("");
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [addProjectPortfolioId, setAddProjectPortfolioId] = useState<string | null>(null);
  const [showProjectSetupModal, setShowProjectSetupModal] = useState(false);
  const [projectSetupId, setProjectSetupId] = useState<string | null>(null);
  const [projectSetupInitialName, setProjectSetupInitialName] = useState("");
  const [initialFirstName, setInitialFirstName] = useState("");
  const [initialLastName, setInitialLastName] = useState("");
  const [initialCompany, setInitialCompany] = useState("");
  const [initialRole, setInitialRole] = useState("");
  /** After creating a portfolio, user can go back from the detail step to this bridge UI. */
  const [portfolioPostCreateBridge, setPortfolioPostCreateBridge] = useState<{
    id: string;
    name: string;
  } | null>(null);
  /** Add-project step was opened after portfolio details (vs skip naming / skip detail). */
  const [addProjectEnteredFromDetail, setAddProjectEnteredFromDetail] = useState(false);
  /** Returning from project-setup step to re-open add-project without creating another row. */
  const [addProjectResume, setAddProjectResume] = useState<{ id: string; name: string } | null>(null);

  const markWizardCompleteIfHasProjects = useCallback(
    async (
      supabase: ReturnType<typeof supabaseBrowserClient>,
      projectCount: number,
      meta: Record<string, unknown> | undefined,
    ) => {
      if (projectCount === 0 || isOnboardingWizardComplete(meta)) return;
      await supabase.auth.updateUser({
        data: { [OnboardingMetaKey.wizardComplete]: true },
      });
      router.refresh();
    },
    [router],
  );

  const openStepsAfterProfile = useCallback(
    async (meta: Record<string, unknown> | undefined) => {
      const supabase = supabaseBrowserClient();
      const portfolios = await fetchPortfolios();
      const projects = await fetchProjects();

      if (projects.length > 0) {
        await markWizardCompleteIfHasProjects(supabase, projects.length, meta);
        return;
      }

      if (portfolios.length === 0) {
        setShowPortfolioModal(true);
        return;
      }

      setAddProjectPortfolioId(portfolios[0]!.id);
      setShowAddProjectModal(true);
    },
    [markWizardCompleteIfHasProjects],
  );

  useEffect(() => {
    const bump = () => setProfileGateTick((n) => n + 1);
    window.addEventListener(ACCOUNT_PROFILE_UPDATED_EVENT, bump);
    return () => window.removeEventListener(ACCOUNT_PROFILE_UPDATED_EVENT, bump);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = supabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) {
        if (!cancelled) setReady(true);
        return;
      }
      const meta = user.user_metadata as Record<string, unknown> | undefined;
      const profileRow = await fetchPublicProfile(supabase, user.id);

      if (!isOnboardingProfileComplete(meta, profileRow)) {
        setPortfolioPostCreateBridge(null);
        setAddProjectResume(null);
        setShowPortfolioModal(false);
        setShowPortfolioDetailModal(false);
        setShowAddProjectModal(false);
        setShowProjectSetupModal(false);
        const onSettingsRoute =
          pathname === "/settings" || (pathname?.startsWith("/settings/") ?? false);
        setInitialFirstName(
          typeof profileRow?.first_name === "string"
            ? profileRow.first_name
            : typeof meta?.first_name === "string"
              ? meta.first_name
              : "",
        );
        setInitialLastName(
          typeof profileRow?.surname === "string"
            ? profileRow.surname
            : typeof meta?.last_name === "string"
              ? meta.last_name
              : "",
        );
        setInitialCompany(
          typeof profileRow?.company === "string"
            ? profileRow.company
            : typeof meta?.company === "string"
              ? meta.company
              : "",
        );
        setInitialRole(
          typeof profileRow?.role === "string"
            ? profileRow.role
            : typeof meta?.role === "string"
              ? meta.role
              : "",
        );
        setShowProfileModal(!onSettingsRoute);
        setReady(true);
        return;
      }

      setShowProfileModal(false);

      if (isOnboardingWizardComplete(meta)) {
        setReady(true);
        return;
      }

      const projects = await fetchProjects();
      if (projects.length > 0) {
        await markWizardCompleteIfHasProjects(supabase, projects.length, meta);
        setReady(true);
        return;
      }

      const portfolios = await fetchPortfolios();
      if (portfolios.length === 0) {
        setPortfolioPostCreateBridge(null);
        setAddProjectResume(null);
        setShowPortfolioModal(true);
        setReady(true);
        return;
      }

      setPortfolioPostCreateBridge(null);
      setAddProjectResume(null);
      setAddProjectEnteredFromDetail(false);
      setAddProjectPortfolioId(portfolios[0]!.id);
      setShowAddProjectModal(true);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [markWizardCompleteIfHasProjects, pathname, profileGateTick]);

  const onProfileComplete = useCallback(async () => {
    const supabase = supabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    await openStepsAfterProfile(meta);
    setShowProfileModal(false);
    router.refresh();
  }, [openStepsAfterProfile, router]);

  const onBackFromPortfolioToProfile = useCallback(() => {
    setShowPortfolioModal(false);
    setPortfolioPostCreateBridge(null);
    setShowProfileModal(true);
    router.refresh();
  }, [router]);

  const onForwardPortfolioPostCreateBridge = useCallback(() => {
    setShowPortfolioModal(false);
    setPortfolioPostCreateBridge(null);
    setShowPortfolioDetailModal(true);
    router.refresh();
  }, [router]);

  const onBackFromPortfolioDetail = useCallback(() => {
    const id = portfolioDetailId;
    const name = portfolioDetailInitialName;
    setShowPortfolioDetailModal(false);
    if (id && name) {
      setPortfolioPostCreateBridge({ id, name });
    }
    setShowPortfolioModal(true);
    router.refresh();
  }, [portfolioDetailId, portfolioDetailInitialName, router]);

  const onPortfolioCreated = useCallback(
    async ({ id, name }: { id: string; name: string }) => {
      setPortfolioPostCreateBridge(null);
      setPortfolioDetailId(id);
      setPortfolioDetailInitialName(name);
      setShowPortfolioModal(false);
      setShowPortfolioDetailModal(true);
      router.refresh();
    },
    [router],
  );

  const onPortfolioSkipped = useCallback(
    async ({ portfolioId }: { portfolioId: string }) => {
      setPortfolioPostCreateBridge(null);
      setAddProjectEnteredFromDetail(false);
      setShowPortfolioModal(false);
      setAddProjectPortfolioId(portfolioId);
      setShowAddProjectModal(true);
      router.refresh();
    },
    [router],
  );

  const onPortfolioDetailContinue = useCallback(() => {
    const pid = portfolioDetailId;
    setShowPortfolioDetailModal(false);
    if (pid) {
      setAddProjectEnteredFromDetail(true);
      setAddProjectPortfolioId(pid);
      setAddProjectResume(null);
      setShowAddProjectModal(true);
    }
    router.refresh();
  }, [portfolioDetailId, router]);

  const onBackFromAddProject = useCallback(() => {
    setShowAddProjectModal(false);
    setAddProjectResume(null);
    if (addProjectEnteredFromDetail) {
      setShowPortfolioDetailModal(true);
    } else {
      setPortfolioPostCreateBridge(null);
      setShowPortfolioModal(true);
    }
    router.refresh();
  }, [addProjectEnteredFromDetail, router]);

  const onBackFromAddProjectResume = useCallback(() => {
    setAddProjectResume(null);
    setShowAddProjectModal(false);
    if (addProjectEnteredFromDetail) {
      setShowPortfolioDetailModal(true);
    } else {
      setShowPortfolioModal(true);
    }
    router.refresh();
  }, [addProjectEnteredFromDetail, router]);

  const onAddProjectCreated = useCallback(
    async ({ id, name }: { id: string; name: string }) => {
      setAddProjectResume(null);
      setShowAddProjectModal(false);
      setProjectSetupId(id);
      setProjectSetupInitialName(name);
      setShowProjectSetupModal(true);
      router.refresh();
    },
    [router],
  );

  const onBackFromProjectSetup = useCallback(() => {
    const id = projectSetupId;
    const name = projectSetupInitialName;
    if (!id) return;
    setShowProjectSetupModal(false);
    setAddProjectResume({ id, name });
    setShowAddProjectModal(true);
    router.refresh();
  }, [projectSetupId, projectSetupInitialName, router]);

  const onProjectSetupFinished = useCallback(() => {
    setShowProjectSetupModal(false);
    setProjectSetupId(null);
    setAddProjectResume(null);
    router.replace("/");
    router.refresh();
  }, [router]);

  if (!ready) return null;

  return (
    <>
      <ProfileSetupModal
        open={showProfileModal}
        initialFirstName={initialFirstName}
        initialLastName={initialLastName}
        initialCompany={initialCompany}
        initialRole={initialRole}
        onComplete={onProfileComplete}
      />
      <PortfolioSetupModal
        open={showPortfolioModal}
        postCreateBridge={portfolioPostCreateBridge}
        onBackToProfile={onBackFromPortfolioToProfile}
        onForwardFromPostCreateBridge={onForwardPortfolioPostCreateBridge}
        onCreated={onPortfolioCreated}
        onSkipped={onPortfolioSkipped}
      />
      {portfolioDetailId ? (
        <PortfolioOnboardingDetailModal
          open={showPortfolioDetailModal}
          portfolioId={portfolioDetailId}
          initialName={portfolioDetailInitialName}
          onContinue={onPortfolioDetailContinue}
          onBack={onBackFromPortfolioDetail}
        />
      ) : null}
      <AddProjectOnboardingModal
        open={showAddProjectModal}
        portfolioId={addProjectPortfolioId}
        resumeProject={addProjectResume}
        onCreated={onAddProjectCreated}
        onBack={addProjectResume ? onBackFromAddProjectResume : onBackFromAddProject}
      />
      <ProjectOnboardingSetupModal
        open={showProjectSetupModal}
        projectId={projectSetupId}
        initialName={projectSetupInitialName}
        onComplete={onProjectSetupFinished}
        onBack={onBackFromProjectSetup}
      />
    </>
  );
}
