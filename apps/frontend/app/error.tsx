"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/section";

/**
 * Route-level error boundary.
 *
 * Must be a Client Component: React error boundaries rely on class component
 * lifecycle and client-side state that the server cannot provide.
 *
 * This catches uncaught exceptions from the page below it — most likely a
 * backend outage that the data loaders did not absorb. The root layout is
 * *outside* this boundary, so the header and footer keep rendering and the
 * visitor can still navigate away.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Report the failure. In production, `error.message` is replaced by a
    // generic string and `digest` is the only way to correlate this with the
    // real stack in server logs, so both are logged.
    console.error("Route error:", error.message, error.digest);
  }, [error]);

  return (
    <main className="flex flex-1 items-center">
      <Container className="py-32">
        <p className="label-mono">Something broke</p>

        <h1 className="mt-6 text-5xl font-medium tracking-tight sm:text-7xl">
          That did not work.
        </h1>

        <p className="mt-8 max-w-md font-mono text-sm font-light leading-relaxed text-ink-muted">
          An unexpected error interrupted this page. Retrying will re-fetch the
          data — if it keeps failing, the API is likely unavailable.
        </p>

        <div className="mt-12 flex flex-wrap gap-3">
          {/* `retry()` re-runs the failed render and its data fetches.
              `reset()` would only clear the boundary's state, which for a
              fetch failure just reproduces the same error. */}
          <Button
            onClick={retry}
            size="lg"
            leadingIcon={<RotateCcw aria-hidden className="size-4" />}
          >
            Try again
          </Button>
          <Button href="/" variant="secondary" size="lg">
            Back home
          </Button>
        </div>

        {/* The digest is the only user-visible handle on the underlying error
            in production, so it is worth surfacing for bug reports. */}
        {error.digest && (
          <p className="mt-16 font-mono text-xs text-ink-subtle">
            Reference: {error.digest}
          </p>
        )}
      </Container>
    </main>
  );
}
