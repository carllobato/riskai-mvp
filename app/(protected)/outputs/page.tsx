"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy route: redirect to Run Data. */
export default function OutputsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/run-data");
  }, [router]);
  return null;
}
