import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/portfolios/:portfolioId/admin",
        destination: "/portfolios/:portfolioId/settings",
        permanent: true,
      },
      {
        source: "/projects/:projectId/setup",
        destination: "/projects/:projectId/settings",
        permanent: true,
      },
      {
        source: "/projects/:projectId/project-home",
        destination: "/projects/:projectId",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
