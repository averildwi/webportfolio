"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary.
 *
 * `error.tsx` wraps pages but explicitly does *not* wrap the root layout, so a
 * failure in the layout itself — including its `loadSiteChrome()` call — would
 * otherwise crash to a blank page. This is the fallback for that case.
 *
 * Because it replaces the root layout, it must render its own `<html>` and
 * `<body>`. It also cannot rely on the layout's font variables, so styling here
 * is deliberately minimal and self-contained: the fonts, header, and footer are
 * all part of what failed.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error:", error.message, error.digest);
  }, [error]);

  return (
    <html lang="en">
      {/* Inline styles, not Tailwind classes: the stylesheet is loaded by the
          layout that just failed, so utility classes may not apply. */}
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          backgroundColor: "#050303",
          color: "#ffffff",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <main style={{ maxWidth: "32rem" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.6875rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#71717a",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            Application error
          </p>

          <h1
            style={{
              margin: "1.5rem 0 0",
              fontSize: "clamp(2rem, 6vw, 3.5rem)",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            The site failed to load.
          </h1>

          <p
            style={{
              margin: "1.5rem 0 0",
              fontSize: "0.875rem",
              lineHeight: 1.7,
              color: "#a1a1aa",
              fontFamily: "ui-monospace, monospace",
              fontWeight: 300,
            }}
          >
            Something went wrong before the page could render. This is on our
            side, not yours.
          </p>

          <button
            type="button"
            onClick={retry}
            style={{
              marginTop: "2.5rem",
              height: "3rem",
              padding: "0 2rem",
              border: "none",
              borderRadius: "9999px",
              backgroundColor: "#ffffff",
              color: "#050303",
              fontSize: "0.9375rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>

          {error.digest && (
            <p
              style={{
                margin: "3rem 0 0",
                fontSize: "0.75rem",
                color: "#71717a",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
