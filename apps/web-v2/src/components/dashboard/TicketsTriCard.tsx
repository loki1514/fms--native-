/**
 * TicketsTriCard.tsx — Three-stat tickets card (Open / In Progress / Resolved).
 *
 * Responsibility: A horizontal card showing three big numerals split by thin
 *   dividers, matching the user's wireframe. Each cell highlights with a tinted
 *   accent dot to signal severity.
 * Used by: routes/dashboard.$propertyId.tsx (replaces the legacy single-number
 *   tickets summary while leaving the existing detailed Tickets tile intact).
 *
 * Gotcha: Numbers are passed in by the parent so this stays presentational —
 *   wire to live data at the route level.
 */

import { motion } from "framer-motion";
import { Ticket, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";

interface Stat {
  label: string;
  value: number;
  tone: "open" | "progress" | "resolved";
}

const toneColor: Record<Stat["tone"], string> = {
  open: "oklch(0.66 0.24 22)",       // critical red
  progress: "oklch(0.82 0.18 75)",   // amber
  resolved: "oklch(0.78 0.2 145)",   // green
};

interface Props {
  stats: [Stat, Stat, Stat];
  delay?: number;
  onClick?: () => void;
}

export function TicketsTriCard({ stats, delay = 0, onClick }: Props) {
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
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">
            <Ticket className="h-3.5 w-3.5" />
            Tickets
          </div>
          <ArrowRight className="h-4 w-4 text-white/40 transition-transform group-hover:translate-x-0.5" />
        </div>

        <div className="grid grid-cols-3 divide-x divide-white/10">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`flex flex-col items-center justify-center px-2 py-1 ${i === 0 ? "pl-0" : ""} ${i === 2 ? "pr-0" : ""}`}
            >
              <div className="text-display text-4xl font-semibold leading-none text-white sm:text-5xl">
                {s.value.toLocaleString()}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: toneColor[s.tone],
                    boxShadow: `0 0 8px ${toneColor[s.tone]}`,
                  }}
                />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  {s.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
}
