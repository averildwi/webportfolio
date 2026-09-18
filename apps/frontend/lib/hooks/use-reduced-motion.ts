"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Subscribes to the media query, returning an unsubscribe function.
 *
 * Defined at module scope so its identity is stable across renders —
 * `useSyncExternalStore` re-subscribes whenever this reference changes.
 */
function subscribe(onStoreChange: () => void): () => void {
  const list = window.matchMedia(QUERY);
  list.addEventListener("change", onStoreChange);
  return () => list.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/**
 * Value used during server rendering and the hydration pass.
 *
 * The server cannot know the visitor's preference, so it assumes motion is
 * allowed. React compares this against the real client snapshot immediately
 * after hydration and re-renders if they differ, which is the intended
 * behaviour of `useSyncExternalStore` rather than a mismatch.
 */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Tracks the user's `prefers-reduced-motion` setting.
 *
 * The CSS in `globals.css` neutralizes declarative animations, but GSAP and
 * `motion` write inline styles that CSS cannot override. Any component running
 * a JS animation must consult this hook and jump straight to the final state
 * when it returns `true`.
 *
 * Implemented with `useSyncExternalStore` rather than `useEffect` + `useState`:
 * the media query is external state, and reading it in an effect would render
 * once with a guessed value and then immediately again with the real one.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
