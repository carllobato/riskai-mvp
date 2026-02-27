import type { Metadata } from "next";
import "./globals.css";

import { ThemeProvider } from "@/context/ThemeContext";
import { RiskRegisterProvider } from "@/store/risk-register.store";
import { NavBar } from "@/components/NavBar";

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&family=Geist:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased font-sans bg-[var(--background)] text-[var(--foreground)]">
        <ThemeProvider>
          <RiskRegisterProvider>
            <NavBar />
            {children}
          </RiskRegisterProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}