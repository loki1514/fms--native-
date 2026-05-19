/**
 * WeatherScene.tsx — Full-viewport atmospheric background driven by WeatherMode.
 *
 * Responsibility: Cross-fades a sky gradient and overlays mode-specific layers
 *   (stars + moon for night, conic sun rays for sunny, drifting clouds, falling
 *   rain). Pure decoration — pointer-events disabled, sits behind app content.
 * Used by: routes/dashboard.$propertyId.tsx as a fixed -z-0 background.
 * Related: StarField (night sparkles), lib/weather.ts (mode enum), AtmosphereLayers.
 *
 * Gotcha: All randomized arrays use useMemo keyed on inputs to avoid re-shuffling
 *   on every render. Sub-components (Clouds/Rain/SunRays/NightClouds) are local —
 *   not exported — because they are tightly coupled to mode rendering here.
 */

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StarField } from "./StarField";
import type { WeatherMode } from "@/lib/weather";

const skyGradients: Record<WeatherMode, string> = {
  "clear-night":
    "radial-gradient(120% 80% at 50% 0%, oklch(0.32 0.08 250) 0%, oklch(0.18 0.05 260) 45%, oklch(0.1 0.03 265) 100%)",
  sunny:
    "radial-gradient(120% 90% at 50% 0%, oklch(0.78 0.14 75) 0%, oklch(0.68 0.16 35) 40%, oklch(0.42 0.18 20) 90%)",
  cloudy:
    "radial-gradient(120% 90% at 50% 0%, oklch(0.55 0.04 240) 0%, oklch(0.38 0.04 250) 50%, oklch(0.22 0.04 260) 100%)",
  rainy:
    "radial-gradient(120% 90% at 50% 0%, oklch(0.32 0.04 245) 0%, oklch(0.22 0.04 255) 45%, oklch(0.12 0.03 260) 100%)",
};

function Clouds({ density = 4, opacity = 0.5 }: { density?: number; opacity?: number }) {
  const clouds = useMemo(
    () =>
      Array.from({ length: density }).map((_, i) => ({
        top: 5 + Math.random() * 55,
        size: 280 + Math.random() * 320,
        delay: i * 4,
        duration: 50 + Math.random() * 40,
        blur: 40 + Math.random() * 40,
        opacity: opacity * (0.5 + Math.random() * 0.5),
      })),
    [density, opacity],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {clouds.map((c, i) => (
        <motion.div
          key={i}
          initial={{ x: "-30%" }}
          animate={{ x: "130%" }}
          transition={{ duration: c.duration, delay: c.delay, repeat: Infinity, ease: "linear" }}
          className="absolute rounded-full"
          style={{
            top: `${c.top}%`,
            width: c.size,
            height: c.size * 0.45,
            background: "oklch(0.92 0.01 250)",
            filter: `blur(${c.blur}px)`,
            opacity: c.opacity,
          }}
        />
      ))}
    </div>
  );
}

function NightClouds() {
  const clouds = useMemo(
    () =>
      Array.from({ length: 4 }).map((_, i) => ({
        top: 35 + Math.random() * 45,
        size: 360 + Math.random() * 280,
        delay: i * 6,
        duration: 70 + Math.random() * 30,
        blur: 50 + Math.random() * 30,
        opacity: 0.18 + Math.random() * 0.15,
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {clouds.map((c, i) => (
        <motion.div
          key={i}
          initial={{ x: "-30%" }}
          animate={{ x: "130%" }}
          transition={{
            duration: c.duration,
            delay: c.delay,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute rounded-full"
          style={{
            top: `${c.top}%`,
            width: c.size,
            height: c.size * 0.42,
            background:
              "linear-gradient(180deg, oklch(0.5 0.05 255) 0%, oklch(0.28 0.04 260) 100%)",
            filter: `blur(${c.blur}px)`,
            opacity: c.opacity,
          }}
        />
      ))}
    </div>
  );
}

function SunRays() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
        className="absolute -top-40 left-1/2 h-[900px] w-[900px] -translate-x-1/2"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, oklch(0.95 0.15 80 / 18%) 10deg, transparent 20deg, transparent 40deg, oklch(0.95 0.15 80 / 12%) 50deg, transparent 60deg, transparent 90deg, oklch(0.95 0.15 80 / 16%) 100deg, transparent 110deg, transparent 180deg, oklch(0.95 0.15 80 / 14%) 190deg, transparent 200deg, transparent 270deg, oklch(0.95 0.15 80 / 12%) 280deg, transparent 290deg)",
          maskImage: "radial-gradient(circle, black 0%, transparent 65%)",
          WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 65%)",
        }}
      />
      {/* Sun core */}
      <div
        className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, oklch(0.95 0.18 85 / 90%) 0%, oklch(0.85 0.2 60 / 40%) 40%, transparent 70%)",
        }}
      />
      {/* Lens flare specks */}
      <motion.div
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute top-1/4 right-1/4 h-3 w-3 rounded-full bg-white blur-sm"
      />
    </div>
  );
}

