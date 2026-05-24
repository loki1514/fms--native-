/**
 * DashboardTile.tsx — Tappable glass tile used on the property dashboard grid.
 *
 * Responsibility: Render a labelled card with a tinted icon badge in the header
 *   and free-form children below. Variant chooses the accent tint; `onClick`
 *   typically opens the DetailModal for that metric.
 * Used by: routes/dashboard.$propertyId.tsx (tickets/checklist/health/energy).
 * Related: GlassCard (uses similar styling), DetailModal (the click target).
 */

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export type TileVariant = "tickets" | "checklist" | "health" | "energy";

const variantTint: Record<TileVariant, string> = {
  tickets: "oklch(0.7 0.22 25)",
  checklist: "oklch(0.78 0.2 145)",
  health: "oklch(0.66 0.24 22)",
  energy: "oklch(0.78 0.18 65)",
};

interface DashboardTileProps {
  icon: LucideIcon;
  label: string;
  variant: TileVariant;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
  delay?: number;
}

export function DashboardTile({
  icon: Icon,
  label,
  variant,
  className = "",
  onClick,
  children,
  delay = 0,
}: DashboardTileProps) {
  const tint = variantTint[variant];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      className={`group relative overflow-hidden rounded-3xl border border-white/[0.12] bg-white/[0.06] p-5 text-left backdrop-blur-2xl shadow-[0_12px_40px_oklch(0_0_0/35%)] transition-shadow hover:shadow-[0_24px_60px_oklch(0_0_0/45%)] ${className}`}
    >
      <div
        className="pointer-events-none absolute -top-20 -right-20 h-44 w-44 rounded-full opacity-30 blur-3xl"
        style={{ background: tint }}
        aria-hidden
      />
      <div className="relative z-10 mb-4 flex items-center gap-2.5">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-xl"
          style={{
            background: `${tint.replace(")", " / 22%)")}`,
            boxShadow: `0 0 14px ${tint.replace(")", " / 30%)")}`,
          }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: tint }} strokeWidth={2.6} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
          {label}
        </span>
      </div>
      <div className="relative z-10">{children}</div>
    </motion.button>
  );
}
