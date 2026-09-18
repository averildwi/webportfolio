import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/section";
import { NAV_ITEMS } from "@/lib/config/navigation";

/**
 * 404 page.
 *
 * Handles both explicit `notFound()` calls and any URL that matches no route.
 * Next.js injects `noindex` automatically for 404 responses, so crawlers will
 * not add this to the index.
 */
export const metadata: Metadata = {
  title: "Not found",
};

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center">
      <Container className="py-32">
        <p className="label-mono">Error 404</p>

        {/* This page's own h1: it replaces the route's content entirely, so it
            owns the top of the document outline. */}
        <h1 className="mt-6 text-6xl font-medium tracking-tight sm:text-8xl">
          Lost the thread.
        </h1>

        <p className="mt-8 max-w-md font-mono text-sm font-light leading-relaxed text-ink-muted">
          This page does not exist, or it moved somewhere better. Nothing here
          is broken — the URL just does not point anywhere.
        </p>

        <div className="mt-12 flex flex-wrap gap-3">
          <Button href="/" size="lg">
            Back home
          </Button>
        </div>

        <nav aria-label="Suggested pages" className="mt-16">
          <h2 className="label-mono mb-5">Try one of these</h2>
          <ul className="flex flex-wrap gap-x-8 gap-y-3">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="font-mono text-sm text-ink-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </main>
  );
}
