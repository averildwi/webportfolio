"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Central GSAP registration.
 *
 * Plugins must be registered before any animation that uses them is created.
 * Doing it here, in a module every animated component imports, guarantees the
 * ordering: ES module evaluation completes before the importing component's
 * body runs, so a ScrollTrigger-backed tween can never be built against a
 * missing plugin.
 *
 * `registerPlugin` is idempotent, so repeated evaluation under Fast Refresh is
 * harmless. The `window` check keeps it out of the server render, where
 * ScrollTrigger has no document to measure.
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export { gsap, ScrollTrigger };

/**
 * Shared timing so animations across sections feel like one system.
 *
 * `easeOutExpo` mirrors the `--ease-out-expo` CSS token; keeping the two in
 * sync means a CSS transition and a GSAP tween on the same element do not
 * visibly disagree.
 */
export const MOTION = {
  duration: {
    fast: 0.4,
    base: 0.8,
    slow: 1.2,
  },
  /** cubic-bezier(0.16, 1, 0.3, 1) */
  easeOutExpo: "expo.out",
  easeOutQuart: "power4.out",
  /** Delay between siblings in a staggered entrance. */
  stagger: 0.08,
  /**
   * Default ScrollTrigger start position: fire when the element's top reaches
   * 85% down the viewport, so the animation is already running by the time the
   * element is comfortably in view.
   */
  start: "top 85%",
} as const;
