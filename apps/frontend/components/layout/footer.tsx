import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/section";
import { NAV_ITEMS } from "@/lib/config/navigation";

type SocialLink = { key: string; label: string; href: string };

type FooterProps = {
  name: string;
  socials: SocialLink[];
};

/**
 * Site footer.
 *
 * A Server Component — there is nothing interactive here, so shipping it as
 * static markup keeps it out of the client bundle entirely.
 */
export function Footer({ name, socials }: FooterProps) {
  const year = new Date().getUTCFullYear();

  return (
    <footer className="mt-auto border-t border-line">
      <Container className="py-16 sm:py-20">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          <div className="max-w-sm">
            <p className="text-2xl font-medium tracking-tight">
              Let&apos;s build something.
            </p>
            <p className="mt-3 font-mono text-sm font-light leading-relaxed text-ink-muted">
              Open to interesting problems and good teams.
            </p>
            <Link
              href="/#contact"
              className="mt-6 inline-flex items-center gap-1.5 font-mono text-sm text-accent transition-colors hover:text-accent-hover"
            >
              Start a conversation
              <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={2.5} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-12 sm:gap-20">
            <FooterColumn title="Navigate">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="font-mono text-sm text-ink-muted transition-colors hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </FooterColumn>

            {socials.length > 0 && (
              <FooterColumn title="Elsewhere">
                {socials.map((social) => (
                  <li key={social.key}>
                    <a
                      href={social.href}
                      // Only http(s) links leave the site in a new tab; a
                      // mailto: handled by the OS should not open a blank tab.
                      {...(social.href.startsWith("http")
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="font-mono text-sm text-ink-muted transition-colors hover:text-ink"
                    >
                      {social.label}
                    </a>
                  </li>
                ))}
              </FooterColumn>
            )}
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs text-ink-subtle">
            © {year} {name}
          </p>
          <p className="font-mono text-xs text-ink-subtle">
            Built with Next.js and NestJS
          </p>
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="label-mono mb-5">{title}</h2>
      <ul className="flex flex-col gap-3">{children}</ul>
    </div>
  );
}
