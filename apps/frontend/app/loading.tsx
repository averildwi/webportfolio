import { Container } from "@/components/ui/section";

/**
 * Route-level loading fallback.
 *
 * Shown while a route segment streams in. A skeleton that mirrors the hero's
 * actual layout is used rather than a spinner: matching the eventual shape
 * avoids the layout jolt that occurs when a centred spinner is replaced by
 * left-aligned content.
 *
 * `animate-pulse-glow` is a slow opacity cycle rather than Tailwind's default
 * `animate-pulse`, which is fast enough to read as impatient.
 */
export default function Loading() {
  return (
    // `aria-busy` and the polite live region tell screen readers the content is
    // pending, instead of announcing a page of empty boxes.
    <main
      className="flex flex-1 flex-col"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading content"
    >
      <Container className="py-28 sm:py-36 lg:py-48">
        <div className="animate-pulse-glow">
          {/* Availability badge */}
          <div className="h-9 w-40 rounded-full bg-surface-raised" />

          {/* Headline: three lines of decreasing width, as real text wraps. */}
          <div className="mt-8 flex max-w-4xl flex-col gap-4">
            <div className="h-12 w-full rounded-lg bg-surface-raised sm:h-16" />
            <div className="h-12 w-11/12 rounded-lg bg-surface-raised sm:h-16" />
            <div className="h-12 w-2/3 rounded-lg bg-surface-raised sm:h-16" />
          </div>

          {/* Bio */}
          <div className="mt-8 flex max-w-xl flex-col gap-3">
            <div className="h-4 w-full rounded bg-surface" />
            <div className="h-4 w-5/6 rounded bg-surface" />
          </div>

          {/* Action buttons */}
          <div className="mt-12 flex gap-3">
            <div className="h-13 w-36 rounded-full bg-surface-raised" />
            <div className="h-13 w-28 rounded-full bg-surface" />
          </div>
        </div>
      </Container>
    </main>
  );
}
