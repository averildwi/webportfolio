type SocialLink = { key: string; label: string; href: string };

/**
 * Inline social link list.
 *
 * Shared between the mobile menu footer and any other compact placement. Kept
 * separate from `Footer` so the header can render it without pulling in the
 * footer's layout.
 */
export function SocialLinkList({ links }: { links: SocialLink[] }) {
  if (links.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-3">
      {links.map((link) => (
        <li key={link.key}>
          <a
            href={link.href}
            {...(link.href.startsWith("http")
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className="font-mono text-sm text-ink-muted transition-colors hover:text-ink"
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
