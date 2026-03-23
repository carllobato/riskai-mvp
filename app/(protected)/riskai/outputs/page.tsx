"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { riskaiPath } from "@/lib/routes";

/** Legacy route: redirect to Run Data. */
export default function OutputsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(riskaiPath("/run-data"));
  }, [router]);
  return null;
}
