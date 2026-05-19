/**
 * GlassCard.tsx — The atmospheric-glass card primitive used everywhere.
 *
 * Responsibility: Wrap children in a translucent rounded surface with a
 *   blurred background, subtle border, and shadow. Optional `glow` prop paints
 *   a soft colored blob in the top-right corner for accent.
 * Used by: virtually every route + gamification component. Always prefer this
 *   over re-creating the bg-white/* + backdrop-blur recipe inline.
 *
 * Variants:
 *   - default → standard surface (most cards)
 *   - strong  → higher opacity + heavier shadow (modals, hero strips)
 *   - subtle  → lighter for nested or secondary surfaces
 */

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

type Variant = "default" | "strong" | "subtle";

const variantClass: Record<Variant, string> = {
  default:
    "bg-white/[0.06] border border-white/[0.12] backdrop-blur-2xl shadow-[0_12px_40px_oklch(0_0_0/35%)]",
  strong:
    "bg-white/[0.10] border border-white/[0.16] backdrop-blur-2xl shadow-[0_20px_60px_oklch(0_0_0/45%)]",
  subtle:
    "bg-white/[0.035] border border-white/[0.08] backdrop-blur-xl shadow-[0_8px_24px_oklch(0_0_0/30%)]",
};

interface GlassCardProps extends HTMLMotionProps<"div"> {
  variant?: Variant;
  glow?: string; // CSS color for inner glow blob
  children: React.ReactNode;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ variant = "default", glow, className = "", children, ...rest }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={`relative overflow-hidden rounded-3xl ${variantClass[variant]} ${className}`}
        {...rest}
      >
        {glow && (
          <div
            className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-50 blur-3xl"
            style={{ background: glow }}
            aria-hidden
          />
        )}
        <div className="relative z-10">{children}</div>
      </motion.div>
    );
  },
);
GlassCard.displayName = "GlassCard";