function Rain({ count = 120 }: { count?: number }) {
  const drops = useMemo(
    () =>
      Array.from({ length: count }).map(() => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        duration: 0.5 + Math.random() * 0.6,
        height: 12 + Math.random() * 18,
        opacity: 0.25 + Math.random() * 0.5,
      })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {drops.map((d, i) => (
        <motion.span
          key={i}
          initial={{ y: "-10vh", opacity: 0 }}
          animate={{ y: "110vh", opacity: d.opacity }}
          transition={{
            duration: d.duration,
            delay: d.delay,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute w-px"
          style={{
            left: `${d.left}%`,
            height: d.height,
            background:
              "linear-gradient(180deg, transparent, oklch(0.85 0.05 230 / 80%))",
          }}
        />
      ))}
    </div>
  );
}

function Vignette() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, transparent 50%, oklch(0 0 0 / 45%) 100%)",
      }}
    />
  );
}

export function WeatherScene({ mode }: { mode: WeatherMode }) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
      {/* Sky gradient cross-fade */}
      <AnimatePresence>
        <motion.div
          key={mode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute inset-0"
          style={{ background: skyGradients[mode] }}
        />
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {mode === "clear-night" && (
          <motion.div
            key="night"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0"
          >
            <StarField count={110} />

            {/* Moon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-[8%] top-[10%]"
            >
              {/* Outer halo */}
              <div
                className="absolute -inset-32 rounded-full blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle, oklch(0.92 0.04 240 / 28%) 0%, oklch(0.7 0.06 250 / 12%) 40%, transparent 70%)",
                }}
              />
              {/* Moon disc */}
              <div
                className="relative h-28 w-28 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 35% 30%, oklch(0.96 0.01 90) 0%, oklch(0.88 0.02 80) 45%, oklch(0.72 0.03 70) 100%)",
                  boxShadow:
                    "0 0 60px oklch(0.9 0.05 240 / 40%), inset -8px -10px 24px oklch(0.4 0.04 260 / 60%)",
                }}
              >
                {/* Craters */}
                <span
                  className="absolute h-3 w-3 rounded-full"
                  style={{
                    top: "30%",
                    left: "55%",
                    background: "oklch(0.78 0.02 80 / 70%)",
                    boxShadow: "inset 1px 1px 2px oklch(0.5 0.03 70)",
                  }}
                />
                <span
                  className="absolute h-2 w-2 rounded-full"
                  style={{
                    top: "55%",
                    left: "35%",
                    background: "oklch(0.78 0.02 80 / 60%)",
                    boxShadow: "inset 1px 1px 2px oklch(0.5 0.03 70)",
                  }}
                />
                <span
                  className="absolute h-1.5 w-1.5 rounded-full"
                  style={{
                    top: "65%",
                    left: "60%",
                    background: "oklch(0.78 0.02 80 / 55%)",
                  }}
                />
              </div>
            </motion.div>

            {/* Low drifting night clouds */}
            <NightClouds />
          </motion.div>
        )}


        {mode === "sunny" && (
          <motion.div
            key="sunny"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0"
          >
            <SunRays />
            <Clouds density={2} opacity={0.45} />
          </motion.div>
        )}

        {mode === "cloudy" && (
          <motion.div
            key="cloudy"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0"
          >
            <Clouds density={6} opacity={0.7} />
          </motion.div>
        )}

        {mode === "rainy" && (
          <motion.div
            key="rainy"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0"
          >
            <Clouds density={5} opacity={0.55} />
            <Rain count={140} />
          </motion.div>
        )}
      </AnimatePresence>

      <Vignette />
    </div>
  );
}
