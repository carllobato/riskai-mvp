/**
 * Catch-all for unmatched URLs (e.g. /test456). Renders 404 UI inline so the
 * page loads reliably (redirect to /404 can cause bad client render in Next.js 16).
 */
import { NotFoundContent } from "../not-found-content";

export default function CatchAllNotFoundPage() {
  return <NotFoundContent />;
}
