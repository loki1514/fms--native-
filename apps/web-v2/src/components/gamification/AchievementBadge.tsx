/**
 * AchievementBadge.tsx — Tile showing a single achievement (locked or unlocked).
 *
 * Responsibility: Render the achievement icon in its tinted halo when unlocked,
 *   or muted/desaturated when locked. Includes name + one-line description.
 * Used by: routes/property-admin.tsx (Gamify tab grid).
 * Related: lib/gamification.ts (Achievement shape + `achievements` demo data).
 */

import { motion } from "framer-motion";
import type { Achievement } from "@/lib/gamification";

export function AchievementBadge({ a, delay = 0 }: { a: Achievement; delay?: number }) {
  const Icon = a.icon;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      className={`relative flex flex-col items-center rounded-2xl border p-3 text-center transition ${
        a.unlocked
          ? "border-white/15 bg-white/[0.06] backdrop-blur-xl"
          : "border-white/[0.06] bg-white/[0.02] opacity-60"
      }`}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl"
        style={
          a.unlocked
            ? {
                background: `${a.tint.replace(")", " / 22%)")}`,
                boxShadow: `0 0 18px ${a.tint.replace(")", " / 35%)")}`,
              }
            : { background: "oklch(1 0 0 / 6%)" }
        }
      >
        <Icon
          className="h-5 w-5"
          style={{ color: a.unlocked ? a.tint : "oklch(1 0 0 / 35%)" }}
          strokeWidth={2.2}
        />
      </div>
      <div className="mt-2 text-[11px] font-semibold leading-tight text-white">
        {a.name}
      </div>
      <div className="mt-0.5 text-[10px] leading-tight text-white/50">
        {a.description}
      </div>
    </motion.div>
  );
}
