import { ArrowUpRight } from "lucide-react";
import {
  CountUp,
  ScrollReveal,
  StaggerGroup,
} from "@/components/animation/scroll-reveal";
import { Button } from "@/components/ui/button";
import { Container, Section, SectionHeading } from "@/components/ui/section";
import { AVAILABILITY_LABEL, type SiteConfig, type TechStack } from "@/lib/api";
import { getTechStacks } from "@/lib/api";
import { loadSiteConfig } from "@/lib/data/site";
import { cn } from "@/lib/utils/cn";

/**
 * Homepage.
 *
 * This is a Server Component, so the API calls below run on the server and the
 * visitor's browser never talks to the backend for this content. That keeps the
 * API base URL off the critical path and lets the markup arrive already
 * populated, which matters for a page whose main job is to be indexed.
 *
 * Only two sections are wired so far — the hero and the tech marquee — to prove
 * the design system, data layer, and animation primitives work end to end.
 * Remaining sections (projects, experience, stats, testimonials, guestbook,
 * contact) follow the same pattern.
 */

/**
 * Fetches page data, tolerating a backend that is down or unseeded.
 *
 * A portfolio homepage that 500s because the API is unreachable is worse than
 * one that renders its static copy with sections omitted, so failures degrade
 * to empty data rather than propagating. `Promise.allSettled` also means one
 * slow endpoint cannot make the others wait serially.
 *
 * `loadSiteConfig` is request-memoized, so the root layout's header and this
 * page share a single fetch.
 */
async function loadPageData(): Promise<{
  siteConfig: SiteConfig | null;
  techStacks: TechStack[];
}> {
  const [configResult, techResult] = await Promise.allSettled([
    loadSiteConfig(),
    getTechStacks(),
  ]);

  return {
    siteConfig: configResult.status === "fulfilled" ? configResult.value : null,
    techStacks: techResult.status === "fulfilled" ? techResult.value : [],
  };
}

export default async function HomePage() {
  const { siteConfig, techStacks } = await loadPageData();

  const fullName = siteConfig?.fullName ?? "Your Name";
  const tagline =
    siteConfig?.tagline ??
    "Software engineer building reliable systems for the web.";

  // `<main>` lives here rather than in the layout so each route owns its own
  // landmark, and so the footer stays outside it.
  return (
    <main className="flex flex-1 flex-col">
      <Hero
        fullName={fullName}
        tagline={tagline}
        bio={siteConfig?.bio}
        availability={siteConfig?.availabilityStatus}
        resumeUrl={siteConfig?.resumeUrl}
      />
      {techStacks.length > 0 && <TechMarquee items={techStacks} />}
      <Stats projectCount={0} techCount={techStacks.length} />
    </main>
  );
}

type HeroProps = {
  fullName: string;
  tagline: string;
  bio?: string | null;
  availability?: SiteConfig["availabilityStatus"];
  resumeUrl?: string | null;
};

function Hero({ fullName, tagline, bio, availability, resumeUrl }: HeroProps) {
  return (
    <Section spacing="lg" className="overflow-hidden">
      {/* Decorative radial glow. `pointer-events-none` keeps it from
          intercepting clicks on the content above it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[40rem] w-[60rem] -translate-x-1/2 rounded-full bg-accent-muted/25 blur-[120px]"
      />

      <Container>
        {availability && <AvailabilityBadge status={availability} />}

        {/* The only h1 on the page. */}
        <ScrollReveal as="h1" className="mt-8 max-w-4xl" blur>
          <span className="block text-4xl font-medium leading-[1.05] tracking-tight text-balance sm:text-6xl lg:text-7xl">
            {tagline}
          </span>
        </ScrollReveal>

        {bio && (
          <ScrollReveal delay={0.15} className="mt-8 max-w-xl">
            <p className="font-mono text-sm font-light leading-relaxed text-ink-muted">
              {bio}
            </p>
          </ScrollReveal>
        )}

        <ScrollReveal delay={0.3} className="mt-12">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              href="#projects"
              size="lg"
              trailingIcon={
                <ArrowUpRight aria-hidden className="size-4" strokeWidth={2.5} />
              }
            >
              View work
            </Button>
            {resumeUrl && (
              <Button
                href={resumeUrl}
                target="_blank"
                variant="secondary"
                size="lg"
              >
                Resume
              </Button>
            )}
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.45} className="mt-16">
          <p className="label-mono">{fullName}</p>
        </ScrollReveal>
      </Container>
    </Section>
  );
}

