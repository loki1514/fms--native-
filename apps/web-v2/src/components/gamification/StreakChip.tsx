/**
 * StreakChip.tsx — Small flame chip showing the user's day-streak count.
 *
 * Responsibility: Pure display — formats `{streak}d` with a flame icon and
 *   warm orange tint. Caller decides where it appears.
 * Used by: routes/property-admin.tsx, routes/mst.tsx (Gamify strips).
 */

import { Flame } from "lucide-react";

export function StreakChip({ streak }: { streak: number }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-[oklch(0.7_0.22_35/35%)] bg-[oklch(0.7_0.22_35/18%)] px-2.5 py-1 text-xs font-semibold text-[oklch(0.92_0.14_40)]">
      <Flame className="h-3.5 w-3.5" />
      <span className="tabular-nums">{streak}d</span>
    </div>
  );
}
