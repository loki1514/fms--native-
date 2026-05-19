/**
 * WeatherToggle.tsx — Orb-centric weather pill with temp overlaid on the PNG.
 *
 * Responsibility: Render a backgroundless weather control where a large
 *   celestial body (moon/sun/cloud/rain) is the centerpiece and the
 *   temperature sits CENTERED on top of it with a high-contrast tint
 *   tuned per-mode. Label sits under the orb.
 * Used by: routes/dashboard.$propertyId.tsx (header, right of title).
 *
 * Design rationale: User feedback — orbs need to read clearly and the temp
 *   should overlay (not sit beside) the PNG so the composition feels like a
 *   single sticker. A subtle radial halo behind the orb lifts it off any
 *   weather scene background.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { weatherModes, type WeatherMode } from "@/lib/weather";
import moonImg from "@/assets/weather-moon.png";
import sunImg from "@/assets/weather-sun.png";
import cloudImg from "@/assets/weather-cloud.png";
import rainImg from "@/assets/weather-rain.png";

const imageMap: Record<WeatherMode, string> = {
  "clear-night": moonImg,
  sunny: sunImg,
  cloudy: cloudImg,
  rainy: rainImg,
};

// Per-mode temperature color — chosen to contrast against each orb
const tempColorMap: Record<WeatherMode, string> = {
  "clear-night": "text-[oklch(0.22_0.05_265)]", // deep navy on cream moon
  sunny: "text-white",                            // white on orange sun
  cloudy: "text-[oklch(0.28_0.04_260)]",          // dark slate on white cloud
  rainy: "text-white",                            // white on dark rain cloud
};

// Subtle halo behind each orb so it pops against any sky
const haloMap: Record<WeatherMode, string> = {
  "clear-night":
    "radial-gradient(circle, oklch(0.95 0.04 90 / 35%) 0%, transparent 65%)",
  sunny:
    "radial-gradient(circle, oklch(0.85 0.2 60 / 55%) 0%, transparent 65%)",
  cloudy:
    "radial-gradient(circle, oklch(0.95 0 0 / 30%) 0%, transparent 65%)",
  rainy:
    "radial-gradient(circle, oklch(0.55 0.05 260 / 40%) 0%, transparent 65%)",
};

interface Props {
  mode: WeatherMode;
  onChange: (mode: WeatherMode) => void;
}

export function WeatherToggle({ mode, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const current = weatherModes.find((m) => m.id === mode)!;

  // Per-mode idle motion — looped after the entrance settles
  const idleAnim =
    mode === "clear-night"
      ? { rotate: [0, 360] }
      : mode === "sunny"
        ? { scale: [1, 1.06, 1] }
        : mode === "cloudy"
          ? { x: [0, 6, 0, -6, 0], y: [0, -3, 0, 3, 0] }
          : { y: [0, -4, 0] };

  const idleTransition =
    mode === "clear-night"
      ? { duration: 60, repeat: Infinity, ease: "linear" as const }
      : mode === "sunny"
        ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" as const }
        : mode === "cloudy"
          ? { duration: 8, repeat: Infinity, ease: "easeInOut" as const }
          : { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const };

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((v) => !v)}
        className="group relative flex h-[140px] w-[170px] flex-col items-center justify-center"
      >
        {/* Soft halo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: haloMap[mode] }}
        />

        {/* Sunny: rotating ray burst behind the sun */}
        {mode === "sunny" && (
          <motion.div
            aria-hidden
            animate={{ rotate: 360 }}
            transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-[58%]"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, oklch(0.92 0.18 75 / 60%) 8deg, transparent 18deg, transparent 45deg, oklch(0.92 0.18 75 / 60%) 53deg, transparent 63deg, transparent 90deg, oklch(0.92 0.18 75 / 60%) 98deg, transparent 108deg, transparent 135deg, oklch(0.92 0.18 75 / 60%) 143deg, transparent 153deg, transparent 180deg, oklch(0.92 0.18 75 / 60%) 188deg, transparent 198deg, transparent 225deg, oklch(0.92 0.18 75 / 60%) 233deg, transparent 243deg, transparent 270deg, oklch(0.92 0.18 75 / 60%) 278deg, transparent 288deg, transparent 315deg, oklch(0.92 0.18 75 / 60%) 323deg, transparent 333deg, transparent 360deg)",
              maskImage:
                "radial-gradient(circle, transparent 38%, black 42%, black 78%, transparent 86%)",
              WebkitMaskImage:
                "radial-gradient(circle, transparent 38%, black 42%, black 78%, transparent 86%)",
              filter: "blur(2px)",
            }}
          />
        )}

        {/* Orb — the visual anchor */}
        <motion.img
          key={mode}
          src={imageMap[mode]}
          alt=""
          aria-hidden
          width={1024}
          height={1024}
          loading="lazy"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, ...idleAnim }}
          transition={{
            opacity: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
            scale:
              mode === "sunny"
                ? idleTransition
                : { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
            rotate: mode === "clear-night" ? idleTransition : undefined,
            x: mode === "cloudy" ? idleTransition : undefined,
            y:
              mode === "cloudy" || mode === "rainy"
                ? idleTransition
                : undefined,
          }}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[140px] w-[140px] -translate-x-1/2 -translate-y-[58%] object-contain drop-shadow-[0_12px_32px_oklch(0_0_0/50%)]"
        />

        {/* Sunny: small drifting cloud overlay across the sun */}
        {mode === "sunny" && (
          <motion.img
            aria-hidden
            src={cloudImg}
            initial={{ x: -60, opacity: 0 }}
            animate={{ x: [-55, 55, -55], opacity: [0, 0.9, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[60px] w-[60px] -translate-y-[40%] object-contain drop-shadow-[0_4px_10px_oklch(0_0_0/30%)]"
          />
        )}

        {/* Temperature — centered ON TOP of the orb */}
        <span
          className={`relative z-10 mt-1 text-display text-[42px] font-semibold leading-none tracking-tight ${tempColorMap[mode]} drop-shadow-[0_2px_8px_oklch(1_0_0/40%)]`}
        >
          {current.temp}
        </span>

        {/* Label under the orb */}
        <span className="relative z-10 mt-[78px] flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90 drop-shadow-[0_2px_6px_oklch(0_0_0/70%)]">
          {current.label}
          <ChevronDown
            className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-white/15 bg-[oklch(0.18_0.03_260/92%)] p-1.5 backdrop-blur-2xl shadow-[0_20px_60px_oklch(0_0_0/50%)]"
            >
              {weatherModes.map((m) => {
                const active = m.id === mode;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      onChange(m.id);
                      setOpen(false);
                    }}
                    className={`relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-white/10 text-white"
                        : "text-white/75 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <img
                      src={imageMap[m.id]}
                      alt=""
                      aria-hidden
                      className="h-9 w-9 object-contain drop-shadow-[0_4px_10px_oklch(0_0_0/40%)]"
                    />
                    <span className="flex-1">{m.label}</span>
                    <span className="text-display text-base tabular-nums text-white/85">
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
