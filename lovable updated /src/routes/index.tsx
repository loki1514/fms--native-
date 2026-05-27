/**
 * routes/index.tsx — Role picker landing page (the app's "/" route).
 *
 * Responsibility: Show three big role cards (Super Admin, Property Admin, MST)
 *   that link to each role's home route. Property Admin and MST display an
 *   "XP" chip indicating they have gamification surfaces.
 * Used by: TanStack Router as the root path.
 * Related: routes/super-admin.tsx, routes/property-admin.tsx, routes/mst.tsx.
 *
 * Gotcha: This page intentionally has no AppSidebar — it IS the role chooser.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Shield, UserCog, Building, ArrowRight, Sparkles } from "lucide-react";
import { WeatherBackdrop } from "@/components/WeatherBackdrop";
import { CassandraDock } from "@/components/CassandraDock";

export const Route = createFileRoute("/")({
  component: RoleSelectPage,
});

const roles = [
  {
    id: "super-admin",
    to: "/super-admin" as const,
    title: "Super Admin",
    subtitle: "Portfolio overview · all properties",
    icon: Shield,
    gradient:
      "from-[oklch(0.45_0.16_260)] via-[oklch(0.35_0.12_240)] to-[oklch(0.25_0.08_220)]",
    accent: "oklch(0.72 0.15 235)",
    xp: false,
  },
  {
    id: "property-admin",
    to: "/property-admin" as const,
    title: "Property Admin",
    subtitle: "Single property · ops & gamified KPIs",
    icon: Building,
    gradient:
      "from-[oklch(0.48_0.16_295)] via-[oklch(0.36_0.12_280)] to-[oklch(0.26_0.08_265)]",
    accent: "oklch(0.72 0.18 285)",
    xp: true,
  },
  {
    id: "mst",
    to: "/mst" as const,
    title: "MST",
    subtitle: "Your tasks, requests & live flow",
    icon: UserCog,
    gradient:
      "from-[oklch(0.5_0.14_165)] via-[oklch(0.38_0.1_180)] to-[oklch(0.28_0.06_200)]",
    accent: "oklch(0.78 0.2 145)",
    xp: true,
  },
];

function RoleSelectPage() {
  return (
    <WeatherBackdrop>
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-12 pb-32 text-white">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 text-center"
        >
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.24em] text-white/50">
            Cassandra · Facility OS
          </div>
          <h1 className="text-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Choose your role
          </h1>
          <p className="mt-3 text-sm text-white/60">
            Select how you want to enter the system today.
          </p>
        </motion.div>

        <div className="flex flex-col gap-4">
          {roles.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.1 + i * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Link
                to={r.to}
                className={`group relative block overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${r.gradient} p-6 shadow-[0_20px_60px_oklch(0_0_0/40%)] transition hover:scale-[1.01] hover:shadow-[0_28px_80px_oklch(0_0_0/55%)]`}
              >
                <div
                  className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full opacity-50 blur-3xl"
                  style={{ background: r.accent }}
                />
                <div className="relative flex items-center gap-4">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl"
                    style={{ boxShadow: `0 0 24px ${r.accent}40` }}
                  >
                    <r.icon className="h-6 w-6" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-display text-2xl font-bold leading-tight">
                        {r.title}
                      </div>
                      {r.xp && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/85">
                          <Sparkles className="h-2.5 w-2.5" />
                          XP
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-white/70">{r.subtitle}</div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-white/60 transition group-hover:translate-x-1 group-hover:text-white" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 text-center text-[11px] uppercase tracking-[0.2em] text-white/40">
          v1.0 · Atmospheric Glass
        </div>
      </div>
    </div>
    <CassandraDock />
    </WeatherBackdrop>
  );
}
