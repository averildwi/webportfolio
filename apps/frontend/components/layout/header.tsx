"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { NAV_ITEMS } from "@/lib/config/navigation";
import { cn } from "@/lib/utils/cn";

type HeaderProps = {
  /** Wordmark text; falls back to a generic label when config is unavailable. */
  name: string;
  /** Rendered inside the mobile panel's footer. */
  socials?: React.ReactNode;
};

/**
 * Sticky site header.
 *
 * Starts transparent over the hero and gains a background once scrolled, so it
 * never competes with the hero but stays legible over content. The transition
 * is driven by a scroll listener rather than a ScrollTrigger because it is a
 * binary state change, not a tween.
 */
export function Header({ name, socials }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };

    // Read once on mount: a restored scroll position or a deep link means the
    // page may already be scrolled before the first scroll event fires.
    onScroll();

    // `passive` tells the browser we will not call preventDefault, so it can
    // keep scrolling off the main thread.
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Bypass link for keyboard and screen-reader users. Visually hidden
          until focused, at which point it becomes a normal button. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-canvas"
      >
        Skip to content
      </a>

      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300",
          scrolled
            ? "border-b border-line bg-canvas/80 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:h-18 sm:px-8 lg:px-12">
          <Link
            href="/"
            className="font-mono text-sm font-medium tracking-tight transition-opacity hover:opacity-70"
          >
            {name}
          </Link>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="rounded-full px-4 py-2 font-mono text-[0.8125rem] text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <Button href="/#contact" size="sm" className="hidden sm:inline-flex">
              Get in touch
            </Button>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              className="inline-flex size-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink lg:hidden"
            >
              <Menu aria-hidden className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={NAV_ITEMS}
        footer={socials}
      />
    </>
  );
}
