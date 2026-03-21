"use client";

import { useEffect } from "react";

const IMAGES = ["/welcome-background-light.png", "/welcome-background-dark.png"];

/** Decode both login backgrounds so theme toggles don't wait on network / decode. */
export function LoginBackgroundPreload() {
  useEffect(() => {
    for (const src of IMAGES) {
      const img = new Image();
      img.src = src;
    }
  }, []);
  return null;
}
