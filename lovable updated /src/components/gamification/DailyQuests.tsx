/**
 * DailyQuests.tsx — Vertical list of today's quests with progress bars + XP reward.
 *
 * Responsibility: Render each Quest with a checkbox icon, title (struck-through
 *   when complete), progress (current/total), reward chip, and a thin progress
 *   bar. Read-only display.
 * Used by: routes/property-admin.tsx, routes/mst.tsx (Gamify tab).
 * Related: lib/gamification.ts (Quest shape + dailyQuests demo data).
 */

import { CheckCircle2, Circle } from "lucide-react";
import type { Quest } from "@/lib/gamification";

export function DailyQuests({ quests }: { quests: Quest[] }) {
  return (
    <div className="flex flex-col gap-2">
      {quests.map((q) => {
        const done = q.progress >= q.total;
        const pct = Math.min(100, (q.progress / q.total) * 100);
        return (
          <div
            key={q.id}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
          >
            <div className="flex items-center gap-3">
              {done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[oklch(0.78_0.2_145)]" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-white/35" />
              )}
              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm font-medium ${done ? "text-white/55 line-through" : "text-white"}`}
                >
                  {q.title}
                </div>
                <div className="mt-0.5 text-[11px] text-white/50 tabular-nums">
                  {q.progress}/{q.total}
                </div>
              </div>
              <div className="rounded-full bg-[oklch(0.7_0.2_280/22%)] px-2.5 py-1 text-[11px] font-bold text-[oklch(0.88_0.14_285)]">
                +{q.reward} XP
              </div>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[oklch(0.7_0.18_235)] to-[oklch(0.78_0.2_145)] transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
