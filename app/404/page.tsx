import type { Metadata } from "next";
import { NotFoundContent } from "../not-found-content";

export const metadata: Metadata = {
  title: "404 – Page not found | RiskAI",
  description: "The page you're looking for doesn't exist.",
};

/**
 * Dedicated 404 URL. Other routes redirect here when content is not found
 * so the browser shows /404 and the page loads reliably.
 */
export default function NotFoundPage() {
  return <NotFoundContent />;
}
