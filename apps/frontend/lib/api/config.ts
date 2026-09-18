/**
 * Runtime configuration, read from environment variables.
 *
 * Next.js inlines `NEXT_PUBLIC_*` values at build time, so these are read via
 * direct property access on `process.env` rather than a dynamic key - the
 * bundler cannot substitute a computed lookup.
 */

/**
 * Base URL of the NestJS API, including its `/api` global prefix.
 *
 * Exposed to the browser because the client needs it for the like/view
 * endpoints, the contact form, and the OAuth entry points. There is nothing
 * secret about it.
 */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api"
).replace(/\/+$/, "");

/** Public origin of this site, used for canonical URLs and OG metadata. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"
).replace(/\/+$/, "");

/**
 * How long cached GET responses stay fresh, in seconds.
 *
 * The backend already caches most public reads for 60s, so matching that here
 * avoids a confusing situation where the frontend serves data the backend has
 * already invalidated.
 */
export const DEFAULT_REVALIDATE_SECONDS = 60;

export const IS_PRODUCTION = process.env.NODE_ENV === "production";
