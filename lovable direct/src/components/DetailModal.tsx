import { AnimatePresence, motion } from "framer-motion";
import { X, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { TileDetail } from "@/lib/dashboardData";

interface DetailModalProps {
  detail: TileDetail | null;
  onClose: () => void;
}

export function DetailModal({ detail, onClose }: DetailModalProps) {
  return (
    <AnimatePresence>
      {detail && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-3 bottom-3 top-20 z-50 overflow-hidden rounded-[2rem] glass-strong md:inset-x-auto md:left-1/2 md:top-1/2 md:bottom-auto md:h-auto md:max-h-[88vh] md:w-[min(680px,92vw)] md:-translate-x-1/2 md:-translate-y-1/2"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-7 pt-7 pb-3">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
                  <detail.icon className="h-3.5 w-3.5" />
                  {detail.label}
                </div>
                <h2 className="mt-1.5 text-2xl text-display text-white">
                  {detail.title}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/80 transition hover:bg-white/15"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(100%-90px)] overflow-y-auto px-7 pb-8">
              {/* Metric row */}
              <div className="mt-2 grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                {detail.metrics.map((m) => (
                  <div key={m.label} className="text-center">
                    <div className="text-display text-2xl text-white sm:text-3xl">
                      {m.value}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-wider text-white/50">
                      {m.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white/90">
                    {detail.chartTitle}
                  </h3>
                  <span
                    className={`flex items-center gap-1 text-xs font-medium ${
                      detail.trendDirection === "up"
                        ? "text-[oklch(0.78_0.2_145)]"
                        : "text-[oklch(0.78_0.18_65)]"
                    }`}
                  >
                    {detail.trendDirection === "up" ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {detail.trendLabel}
                  </span>
                </div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={detail.chartData}
                      margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={detail.chartColor} stopOpacity={0.6} />
                          <stop offset="100%" stopColor={detail.chartColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="oklch(1 0 0 / 8%)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "oklch(1 0 0 / 50%)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fill: "oklch(1 0 0 / 50%)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "oklch(0.18 0.03 260 / 90%)",
                          border: "1px solid oklch(1 0 0 / 15%)",
                          borderRadius: "12px",
                          color: "white",
                          fontSize: "12px",
                          backdropFilter: "blur(20px)",
                        }}
                        cursor={{ stroke: "oklch(1 0 0 / 20%)", strokeWidth: 1 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={detail.chartColor}
                        strokeWidth={2.5}
                        fill="url(#chartFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Status breakdown */}
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <h3 className="mb-4 text-sm font-semibold text-white/90">
                  {detail.breakdownTitle}
                </h3>
                <div className="space-y-3">
                  {detail.breakdown.map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: item.color }}
                      />
                      <span className="flex-1 text-sm text-white/80">{item.label}</span>
                      <span
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: item.color }}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Analysis */}
              <div
                className="mt-5 rounded-2xl border p-5"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.55 0.18 280 / 18%), oklch(0.55 0.18 220 / 14%))",
                  borderColor: "oklch(1 0 0 / 14%)",
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[oklch(0.85_0.12_280)]" />
                  <h3 className="text-sm font-semibold text-white">AI Analysis</h3>
                </div>
                <p className="text-sm leading-relaxed text-white/80">
                  {detail.aiAnalysis}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
