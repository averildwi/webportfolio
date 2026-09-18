"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { NavItem } from "@/lib/config/navigation";
import { cn } from "@/lib/utils/cn";

type MobileMenuProps = {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  /** Rendered at the bottom of the panel, e.g. social links. */
  footer?: React.ReactNode;
};

/**
 * Full-screen navigation panel for small viewports.
 *
 * Implemented as a modal dialog, which imposes three requirements that a plain
 * animated `<div>` does not satisfy:
 *
 * 1. **Escape closes it.** Users expect this of anything overlaying the page.
 * 2. **Focus is trapped inside.** Otherwise Tab walks into the page behind the
 *    overlay, moving focus to controls the user cannot see.
 * 3. **Focus returns on close.** Dropping focus to `<body>` forces a keyboard
 *    user to tab from the top of the document again.
 *
 * The panel stays mounted and is translated off-screen so the CSS transition
 * can run in both directions; `aria-hidden` and `inert` keep the hidden panel
 * out of the accessibility tree and out of tab order.
 */
export function MobileMenu({ open, onClose, items, footer }: MobileMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  /** Element that had focus before opening, restored on close. */
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Escape to dismiss.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Focus management and scroll locking.
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    // Prevent the page behind the overlay from scrolling. Restoring the
    // previous value rather than clearing it avoids clobbering an overflow
    // style set by something else.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open]);

  // Focus trap: wrap Tab at the panel's edges.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Site navigation"
      // `inert` removes the whole subtree from tab order and pointer events
      // while closed, so the off-screen panel cannot be reached by accident.
      inert={!open}
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-canvas px-6 py-8 lg:hidden",
        "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        open
          ? "translate-x-0 opacity-100"
          : "pointer-events-none translate-x-full opacity-0",
      )}
    >
      <div className="flex justify-end">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>

      <nav className="mt-auto">
        <ul className="flex flex-col gap-1">
          {items.map((item, index) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onClose}
                className="flex items-baseline gap-3 py-2 text-4xl font-medium tracking-tight transition-colors hover:text-accent"
              >
                <span>{item.label}</span>
                <span
                  aria-hidden
                  className="font-mono text-xs font-normal text-ink-subtle"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {footer && <div className="mt-12 border-t border-line pt-8">{footer}</div>}
    </div>
  );
}
