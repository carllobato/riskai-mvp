import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/riskai/dashboard",
        permanent: true,
      },
      {
        source: "/dashboard/:path*",
        destination: "/riskai/dashboard/:path*",
        permanent: true,
      },
      {
        source: "/portfolios/:path*",
        destination: "/riskai/portfolios/:path*",
        permanent: true,
      },
      {
        source: "/projects/:path*",
        destination: "/riskai/projects/:path*",
        permanent: true,
      },
      {
        source: "/settings/:path*",
        destination: "/riskai/settings/:path*",
        permanent: true,
      },
      {
        source: "/settings",
        destination: "/riskai/settings",
        permanent: true,
      },
      {
        source: "/analysis/:path*",
        destination: "/riskai/analysis/:path*",
        permanent: true,
      },
      {
        source: "/analysis",
        destination: "/riskai/analysis",
        permanent: true,
      },
      {
        source: "/matrix/:path*",
        destination: "/riskai/matrix/:path*",
        permanent: true,
      },
      {
        source: "/matrix",
        destination: "/riskai/matrix",
        permanent: true,
      },
      {
        source: "/simulation/:path*",
        destination: "/riskai/simulation/:path*",
        permanent: true,
      },
      {
        source: "/simulation",
        destination: "/riskai/simulation",
        permanent: true,
      },
      {
        source: "/create-project/:path*",
        destination: "/riskai/create-project/:path*",
        permanent: true,
      },
      {
        source: "/create-project",
        destination: "/riskai/create-project",
        permanent: true,
      },
      {
        source: "/onboarding/:path*",
        destination: "/riskai/onboarding/:path*",
        permanent: true,
      },
      {
        source: "/outputs/:path*",
        destination: "/riskai/outputs/:path*",
        permanent: true,
      },
      {
        source: "/outputs",
        destination: "/riskai/outputs",
        permanent: true,
      },
      {
        source: "/run-data/:path*",
        destination: "/riskai/run-data/:path*",
        permanent: true,
      },
      {
        source: "/run-data",
        destination: "/riskai/run-data",
        permanent: true,
      },
      {
        source: "/risk-register/:path*",
        destination: "/riskai/risk-register/:path*",
        permanent: true,
      },
      {
        source: "/risk-register",
        destination: "/riskai/risk-register",
        permanent: true,
      },
      {
        source: "/project/:path*",
        destination: "/riskai/project/:path*",
        permanent: true,
      },
      {
        source: "/project",
        destination: "/riskai/project",
        permanent: true,
      },
      {
        source: "/project-not-found/:path*",
        destination: "/riskai/project-not-found/:path*",
        permanent: true,
      },
      {
        source: "/project-not-found",
        destination: "/riskai/project-not-found",
        permanent: true,
      },
      {
        source: "/day0/:path*",
        destination: "/riskai/day0/:path*",
        permanent: true,
      },
      {
        source: "/day0",
        destination: "/riskai/day0",
        permanent: true,
      },
      {
        source: "/portfolio/:path*",
        destination: "/riskai/portfolio/:path*",
        permanent: true,
      },
      {
        source: "/dev/:path*",
        destination: "/riskai/dev/:path*",
        permanent: true,
      },
      {
        source: "/dev",
        destination: "/riskai/dev",
        permanent: true,
      },
      {
        source: "/riskai/portfolios/:portfolioId/admin",
        destination: "/riskai/portfolios/:portfolioId/settings",
        permanent: true,
      },
      {
        source: "/riskai/projects/:projectId/setup",
        destination: "/riskai/projects/:projectId/settings",
        permanent: true,
      },
      {
        source: "/riskai/projects/:projectId/project-home",
        destination: "/riskai/projects/:projectId",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
