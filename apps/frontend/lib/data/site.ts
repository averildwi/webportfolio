import { cache } from "react";
import { ApiError, getSiteConfigOrNull } from "@/lib/api";
import { resolveSocialLinks } from "@/lib/config/navigation";
import type { SiteConfig } from "@/lib/api";

/**
 * Per-request memoized loaders for data needed by more than one component.
 *
 * The root layout and the homepage both need the site config. `cache()`
 * deduplicates the call within a single render pass, so the layout's header and
 * the page's hero share one result instead of issuing two requests.
 *
 * This is separate from the HTTP-level `revalidate` cache: `cache()` scopes to
 * one request, `revalidate` spans requests.
 */

/**
 * Loads the site config, resolving to `null` for *any* failure.
 *
 * This is deliberately more forgiving than `getSiteConfigOrNull`, which only
 * absorbs a 404. The distinction matters because this loader feeds the root
 * layout: an unreachable backend must not take down the header, the footer, and
 * every page with them. It also must not fail the production build, where pages
 * are prerendered with no API available.
 *
 * The tradeoff is that a real outage renders a nameless shell rather than an
 * error page. That is the correct call for chrome — a page that genuinely
 * requires this data should call `getSiteConfig()` and let the error boundary
 * handle it.
 */
export const loadSiteConfig = cache(async (): Promise<SiteConfig | null> => {
  try {
    return await getSiteConfigOrNull();
  } catch (error) {
    // Surface the reason in server logs; a silent null here would otherwise
    // look identical to an unseeded database.
    const reason =
      error instanceof ApiError
        ? `${error.status} ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    console.warn(`[site-config] unavailable, rendering fallback chrome: ${reason}`);
    return null;
  }
});

/**
 * Site chrome data: the display name and resolved social links.
 *
 * Falls back to a neutral name when the config is missing so the header always
 * renders something rather than collapsing.
 */
export const loadSiteChrome = cache(async () => {
  const config = await loadSiteConfig();

  return {
    name: config?.fullName ?? "Portfolio",
    socials: resolveSocialLinks(config?.socialLinks),
  };
});
