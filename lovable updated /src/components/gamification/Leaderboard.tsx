/**
 * Leaderboard.tsx — Ranked list of users with rank icon, avatar, and XP.
 *
 * Responsibility: Render LeaderRow[] showing rank 1 = Crown, ranks 2-3 = Medal
 *   (silver/bronze tints), the rest = numeric. Highlights the row where
 *   `isMe === true` with a blue tint.
 * Used by: routes/mst.tsx (Daily Board), routes/property-admin.tsx (Gamify tab).
 * Related: lib/gamification.ts (LeaderRow + weeklyLeaderboard demo data).
 */

import { Crown, Medal } from "lucide-react";
import type { LeaderRow } from "@/lib/gamification";

export function Leaderboard({ rows }: { rows: LeaderRow[] }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const top = r.rank === 1;
        const podium = r.rank <= 3;
        return (
          <div
            key={r.rank}
            className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${
              r.isMe
                ? "border-[oklch(0.7_0.18_235/45%)] bg-[oklch(0.55_0.18_235/18%)]"
                : "border-white/10 bg-white/[0.04]"
            }`}
          >
            <div className="flex w-7 items-center justify-center">
              {top ? (
                <Crown className="h-4 w-4 text-[oklch(0.85_0.18_85)]" />
              ) : podium ? (
                <Medal
                  className="h-4 w-4"
                  style={{
                    color: r.rank === 2 ? "oklch(0.82 0.02 250)" : "oklch(0.7 0.14 50)",
                  }}
                />
              ) : (
                <span className="text-xs font-bold text-white/50 tabular-nums">
                  {r.rank}
                </span>
              )}
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-[oklch(0.45_0.12_265)] to-[oklch(0.3_0.08_270)] text-[11px] font-bold text-white">
              {r.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{r.name}</div>
              <div className="truncate text-[11px] text-white/55">{r.property}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold tabular-nums text-white">
                {r.xp.toLocaleString()}
              </div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                XP
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
