/**
 * StarField.tsx — Twinkling star backdrop for the clear-night weather mode.
 *
 * Responsibility: Render `count` randomly-positioned spans with a CSS twinkle
 *   animation (.star class defined in src/styles.css).
 * Used by: WeatherScene (clear-night branch).
 *
 * Gotcha: Positions are memoized on `count` so stars don't re-shuffle every
 *   render. The .star animation lives in styles.css, not here.
 */

import { useMemo } from "react";

export function StarField({ count = 80 }: { count?: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }).map(() => ({
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 1.6 + 0.6,
        delay: Math.random() * 3,
        duration: 2 + Math.random() * 4,
        opacity: 0.4 + Math.random() * 0.6,
      })),
    [count],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((s, i) => (
        <span
          key={i}
          className="star"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            opacity: s.opacity,
          }}
        />
      ))}
    </div>
  );
}
