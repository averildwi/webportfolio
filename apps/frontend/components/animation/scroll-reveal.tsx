"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import { MOTION, ScrollTrigger, gsap } from "@/lib/animation/gsap";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { cn } from "@/lib/utils/cn";

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  /** Element to render. Use a heading tag to keep the document outline valid. */
  as?: ElementType;
  /** Seconds to wait after the trigger fires. */
  delay?: number;
  /** Pixels to travel upward into place. */
  distance?: number;
  /** Adds a blur-to-sharp transition alongside the fade. */
  blur?: boolean;
  /** Replays every time the element scrolls into view. */
  repeat?: boolean;
};

/**
 * Fades and lifts its children into place as they enter the viewport.
 *
 * This is the workhorse entrance animation. It is deliberately a single
 * element-level tween rather than a per-word split: splitting text breaks
 * screen-reader flow and text selection, and the added detail is not worth
 * that cost outside of a hero.
 *
 * The element starts hidden via GSAP (not CSS) so that a visitor with
 * JavaScript disabled sees fully visible content rather than a blank page.
 */
export function ScrollReveal({
  children,
  className,
  as: Tag = "div",
  delay = 0,
  distance = 24,
  blur = false,
  repeat = false,
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Reduced motion: leave the element in its natural, visible state.
    if (prefersReducedMotion) {
      gsap.set(element, { clearProps: "all" });
      return;
    }

    // `gsap.context` scopes every tween and ScrollTrigger created inside it, so
    // a single revert() on cleanup removes all of them. Without this, Fast
    // Refresh accumulates duplicate triggers on the same element.
    const context = gsap.context(() => {
      gsap.fromTo(
        element,
        {
          opacity: 0,
          y: distance,
          ...(blur ? { filter: "blur(8px)" } : {}),
        },
        {
          opacity: 1,
          y: 0,
          ...(blur ? { filter: "blur(0px)" } : {}),
          duration: MOTION.duration.base,
          delay,
          ease: MOTION.easeOutExpo,
          scrollTrigger: {
            trigger: element,
            start: MOTION.start,
            // "play none none reverse" would animate backwards when scrolling
            // up past the element, which reads as a glitch on a long page.
            toggleActions: repeat ? "play reverse play reverse" : "play none none none",
            once: !repeat,
          },
        },
      );
    }, element);

    return () => context.revert();
  }, [delay, distance, blur, repeat, prefersReducedMotion]);

  return (
    <Tag ref={ref} className={cn(className)}>
      {children}
    </Tag>
  );
}

type StaggerGroupProps = {
  children: ReactNode;
  className?: string;
  /** CSS selector matching the children to animate, relative to this element. */
  selector?: string;
  delay?: number;
  distance?: number;
  stagger?: number;
};

/**
 * Reveals direct children one after another as the group enters view.
 *
 * Prefer this over wrapping each child in its own `ScrollReveal`: one
 * ScrollTrigger for the group is cheaper than N of them, and the offsets stay
 * consistent regardless of how the children wrap across breakpoints.
 */
export function StaggerGroup({
  children,
  className,
  selector = ":scope > *",
  delay = 0,
  distance = 20,
  stagger = MOTION.stagger,
}: StaggerGroupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (prefersReducedMotion) {
      gsap.set(element.querySelectorAll(selector), { clearProps: "all" });
      return;
    }

    const targets = element.querySelectorAll(selector);
    if (targets.length === 0) return;

    const context = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y: distance },
        {
          opacity: 1,
          y: 0,
          duration: MOTION.duration.base,
          delay,
          stagger,
          ease: MOTION.easeOutExpo,
          scrollTrigger: {
            trigger: element,
            start: MOTION.start,
            once: true,
          },
        },
      );
    }, element);

    return () => context.revert();
  }, [selector, delay, distance, stagger, prefersReducedMotion]);

  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}

type CountUpProps = {
  /** Final value. */
  to: number;
  /** Starting value. */
  from?: number;
  /** Decimal places to display. */
  decimals?: number;
  /** Rendered before the number, e.g. `$`. */
  prefix?: string;
  /** Rendered after the number, e.g. `k` or `+`. */
  suffix?: string;
  duration?: number;
  className?: string;
};

/**
 * Animates a number upward when it scrolls into view.
 *
 * The value is written directly to `textContent` rather than through React
 * state: a 60fps tween would otherwise trigger ~48 re-renders per second per
 * counter. The initial server-rendered markup holds the final value, so the
 * number is correct for crawlers and for reduced-motion users.
 */
export function CountUp({
  to,
  from = 0,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = MOTION.duration.slow,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion) return;

    const format = (value: number) =>
      `${prefix}${value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`;

    const counter = { value: from };
    element.textContent = format(from);

    const context = gsap.context(() => {
      gsap.to(counter, {
        value: to,
        duration,
        ease: MOTION.easeOutQuart,
        onUpdate: () => {
          element.textContent = format(counter.value);
        },
        scrollTrigger: { trigger: element, start: MOTION.start, once: true },
      });
    }, element);

    return () => {
      context.revert();
      // revert() restores the pre-tween DOM, which for textContent we wrote
      // ourselves; put the final value back so the number never reads as 0.
      element.textContent = format(to);
    };
  }, [to, from, decimals, prefix, suffix, duration, prefersReducedMotion]);

  const initial = `${prefix}${to.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {initial}
    </span>
  );
}

/** Re-exported so consumers can refresh triggers after a layout change. */
export function refreshScrollTriggers(): void {
  ScrollTrigger.refresh();
}
