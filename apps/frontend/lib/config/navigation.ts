import type { SocialLinks } from "@/lib/api";

/**
 * Navigation and social link configuration.
 *
 * Kept as data rather than inlined into the header so the same list drives the
 * desktop nav, the mobile menu, and the footer. Three copies of the same links
 * drift apart; one does not.
 */

export type NavItem = {
  label: string;
  href: string;
};

/**
 * Primary navigation.
 *
 * Hash targets point at homepage sections and require a matching `id` on the
 * corresponding `<Section>`. Real routes are added here as they are built.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Work", href: "/#projects" },
  { label: "Experience", href: "/#experience" },
  { label: "About", href: "/#about" },
  { label: "Guestbook", href: "/guestbook" },
];

/** Social platforms, in the order they should render. */
export type SocialKey = keyof SocialLinks;

export const SOCIAL_ORDER: SocialKey[] = [
  "github",
  "linkedin",
  "twitter",
  "instagram",
  "email",
];

export const SOCIAL_LABEL: Record<SocialKey, string> = {
  github: "GitHub",
  linkedin: "LinkedIn",
  twitter: "X",
  instagram: "Instagram",
  email: "Email",
};

/**
 * Normalizes a stored social value into a usable href.
 *
 * The backend validates these with `@IsString()` rather than `@IsUrl()`, so a
 * value may legitimately be a bare handle, a bare domain, or a full URL. A bare
 * hostname without a scheme would otherwise be treated as a relative path and
 * produce a broken link.
 */
export function toSocialHref(key: SocialKey, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (key === "email") {
    return trimmed.startsWith("mailto:") ? trimmed : `mailto:${trimmed}`;
  }

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  // Reject anything with a scheme we did not expect — notably `javascript:`,
  // which would execute on click.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;

  return `https://${trimmed.replace(/^\/+/, "")}`;
}

/**
 * Builds the renderable social list from the site config.
 *
 * Entries with no stored value are dropped, so the UI never shows a dead icon.
 */
export function resolveSocialLinks(
  links: SocialLinks | null | undefined,
): { key: SocialKey; label: string; href: string }[] {
  if (!links) return [];

  return SOCIAL_ORDER.flatMap((key) => {
    const value = links[key];
    if (!value) return [];

    const href = toSocialHref(key, value);
    if (!href) return [];

    return [{ key, label: SOCIAL_LABEL[key], href }];
  });
}
