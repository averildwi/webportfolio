import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  // Inverted fill: the highest-contrast affordance, for the single most
  // important action on a screen.
  primary:
    "bg-ink text-canvas hover:bg-ink-muted active:scale-[0.98] font-semibold",
  // Hairline outline that firms up on hover — for secondary paths that still
  // deserve a box.
  secondary:
    "border border-line-strong text-ink hover:border-ink hover:bg-surface-raised active:scale-[0.98]",
  // No chrome until hovered, for tertiary and destructive-adjacent actions.
  ghost: "text-ink-muted hover:text-ink hover:bg-surface-raised",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 px-4 text-sm gap-1.5",
  md: "h-11 px-6 text-[0.9375rem] gap-2",
  lg: "h-13 px-8 text-base gap-2.5",
};

const BASE_CLASSES =
  "inline-flex items-center justify-center rounded-full whitespace-nowrap " +
  "transition-[background-color,border-color,color,transform] duration-200 " +
  "ease-[cubic-bezier(0.16,1,0.3,1)] " +
  "disabled:pointer-events-none disabled:opacity-50";

type CommonProps = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  /** Rendered before the label. Decorative icons must be aria-hidden. */
  leadingIcon?: ReactNode;
  /** Rendered after the label. */
  trailingIcon?: ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof CommonProps> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<ComponentPropsWithoutRef<"a">, keyof CommonProps> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

/**
 * The primary call-to-action, rendered as whatever element matches its intent.
 *
 * An `href` produces a link; its absence produces a `<button>`. This is not
 * cosmetic. A `<div>` or an `<a href="#">` with an onClick handler is announced
 * incorrectly by screen readers, cannot submit a form, is not reachable by
 * keyboard, and ignores Enter. Rendering the correct element gets all of that
 * behaviour for free.
 *
 * Internal links go through `next/link` for client-side navigation and
 * prefetching; anything external or protocol-based (`mailto:`, `https:`) falls
 * back to a plain anchor.
 */
export function Button(props: ButtonProps) {
  const {
    children,
    variant = "primary",
    size = "md",
    className,
    leadingIcon,
    trailingIcon,
    ...rest
  } = props;

  const classes = cn(
    BASE_CLASSES,
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );

  const content = (
    <>
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </>
  );

  if (props.href !== undefined) {
    const { href, ...anchorProps } = rest as ComponentPropsWithoutRef<"a"> & {
      href: string;
    };

    const isInternal = href.startsWith("/") && !href.startsWith("//");

    if (isInternal) {
      return (
        <Link href={href} className={classes} {...anchorProps}>
          {content}
        </Link>
      );
    }

    // External links opened in a new tab need `rel="noreferrer"`: without it
    // the destination can reach back through `window.opener`.
    const opensNewTab = anchorProps.target === "_blank";

    return (
      <a
        href={href}
        className={classes}
        {...(opensNewTab ? { rel: anchorProps.rel ?? "noopener noreferrer" } : {})}
        {...anchorProps}
      >
        {content}
      </a>
    );
  }

  const buttonProps = rest as ComponentPropsWithoutRef<"button">;

  return (
    <button
      // Default to "button". An unspecified type inside a form defaults to
      // "submit", which makes unrelated buttons submit the form.
      type={buttonProps.type ?? "button"}
      className={classes}
      {...buttonProps}
    >
      {content}
    </button>
  );
}
