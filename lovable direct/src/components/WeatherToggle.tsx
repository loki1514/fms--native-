import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun, Cloud, CloudRain, ChevronDown } from "lucide-react";
import { weatherModes, type WeatherMode } from "@/lib/weather";

const iconMap = {
  moon: Moon,
  sun: Sun,
  cloud: Cloud,
  rain: CloudRain,
};

interface Props {
  mode: WeatherMode;
  onChange: (mode: WeatherMode) => void;
}

export function WeatherToggle({ mode, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const current = weatherModes.find((m) => m.id === mode)!;
  const Icon = iconMap[current.icon];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white backdrop-blur-xl transition hover:bg-white/10"
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="tabular-nums">{current.temp}</span>
        <ChevronDown
          className={`h-3 w-3 text-white/60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-2xl border border-white/15 bg-[oklch(0.18_0.03_260/90%)] p-1.5 backdrop-blur-2xl shadow-[0_20px_60px_oklch(0_0_0/50%)]"
            >
              {weatherModes.map((m) => {
                const ItemIcon = iconMap[m.icon];
                const active = m.id === mode;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      onChange(m.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-white/10 text-white"
                        : "text-white/75 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <ItemIcon className="h-4 w-4" />
                    <span className="flex-1">{m.label}</span>
                    <span className="text-xs tabular-nums text-white/50">
                      {m.temp}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
