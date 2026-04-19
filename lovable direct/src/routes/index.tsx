import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";

import { Menu, Search, Mic } from "lucide-react";
import { properties, type PropertyStatus } from "@/lib/properties";
import { AppSidebar } from "@/components/AppSidebar";

export const Route = createFileRoute("/")({
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
    <div className="min-h-screen pb-12 text-white">
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

        {/* Property cards */}
        <div className="flex flex-col gap-3">
          {filtered.map((p) => (
            <div key={p.id}>
              <Link
                to="/dashboard/$propertyId"
                params={{ propertyId: p.id }}
                className="group relative block h-32 overflow-hidden rounded-3xl shadow-md transition hover:shadow-xl"
              >
                <img
                  src={p.image}
                  alt={p.name}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-black/40" />

                <div className="relative flex h-full flex-col justify-between p-5 text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-display text-2xl font-bold leading-tight">
                        {p.name}
                      </h2>
                      <div className="mt-0.5 text-xs font-medium text-white/70">
                        {p.code}
                      </div>
                    </div>
                    <div className="text-display text-5xl font-light leading-none">
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
                      <span className="font-medium">{statusLabel[p.status]}</span>
                    </div>
                    <div className="flex gap-3 font-medium tabular-nums">
                      <span>H:{p.high}</span>
                      <span>L:{p.low}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
