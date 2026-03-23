/**
 * Mock data for Portfolio Overview (UI scaffolding). Replace with Supabase when wiring live data.
 */

export type PortfolioSummary = {
  projectCount: number;
  activeProjectCount: number;
  activeRisks: number;
  highRisks: number;
  contingencyHeld: number;
  riskExposure: number;
  coverageRatio: number;
  topCostRisks: {
    id: string;
    title: string;
    projectName: string;
    value: number;
    status?: string;
  }[];
  topScheduleRisks: {
    id: string;
    title: string;
    projectName: string;
    impactDays: number;
  }[];
};

export const MOCK_PORTFOLIO_SUMMARY: PortfolioSummary = {
  projectCount: 12,
  activeProjectCount: 10,
  activeRisks: 47,
  highRisks: 8,
  contingencyHeld: 124_500_000,
  riskExposure: 92_200_000,
  coverageRatio: 1.35,
  topCostRisks: [
    {
      id: "cr-1",
      title: "Supply chain delay – critical path materials",
      projectName: "Northgate Phase 2",
      value: 8_200_000,
      status: "Open",
    },
    {
      id: "cr-2",
      title: "Labour escalation – skilled trades",
      projectName: "Riverside Tower",
      value: 5_400_000,
      status: "Mitigating",
    },
    {
      id: "cr-3",
      title: "Design change – MEP coordination",
      projectName: "West Campus",
      value: 4_100_000,
      status: "Open",
    },
    {
      id: "cr-4",
      title: "Weather delay – foundation works",
      projectName: "Harbour View",
      value: 3_600_000,
    },
    {
      id: "cr-5",
      title: "Regulatory approval – environmental",
      projectName: "Northgate Phase 2",
      value: 2_900_000,
      status: "Open",
    },
  ],
  topScheduleRisks: [
    {
      id: "sr-1",
      title: "Supply chain delay – critical path materials",
      projectName: "Northgate Phase 2",
      impactDays: 45,
    },
    {
      id: "sr-2",
      title: "Design change – MEP coordination",
      projectName: "West Campus",
      impactDays: 32,
    },
    {
      id: "sr-3",
      title: "Regulatory approval – environmental",
      projectName: "Northgate Phase 2",
      impactDays: 28,
    },
    {
      id: "sr-4",
      title: "Labour shortage – specialist subcontractor",
      projectName: "Riverside Tower",
      impactDays: 21,
    },
    {
      id: "sr-5",
      title: "Permit delay – local authority",
      projectName: "Harbour View",
      impactDays: 18,
    },
  ],
};
