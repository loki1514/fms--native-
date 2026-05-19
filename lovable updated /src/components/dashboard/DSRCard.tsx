/**
 * DSRCard.tsx — Daily Stock Consumption mini line-chart card.
 *
 * Responsibility: Show a 7-point stock consumption sparkline with a B/A
 *   (Before/After) summary chip, matching the user's wireframe.
 * Used by: routes/dashboard.$propertyId.tsx.
 *
 * Gotcha: The SVG path is generated client-side from `points` (0-100 range).
 *   Pass normalized values; the card scales to the container.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Package, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";

interface Props {
  /** 7 normalized points (0–100) representing stock consumption per day */
  points: number[];
  before: number;
  after: number;
  unit?: string;
  delay?: number;
  onClick?: () => void;
}

export function DSRCard({
  points,
  before,
  after,
  unit = "units",
  delay = 0,
  onClick,
}: Props) {
  const { linePath, areaPath, lastX, lastY } = useMemo(() => {
    const w = 300;
    const h = 80;
    const stepX = w / (points.length - 1);
    const max = Math.max(...points, 1);
    const coords = points.map((p, i) => ({
      x: i * stepX,
      y: h - (p / max) * h * 0.9 - 4,
    }));
    const linePath = coords
      .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(" ");
    const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;
    const last = coords[coords.length - 1];
    return { linePath, areaPath, lastX: last.x, lastY: last.y };
  }, [points]);

  const delta = after - before;
  const deltaPct = before === 0 ? 0 : Math.round((delta / before) * 100);
  const positive = delta >= 0;

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
            <Package className="h-3.5 w-3.5" />
            Daily Stock Consumption
          </div>
          <ArrowRight className="h-4 w-4 text-white/40 transition-transform group-hover:translate-x-0.5" />
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-display text-4xl font-semibold text-white">
                {after.toLocaleString()}
              </span>
              <span className="text-sm text-white/50">{unit}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[11px]">
              <span className="rounded-md bg-white/8 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-white/70">
                B {before}
              </span>
              <span className="rounded-md bg-white/8 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-white/70">
                A {after}
              </span>
              <span
                className="font-semibold tabular-nums"
                style={{
                  color: positive
                    ? "oklch(0.78 0.2 145)"
                    : "oklch(0.78 0.2 22)",
                }}
              >
                {positive ? "+" : ""}
                {deltaPct}%
              </span>
            </div>
          </div>

          <svg
            viewBox="0 0 300 80"
            preserveAspectRatio="none"
            className="h-16 w-1/2"
          >
            <defs>
              <linearGradient id="dsrFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.7 0.18 230 / 55%)" />
                <stop offset="100%" stopColor="oklch(0.7 0.18 230 / 0%)" />
              </linearGradient>
            </defs>
            <motion.path
              d={areaPath}
              fill="url(#dsrFill)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: delay + 0.3 }}
            />
            <motion.path
              d={linePath}
              fill="none"
              stroke="oklch(0.85 0.16 230)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay: delay + 0.2, ease: "easeOut" }}
            />
            <circle
              cx={lastX}
              cy={lastY}
              r="3.5"
              fill="oklch(0.95 0.05 230)"
              stroke="oklch(0.7 0.18 230)"
              strokeWidth="1.5"
            />
          </svg>
        </div>
      </GlassCard>
    </motion.div>
  );
}
