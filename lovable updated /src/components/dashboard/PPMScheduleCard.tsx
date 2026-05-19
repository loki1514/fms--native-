/**
 * PPMScheduleCard.tsx — Upcoming preventive maintenance schedule card.
 *
 * Responsibility: List the next PPM jobs with date + asset + status pill,
 *   matching the user's wireframe (e.g., 17 Apr · VRF AHU · Pending).
 * Used by: routes/dashboard.$propertyId.tsx.
 *
 * Gotcha: Status colors come from a small map — extend it if new statuses are
 *   added (e.g., "overdue").
 */

import { motion } from "framer-motion";
import { CalendarClock, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";

export type PPMStatus = "pending" | "scheduled" | "done";

export interface PPMItem {
  date: string;     // e.g. "17 Apr"
  asset: string;    // e.g. "VRF AHU"
  status: PPMStatus;
}

const statusStyle: Record<PPMStatus, { color: string; label: string }> = {
  pending: { color: "oklch(0.82 0.18 75)", label: "Pending" },
  scheduled: { color: "oklch(0.7 0.15 230)", label: "Scheduled" },
  done: { color: "oklch(0.78 0.2 145)", label: "Done" },
};

interface Props {
  items: PPMItem[];
  delay?: number;
  onClick?: () => void;
}

export function PPMScheduleCard({ items, delay = 0, onClick }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard
        onClick={onClick}
        className="group cursor-pointer p-5 transition hover:bg-white/[0.06]"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">
            <CalendarClock className="h-3.5 w-3.5" />
            PPM Schedule
          </div>
          <ArrowRight className="h-4 w-4 text-white/40 transition-transform group-hover:translate-x-0.5" />
        </div>

        <ul className="flex flex-col gap-3">
          {items.map((it, i) => {
            const s = statusStyle[it.status];
            return (
              <li
                key={i}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
              >
                <div className="flex h-10 w-12 flex-col items-center justify-center rounded-lg bg-white/10 text-white">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-white/60">
                    {it.date.split(" ")[1] ?? ""}
                  </span>
                  <span className="text-display text-base font-semibold leading-none">
                    {it.date.split(" ")[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium text-white">
                    {it.asset}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-white/50">
                    Preventive maintenance
                  </div>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    background: `${s.color}22`,
                    color: s.color,
                    boxShadow: `inset 0 0 0 1px ${s.color}55`,
                  }}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ul>
      </GlassCard>
    </motion.div>
  );
}
