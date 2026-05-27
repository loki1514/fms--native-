/**
 * XPBar.tsx — Slim animated progress bar showing XP toward the next level.
 *
 * Responsibility: Render the XP/next label row + a gradient fill animated from
 *   0 → current %. Caller provides current xp and the threshold for next level.
 * Used by: routes/property-admin.tsx, routes/mst.tsx (Gamify strip).
 * Related: LevelBadge (often paired), lib/gamification.ts (UserStats).
 */

import { motion } from "framer-motion";

// ── Props ──────────────────────────────────────────
interface Props {
  xp: number;
  xpForNext: number;
  className?: string;
}

export function XPBar({ xp, xpForNext, className = "" }: Props) {
  const pct = Math.min(100, (xp / xpForNext) * 100);
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
        <span>XP</span>
        <span className="tabular-nums text-white/80">
          {xp.toLocaleString()} / {xpForNext.toLocaleString()}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full bg-gradient-to-r from-[oklch(0.7_0.18_235)] via-[oklch(0.7_0.2_280)] to-[oklch(0.78_0.2_145)] shadow-[0_0_12px_oklch(0.7_0.2_280/60%)]"
        />
      </div>
    </div>
  );
}
