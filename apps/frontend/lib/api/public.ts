import { cached, request, requestPage, requestRaw, uncached } from "./client";
import type {
  Achievement,
  Education,
  ExperienceWithTech,
  FeaturedPaginationQuery,
  GuestbookEntry,
  HealthCheck,
  LikeToggleResult,
  Page,
  PaginationQuery,
  ProjectDetail,
  ProjectListItem,
  SiteConfig,
  TechStack,
  Testimonial,
} from "./types";
import type { CreateContactInput, ContactForm } from "./types";
import type { TechCategory } from "./enums";

/**
 * Public API surface — every endpoint here is reachable without a credential.
 *
 * Read functions are cacheable and safe to call from Server Components. The two
 * write functions (`submitContact`, `toggleProjectLike`) are rate-limited by
 * the backend and must only run in response to a user action.
 *
 * Admin endpoints are deliberately excluded; they belong with the dashboard,
 * where token handling lives.
 */

/**
 * Cache tags, so a future admin mutation can invalidate exactly what changed
 * instead of dropping the whole cache.
 */
export const CACHE_TAGS = {
  siteConfig: "site-config",
  techStacks: "tech-stacks",
  experiences: "experiences",
  educations: "educations",
  projects: "projects",
  achievements: "achievements",
  testimonials: "testimonials",
  guestbook: "guestbook",
} as const;

// ---------------------------------------------------------------------------
// Site config
// ---------------------------------------------------------------------------

/**
 * Fetches the singleton site configuration.
 *
 * Throws `ApiError` with status 404 when the row has never been seeded, which
 * is a legitimate first-run state rather than a bug. Callers rendering
 * chrome that must not break should use {@link getSiteConfigOrNull}.
 */
export function getSiteConfig(): Promise<SiteConfig> {
  return request<SiteConfig>("/site-config", {
    cache: cached(60, [CACHE_TAGS.siteConfig]),
  });
}

/**
 * Like {@link getSiteConfig}, but resolves to `null` when unseeded.
 *
 * Only the 404 is swallowed. Network failures and 5xx responses still throw,
 * because silently rendering an empty page on a server outage hides a real
 * problem.
 */
export async function getSiteConfigOrNull(): Promise<SiteConfig | null> {
  try {
    return await getSiteConfig();
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Tech stacks
// ---------------------------------------------------------------------------

/** Lists tech stacks ordered by `order`. Not paginated. */
export function getTechStacks(category?: TechCategory): Promise<TechStack[]> {
  return request<TechStack[]>("/tech-stacks", {
    query: { category },
    cache: cached(300, [CACHE_TAGS.techStacks]),
  });
}

// ---------------------------------------------------------------------------
// Experience & education
// ---------------------------------------------------------------------------

/** Lists experiences with their tech stacks, ordered by `order`. */
export function getExperiences(): Promise<ExperienceWithTech[]> {
  return request<ExperienceWithTech[]>("/experiences", {
    cache: cached(300, [CACHE_TAGS.experiences]),
  });
}

/** Lists education entries ordered by `order`. */
export function getEducations(): Promise<Education[]> {
  return request<Education[]>("/educations", {
    cache: cached(300, [CACHE_TAGS.educations]),
  });
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/**
 * Lists published projects.
 *
 * Drafts and archived projects are filtered out server-side, so there is no
 * way to leak an unpublished project through this call.
 */
export function getProjects(
  query: FeaturedPaginationQuery = {},
): Promise<Page<ProjectListItem>> {
  return requestPage<ProjectListItem>("/projects", {
    query: { page: query.page, limit: query.limit, featured: query.featured },
    cache: cached(60, [CACHE_TAGS.projects]),
  });
}

/** Convenience wrapper for the homepage's featured grid. */
export async function getFeaturedProjects(
  limit = 6,
): Promise<ProjectListItem[]> {
  const page = await getProjects({ featured: true, limit });
  return page.items;
}

/**
 * Fetches one published project by slug.
 *
 * The response's `liked` flag reflects the *server's* view of the caller, which
 * during SSR is the Next.js server rather than the visitor. Treat it as a hint
 * and confirm client-side before rendering a filled like button.
 */
export function getProjectBySlug(slug: string): Promise<ProjectDetail> {
  return request<ProjectDetail>(`/projects/slug/${encodeURIComponent(slug)}`, {
    cache: cached(60, [CACHE_TAGS.projects]),
  });
}

/**
 * Records a view. Rate-limited to 5 per minute per IP/User-Agent pair.
 *
 * Must run in the browser: the backend keys the throttle and the dedupe hash
 * off the request's IP, so calling this during SSR would attribute every view
 * to the server.
 */
export function recordProjectView(slug: string): Promise<void> {
  return request<void>(`/projects/slug/${encodeURIComponent(slug)}/view`, {
    method: "POST",
    cache: uncached,
  });
}

/**
 * Toggles the caller's like. Rate-limited to 5 per minute.
 *
 * Returns the raw body — this endpoint bypasses the response envelope.
 * Browser-only, for the same reason as {@link recordProjectView}.
 */
export function toggleProjectLike(slug: string): Promise<LikeToggleResult> {
  return requestRaw<LikeToggleResult>(
    `/projects/slug/${encodeURIComponent(slug)}/like/toggle`,
    { method: "POST", cache: uncached },
  );
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

/** Lists achievements, paginated and ordered by `order`. */
export function getAchievements(
  query: FeaturedPaginationQuery = {},
): Promise<Page<Achievement>> {
  return requestPage<Achievement>("/achievements", {
    query: { page: query.page, limit: query.limit, featured: query.featured },
    cache: cached(300, [CACHE_TAGS.achievements]),
  });
}

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------

/**
 * Lists testimonials ordered by `order`. Not paginated.
 *
 * `featured` is stringified explicitly: this endpoint compares the raw query
 * value against the literal `"true"` instead of using the shared boolean
 * transformer, so `?featured=1` would be read as `false`.
 */
export function getTestimonials(featured?: boolean): Promise<Testimonial[]> {
  return request<Testimonial[]>("/testimonials", {
    query: { featured: featured === undefined ? undefined : String(featured) },
    cache: cached(300, [CACHE_TAGS.testimonials]),
  });
}

// ---------------------------------------------------------------------------
// Guestbook
// ---------------------------------------------------------------------------

/**
 * Lists approved guestbook entries, newest first.
 *
 * Pending and rejected entries are filtered server-side. Posting requires a
 * VISITOR token from the OAuth flow and lives with the guestbook feature.
 */
export function getGuestbookEntries(
  query: PaginationQuery = {},
): Promise<Page<GuestbookEntry>> {
  return requestPage<GuestbookEntry>("/guestbook", {
    query: { page: query.page, limit: query.limit },
    cache: cached(30, [CACHE_TAGS.guestbook]),
  });
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

/**
 * Submits the contact form. Rate-limited to 3 per 5 minutes.
 *
 * A 429 here is an expected outcome, not an error to log — surface it as
 * "you've already sent a message recently".
 */
export function submitContact(
  input: CreateContactInput,
): Promise<ContactForm> {
  return request<ContactForm>("/contact", {
    method: "POST",
    body: input,
    cache: uncached,
  });
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

/** Reads the backend health check. Useful for a status indicator. */
export function getHealth(): Promise<HealthCheck> {
  return request<HealthCheck>("/health", { cache: uncached });
}
