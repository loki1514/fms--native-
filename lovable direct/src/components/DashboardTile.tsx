import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export type TileVariant = "tickets" | "checklist" | "health" | "energy";

const variantBg: Record<TileVariant, string> = {
  tickets: "var(--gradient-tile-tickets)",
  checklist: "var(--gradient-tile-checklist)",
  health: "var(--gradient-tile-health)",
  energy: "var(--gradient-tile-energy)",
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
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      className={`group glass relative overflow-hidden rounded-3xl p-6 text-left transition-shadow hover:shadow-[0_24px_60px_oklch(0_0_0/45%)] ${className}`}
      style={{ backgroundImage: variantBg[variant] }}
    >
      {/* Inner light */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full opacity-40 blur-3xl"
        style={{ background: "oklch(1 0 0 / 12%)" }}
      />
      <div className="relative z-10 mb-5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/70">
        <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
        <span>{label}</span>
      </div>
      <div className="relative z-10">{children}</div>
    </motion.button>
  );
}
