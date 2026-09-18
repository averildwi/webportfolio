import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type SectionProps = {
  children: ReactNode;
  className?: string;
  /** Anchor target for in-page navigation. */
  id?: string;
  /** Vertical rhythm. `none` is for sections that manage their own padding. */
  spacing?: "none" | "sm" | "md" | "lg";
};

const SPACING_CLASSES = {
  none: "",
  sm: "py-16 sm:py-20",
  md: "py-20 sm:py-28 lg:py-36",
  lg: "py-28 sm:py-36 lg:py-48",
} as const;

/**
 * A full-width page section with consistent vertical rhythm.
 *
 * Sections own their vertical spacing rather than relying on margins between
 * siblings, which keeps spacing predictable when sections are reordered and
 * avoids margin collapsing surprises.
 *
 * `scroll-mt-24` offsets in-page anchor jumps so a targeted heading is not
 * hidden beneath the fixed header.
 */
export function Section({
  children,
  className,
  id,
  spacing = "md",
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative w-full",
        SPACING_CLASSES[spacing],
        id && "scroll-mt-24",
        className,
      )}
    >
      {children}
    </section>
  );
}

type ContainerProps = {
  children: ReactNode;
  className?: string;
  /** `narrow` suits long-form prose, where a wide measure hurts readability. */
  width?: "narrow" | "default" | "wide";
};

const WIDTH_CLASSES = {
  narrow: "max-w-3xl",
  default: "max-w-7xl",
  wide: "max-w-[90rem]",
} as const;

/** Centers content in a width-constrained column with responsive gutters. */
export function Container({
  children,
  className,
  width = "default",
}: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8 lg:px-12",
        WIDTH_CLASSES[width],
        className,
      )}
    >
      {children}
    </div>
  );
}

type SectionHeadingProps = {
  /** Small mono label above the title, e.g. "Selected work". */
  eyebrow?: string;
  title: ReactNode;
  /** Supporting copy, set in mono to echo the reference design's rhythm. */
  description?: ReactNode;
  /**
   * Heading level. Defaults to `h2`, correct for a section inside a page whose
   * `h1` is the hero. Never pick a level for its size — use `className`.
   */
  as?: ElementType;
  align?: "left" | "center";
  className?: string;
};

/**
 * The standard section header: eyebrow, title, and optional description.
 *
 * Centralized so every section shares one type scale and one set of spacings.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  as: Tag = "h2",
  align = "left",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow && <span className="label-mono mb-4">{eyebrow}</span>}
      <Tag className="text-3xl font-medium leading-[1.15] tracking-tight text-balance sm:text-4xl lg:text-5xl">
        {title}
      </Tag>
      {description && (
        <p
          className={cn(
            "mt-5 font-mono text-sm font-light leading-relaxed text-ink-muted",
            align === "center" ? "max-w-2xl" : "max-w-xl",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
