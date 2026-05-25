/**
 * WeatherBackdrop.tsx — Page wrapper that paints the atmospheric sky and
 *   exposes a shared WeatherMode via React context.
 *
 * Responsibility: Renders <WeatherScene/> as a fixed full-bleed background
 *   and provides { mode, setMode } to descendants through WeatherContext so
 *   any header — at any depth — can drop in a <WeatherToggle/> without
 *   prop-drilling. By default it also renders a floating WeatherToggle in
 *   the top-right corner so role pages get the control "for free"; pages
 *   that already have a header-mounted toggle (the property dashboard) opt
 *   out via showFloatingToggle={false}.
 * Used by: routes/index, super-admin, dashboard.$propertyId, RoleShell
 *   (which means property-admin + mst inherit it).
 *
 * Gotcha: Each instance owns its own state — weather selection does NOT
 *   persist across navigations. Lift the provider to __root.tsx if cross-
 *   page persistence is ever needed.
 */

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { WeatherScene } from "@/components/WeatherScene";
import { WeatherToggle } from "@/components/WeatherToggle";
import { getInitialMode, type WeatherMode } from "@/lib/weather";

interface WeatherCtx {
  mode: WeatherMode;
  setMode: (m: WeatherMode) => void;
}

const WeatherContext = createContext<WeatherCtx | null>(null);

/** Hook for descendants (e.g. an in-header WeatherToggle) to read the mode. */
export function useWeather(): WeatherCtx {
  const ctx = useContext(WeatherContext);
  if (!ctx) {
    // Soft fallback so accidental orphan use doesn't crash; returns a noop.
    return { mode: getInitialMode(), setMode: () => {} };
  }
  return ctx;
}

interface Props {
  children: ReactNode;
  /** Show the fixed top-right WeatherToggle. Default true. */
  showFloatingToggle?: boolean;
  /** Optional initial mode override (else derived from local hour). */
  initialMode?: WeatherMode;
}

export function WeatherBackdrop({
  children,
  showFloatingToggle = true,
  initialMode,
}: Props) {
  // Local per-page state. See file header for rationale.
  const [mode, setMode] = useState<WeatherMode>(initialMode ?? getInitialMode());

  return (
    <WeatherContext.Provider value={{ mode, setMode }}>
      {/* Atmospheric sky lives behind everything. */}
      <WeatherScene mode={mode} />

      {/* Floating control — sits above content but below modals (z-40+). */}
      {showFloatingToggle && (
        <div className="pointer-events-none fixed right-3 top-3 z-20 sm:right-5 sm:top-5">
          <div className="pointer-events-auto">
            <WeatherToggle mode={mode} onChange={setMode} />
          </div>
        </div>
      )}

      {/* Page content sits above the scene. */}
      <div className="relative z-10">{children}</div>
    </WeatherContext.Provider>
  );
}
