import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/context/ThemeContext";
import { ProjectionScenarioProvider } from "@/context/ProjectionScenarioContext";
import { RiskRegisterProvider } from "@/store/risk-register.store";
import { NavBar } from "@/components/NavBar";

const geist = Geist({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "RiskAI",
  description: "AI-powered Risk Register",
};

const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('riskai-theme');
    var theme = (stored === 'dark' || stored === 'light') ? stored
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`antialiased font-sans bg-[var(--background)] text-[var(--foreground)] ${geist.variable} ${geistMono.variable}`}>
        <ThemeProvider>
          <ProjectionScenarioProvider>
            <RiskRegisterProvider>
              <NavBar />
              {children}
            </RiskRegisterProvider>
          </ProjectionScenarioProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
