import type { Metadata } from "next";
import "./globals.css";

import { RiskRegisterProvider } from "@/store/risk-register.store";
import { AppNav } from "@/components/AppNav";

export const metadata: Metadata = {
  title: "RiskAI",
  description: "AI-powered Risk Register",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&family=Geist:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased font-sans">
        <RiskRegisterProvider>
          <AppNav />
          {children}
        </RiskRegisterProvider>
      </body>
    </html>
  );
}