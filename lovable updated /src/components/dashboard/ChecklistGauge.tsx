/**
 * ChecklistGauge.tsx — Half-circle progress gauge for the daily checklist.
 *
 * Responsibility: SVG arc gauge showing completed/total with the score in the
 *   centre. Replaces the linear progress bar used previously, matching the
 *   user's wireframe.
 * Used by: routes/dashboard.$propertyId.tsx (added card row).
 *
 * Gotcha: The arc geometry is hard-coded for a 180×100 viewBox (half donut).
 *   To resize, scale the wrapper — don't touch the path math.
 */

import { motion } from "framer-motion";
import { CheckSquare, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";

interface Props {
  value: number;
  total?: number;
  delay?: number;
  onClick?: () => void;
}

// Half-circle path from (10,100) sweeping up to (170,100), radius 80
const ARC = "M 10 100 A 80 80 0 0 1 170 100";
const ARC_LENGTH = Math.PI * 80; // ≈ 251.3

export function ChecklistGauge({ value, total = 100, delay = 0, onClick }: Props) {
  const pct = Math.max(0, Math.min(1, value / total));
  const dash = ARC_LENGTH * pct;
  const gap = ARC_LENGTH - dash;

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
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">
            <CheckSquare className="h-3.5 w-3.5" />
            Checklist
          </div>
          <ArrowRight className="h-4 w-4 text-white/40 transition-transform group-hover:translate-x-0.5" />
        </div>

        <div className="relative mx-auto w-full max-w-[200px]">
          <svg viewBox="0 0 180 110" className="w-full">
            {/* Track */}
            <path
              d={ARC}
              fill="none"
              stroke="oklch(1 0 0 / 10%)"
              strokeWidth="14"
              strokeLinecap="round"
            />
            {/* Progress */}
            <motion.path
              d={ARC}
              fill="none"
              stroke="url(#checklistGrad)"
              strokeWidth="14"
              strokeLinecap="round"
              initial={{ strokeDasharray: `0 ${ARC_LENGTH}` }}
              animate={{ strokeDasharray: `${dash} ${gap}` }}
              transition={{ duration: 1.1, delay: delay + 0.2, ease: [0.22, 1, 0.36, 1] }}
            />
            <defs>
              <linearGradient id="checklistGrad" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="oklch(0.78 0.2 145)" />
                <stop offset="100%" stopColor="oklch(0.85 0.18 155)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
            <div className="flex items-baseline gap-1">
              <span className="text-display text-4xl font-semibold leading-none text-white">
                {value}
              </span>
              <span className="text-sm text-white/55">/ {total}</span>
            </div>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/55">
              {Math.round(pct * 100)}% completed
            </span>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}
