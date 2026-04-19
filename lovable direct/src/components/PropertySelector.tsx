import { motion } from "framer-motion";
import { properties, type Property, type PropertyStatus } from "@/lib/properties";

const statusColor: Record<PropertyStatus, string> = {
  optimal: "oklch(0.78 0.2 145)",
  warning: "oklch(0.82 0.18 75)",
  critical: "oklch(0.66 0.24 22)",
};

const statusLabel: Record<PropertyStatus, string> = {
  optimal: "Optimal",
  warning: "Watch",
  critical: "Critical",
};

interface Props {
  active: Property;
  onChange: (p: Property) => void;
}

export function PropertySelector({ active, onChange }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="-mx-5 sm:-mx-8"
    >
      <div
        className="flex gap-2.5 overflow-x-auto px-5 pb-2 sm:px-8"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {properties.map((p) => {
          const isActive = p.id === active.id;
          return (
            <button
              key={p.id}
              onClick={() => onChange(p)}
              style={{ scrollSnapAlign: "start" }}
              className={`group flex shrink-0 flex-col items-start gap-1.5 rounded-2xl border px-4 py-3 text-left backdrop-blur-xl transition-all ${
                isActive
                  ? "border-white/30 bg-white/15 shadow-[0_8px_32px_oklch(0_0_0/30%)]"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: statusColor[p.status],
                    boxShadow: `0 0 8px ${statusColor[p.status]}`,
                  }}
                />
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                  {p.code}
                </span>
              </div>
              <div className={`text-sm font-semibold ${isActive ? "text-white" : "text-white/80"}`}>
                {p.name}
              </div>
              <div className="text-[10px] text-white/50">{statusLabel[p.status]}</div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
