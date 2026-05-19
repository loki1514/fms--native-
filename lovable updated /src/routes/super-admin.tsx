/**
 * routes/super-admin.tsx — Portfolio view across ALL properties.
 *
 * Responsibility: Header (menu/back), debounced-free search input, and a
 *   stack of photo-backed property cards. Tapping a card navigates to that
 *   property's full dashboard (/dashboard/$propertyId).
 * Used by: Super Admin role from routes/index.tsx.
 * Related: lib/properties.ts (the data), AppSidebar (drawer), routes/dashboard.$propertyId.
 *
 * Gotcha: Cards use the property image as a backdrop with onError fallback —
 *   when the image fails, the deterministic gradient layer behind it shows.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";

import { Menu, Search, Mic, ArrowLeft } from "lucide-react";
import { properties, type PropertyStatus } from "@/lib/properties";
import { AppSidebar } from "@/components/AppSidebar";
import { WeatherBackdrop } from "@/components/WeatherBackdrop";
import { CassandraDock } from "@/components/CassandraDock";

export const Route = createFileRoute("/super-admin")({
  component: PropertiesPage,
});

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

function PropertiesPage() {
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filtered = useMemo(
    () =>
      properties.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.code.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  return (
    <WeatherBackdrop>
    <div className="min-h-screen pb-32 text-white">
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="mx-auto w-full max-w-2xl px-5 pt-6 sm:pt-10">
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-xl transition hover:bg-white/20"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-display text-4xl font-bold text-white sm:text-5xl">
            Properties
          </h1>
          <Link
            to="/"
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-xl transition hover:bg-white/20"
            aria-label="Switch role"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a property"
            className="w-full rounded-2xl border border-white/10 bg-white/10 py-3.5 pl-11 pr-12 text-sm text-white backdrop-blur-xl placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/60">
            <Mic className="h-4 w-4" />
          </button>
        </div>

        {/* Property cards — unified recipe */}
        <div className="flex flex-col gap-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to="/dashboard/$propertyId"
              params={{ propertyId: p.id }}
              className="group relative block h-32 overflow-hidden rounded-3xl border border-white/15 shadow-[0_12px_32px_oklch(0_0_0/40%)] transition hover:shadow-[0_20px_48px_oklch(0_0_0/55%)]"
            >
              {/* Photo backdrop */}
              <img
                src={p.image}
                alt={p.name}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              {/* Deterministic gradient fallback (sits under image) */}
              <div
                className="absolute inset-0 -z-10"
                style={{
                  background: `linear-gradient(135deg, ${statusColor[p.status]}40, oklch(0.25 0.08 265))`,
                }}
              />
              {/* Glass tint over image */}
              <div className="absolute inset-0 bg-white/[0.04] backdrop-saturate-150" />
              {/* Vertical bottom-up scrim only — text remains legible */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
              {/* Inner highlight */}
              <div
                className="pointer-events-none absolute inset-0 rounded-3xl"
                style={{ boxShadow: "inset 0 1px 0 oklch(1 0 0 / 14%)" }}
              />

              <div className="relative flex h-full flex-col justify-between p-5 text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-display text-xl font-semibold leading-tight">
                      {p.name}
                    </h2>
                    <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-white/65">
                      {p.code}
                    </div>
                  </div>
                  <div className="text-display text-4xl font-light leading-none tabular-nums">
                    {p.tickets}
                  </div>
                </div>

                <div className="flex items-end justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background: statusColor[p.status],
                        boxShadow: `0 0 8px ${statusColor[p.status]}`,
                      }}
                    />
                    <span className="font-medium text-white/85">
                      {statusLabel[p.status]}
                    </span>
                  </div>
                  <div className="flex gap-3 font-medium tabular-nums text-white/75">
                    <span>H:{p.high}</span>
                    <span>L:{p.low}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <CassandraDock />
    </div>
    </WeatherBackdrop>
  );
}