/**
 * Availability pill.
 *
 * The colour is paired with a text label rather than standing alone, so the
 * status is legible to colour-blind visitors and in screen readers.
 */
function AvailabilityBadge({
  status,
}: {
  status: SiteConfig["availabilityStatus"];
}) {
  const isOpen = status === "OPEN_TO_WORK" || status === "FREELANCE_ONLY";

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-line bg-surface px-4 py-2">
      <span className="relative flex size-1.5">
        {isOpen && (
          <span
            aria-hidden
            className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75"
          />
        )}
        <span
          aria-hidden
          className={cn(
            "relative inline-flex size-1.5 rounded-full",
            isOpen ? "bg-success" : "bg-ink-subtle",
          )}
        />
      </span>
      <span className="font-mono text-xs tracking-wide text-ink-muted">
        {AVAILABILITY_LABEL[status]}
      </span>
    </div>
  );
}

/**
 * Infinite-scrolling tech stack strip.
 *
 * The list is rendered twice so the CSS `marquee` keyframe can translate by
 * exactly -50% and land seamlessly where it started. The duplicate is
 * `aria-hidden` to keep assistive tech from reading every name twice.
 */
function TechMarquee({ items }: { items: TechStack[] }) {
  return (
    <Section spacing="sm" className="border-y border-line">
      <div className="mask-fade-x flex overflow-hidden">
        <ul className="flex shrink-0 animate-marquee items-center gap-16 pr-16">
          {items.map((tech) => (
            <TechMarqueeItem key={tech.id} tech={tech} />
          ))}
          {items.map((tech) => (
            <TechMarqueeItem key={`${tech.id}-dup`} tech={tech} ariaHidden />
          ))}
        </ul>
      </div>
    </Section>
  );
}

function TechMarqueeItem({
  tech,
  ariaHidden = false,
}: {
  tech: TechStack;
  ariaHidden?: boolean;
}) {
  return (
    <li
      {...(ariaHidden ? { "aria-hidden": true } : {})}
      className="flex shrink-0 items-center gap-3"
    >
      {tech.iconUrl && (
        // A plain <img> rather than next/image: these are remote Cloudinary
        // URLs whose hostname would have to be allowlisted in next.config, and
        // logos are small enough that optimization buys little.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tech.iconUrl}
          alt=""
          width={20}
          height={20}
          loading="lazy"
          decoding="async"
          className="size-5 object-contain opacity-60"
        />
      )}
      <span className="whitespace-nowrap font-mono text-sm text-ink-subtle">
        {tech.name}
      </span>
    </li>
  );
}

/** Placeholder metrics band, demonstrating the CountUp primitive. */
function Stats({
  projectCount,
  techCount,
}: {
  projectCount: number;
  techCount: number;
}) {
  const stats = [
    { value: projectCount, label: "Projects shipped", suffix: "" },
    { value: techCount, label: "Technologies", suffix: "" },
    { value: new Date().getUTCFullYear() - 2021, label: "Years building", suffix: "+" },
  ];

  return (
    <Section id="about" spacing="md">
      <Container>
        <SectionHeading
          eyebrow="By the numbers"
          title="Measured, not claimed."
        />
        <StaggerGroup className="mt-16 grid grid-cols-1 gap-12 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col">
              <span className="text-5xl font-medium tracking-tight lg:text-6xl">
                <CountUp to={stat.value} suffix={stat.suffix} />
              </span>
              <span className="mt-3 font-mono text-xs font-light text-ink-subtle">
                {stat.label}
              </span>
            </div>
          ))}
        </StaggerGroup>
      </Container>
    </Section>
  );
}
