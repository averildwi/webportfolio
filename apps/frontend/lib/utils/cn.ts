import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names, resolving Tailwind conflicts in favour of the last value.
 *
 * `clsx` handles conditionals and arrays; `twMerge` then collapses competing
 * utilities so a caller's `className` can override a component's defaults.
 * Without the merge step, `cn("p-4", "p-8")` emits both and the winner depends
 * on stylesheet order rather than intent.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
