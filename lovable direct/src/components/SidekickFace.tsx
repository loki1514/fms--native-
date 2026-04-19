import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export type FaceState = "idle" | "listening" | "speaking";

interface Props {
  className?: string;
  compact?: boolean;
  size?: number;
  state?: FaceState;
  onClick?: () => void;
}

/**
 * White Sidekick face with multi-hue ambient glow.
 * Eyes blink naturally; mouth morphs by state.
 */
export function SidekickFace({
  className = "",
  compact = false,
  size,
  state: stateProp,
  onClick,
}: Props) {
  const [internalState, setInternalState] = useState<FaceState>("idle");
  const state = stateProp ?? internalState;
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    let alive = true;
    const loop = () => {
      if (!alive) return;
      const next = 2200 + Math.random() * 3200;
      setTimeout(() => {
        if (!alive) return;
        setBlink(true);
        setTimeout(() => setBlink(false), 130);
        loop();
      }, next);
    };
    loop();
    return () => {
      alive = false;
    };
  }, []);

  const handleClick = () => {
    if (onClick) return onClick();
    setInternalState((s) =>
      s === "idle" ? "listening" : s === "listening" ? "speaking" : "idle",
    );
  };

  const mouthVariants = {
    idle: { d: "M 38 60 Q 60 70 82 60" },
    listening: { d: "M 38 62 Q 60 62 82 62" },
    speaking: { d: "M 38 58 Q 60 78 82 58" },
  } as const;

  const eyeY = blink ? 0.08 : state === "listening" ? 0.85 : 1;
  const dim = size ?? (compact ? 52 : 120);

  return (
    <button
      onClick={handleClick}
      aria-label={`Sidekick — ${state}`}
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: dim, height: dim }}
    >
      {/* Multi-hue ambient halo */}
      <div
        className="absolute inset-0 -z-10 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, oklch(0.85 0.18 30 / 55%), oklch(0.85 0.18 145 / 55%), oklch(0.85 0.18 235 / 55%), oklch(0.85 0.18 295 / 55%), oklch(0.85 0.18 30 / 55%))",
          filter: "blur(10px)",
          opacity: 0.85,
        }}
      />

      <motion.div
        animate={{
          scale:
            state === "speaking"
              ? [1, 1.06, 1]
              : state === "listening"
                ? [1, 1.025, 1]
                : 1,
          rotate: 360,
        }}
        transition={{
          scale: {
            duration: state === "speaking" ? 0.5 : 2.2,
            repeat: Infinity,
            ease: "easeInOut",
          },
          rotate: { duration: 18, repeat: Infinity, ease: "linear" },
        }}
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: "82%",
          height: "82%",
          background:
            "radial-gradient(circle at 35% 28%, oklch(1 0 0) 0%, oklch(0.96 0.02 250) 55%, oklch(0.85 0.05 280) 100%)",
          boxShadow:
            "inset 0 1px 2px oklch(1 0 0 / 90%), inset 0 -8px 18px oklch(0.7 0.1 280 / 22%), 0 0 22px oklch(1 0 0 / 60%), 0 0 36px oklch(0.85 0.18 280 / 35%)",
        }}
      >
        {/* counter-rotate inner content so face stays upright */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="flex h-full w-full items-center justify-center"
        >
          <svg viewBox="0 0 120 120" className="h-[78%] w-[78%]">
            <motion.ellipse
              cx="42"
              cy="50"
              rx="5.5"
              ry="8.5"
              fill="oklch(0.25 0.08 280)"
              animate={{ scaleY: eyeY }}
              transition={{ duration: 0.16 }}
              style={{ transformOrigin: "42px 50px" }}
            />
            <motion.ellipse
              cx="78"
              cy="50"
              rx="5.5"
              ry="8.5"
              fill="oklch(0.25 0.08 280)"
              animate={{ scaleY: eyeY }}
              transition={{ duration: 0.16 }}
              style={{ transformOrigin: "78px 50px" }}
            />
            <motion.path
              animate={mouthVariants[state]}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              fill="none"
              stroke="oklch(0.25 0.08 280)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>
        </motion.div>
      </motion.div>
    </button>
  );
}
