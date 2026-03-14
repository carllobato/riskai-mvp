/**
 * Custom 404 content when notFound() is called. Uses shared NotFoundContent
 * so UI matches the catch-all invalid-URL page.
 */
import { NotFoundContent } from "./not-found-content";

export default function NotFound() {
  return <NotFoundContent />;
}
