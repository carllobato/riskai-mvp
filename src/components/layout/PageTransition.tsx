"use client";

import type { RefObject } from "react";
import { useLayoutEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

type PageTransitionProps = {
  children: React.ReactNode;
  /** Main column scroll element; reset when the URL changes. */
  scrollContainerRef: RefObject<HTMLElement | null>;
};

/**
 * `key={pathname}` remounts this wrapper on every client-side URL change inside the shell so
 * each route gets a fresh subtree. `initial={false}` keeps content visible immediately (avoids
 * long or stuck opacity-0 fades after RSC navigations such as onboarding redirects).
 */
export function PageTransition({ children, scrollContainerRef }: PageTransitionProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion() === true;

  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = 0;
  }, [pathname, scrollContainerRef]);

  return (
    <motion.div
      key={pathname}
      className="min-h-0 w-full"
      initial={false}
      animate={{ opacity: 1 }}
      transition={{
        duration: reduceMotion ? 0 : 0.2,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
