import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bell,
  Ticket,
  CheckSquare,
  HeartPulse,
  Zap,
  Home,
  Building2,
  BarChart3,
  User,
  ArrowRight,
} from "lucide-react";
import { DashboardTile } from "@/components/DashboardTile";
import { DetailModal } from "@/components/DetailModal";
import { WeatherScene } from "@/components/WeatherScene";
import { WeatherToggle } from "@/components/WeatherToggle";
import { SidekickFace } from "@/components/SidekickFace";
import { SidekickChat } from "@/components/SidekickChat";
import { properties } from "@/lib/properties";
import { tileDetails, type TileDetail } from "@/lib/dashboardData";
import type { WeatherMode } from "@/lib/weather";

export const Route = createFileRoute("/dashboard/$propertyId")({
  component: Dashboard,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center text-white">
      <div className="text-center">
        <p className="mb-4">Property not found</p>
        <Link to="/" className="underline">Back to properties</Link>
      </div>
    </div>
  ),
});

function getInitialMode(): WeatherMode {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return "sunny";
  if (h >= 11 && h < 16) return "cloudy";
  if (h >= 16 && h < 19) return "rainy";
  return "clear-night";
}

function Dashboard() {
  const { propertyId } = Route.useParams();
  const navigate = useNavigate();
  const property = properties.find((p) => p.id === propertyId) ?? properties[0];

  const [active, setActive] = useState<TileDetail | null>(null);
  const [weather, setWeather] = useState<WeatherMode>(getInitialMode);
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-x-hidden text-foreground">
      <WeatherScene mode={weather} />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-5 pb-32 pt-6 sm:px-8 sm:pt-10">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 mt-2 flex items-start justify-between gap-4 sm:mb-14"
        >
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate({ to: "/" })}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/90 backdrop-blur-xl transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="pt-0.5">
              <h1 className="text-display text-3xl text-white sm:text-4xl md:text-5xl">
                {property.name}
              </h1>
              <p className="mt-1 text-sm text-white/55">
                {property.code} · April 18, 2026
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <WeatherToggle mode={weather} onChange={setWeather} />
            <button className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/90 backdrop-blur-xl transition hover:bg-white/10">
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[oklch(0.66_0.24_22)]" />
            </button>
          </div>
        </motion.header>

        <DashboardTile
          icon={Ticket}
          label="Tickets"
          variant="tickets"
          delay={0.05}
          className="w-full"
          onClick={() => setActive(tileDetails.tickets)}
        >
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-display text-6xl text-white sm:text-7xl">1,463</div>
              <div className="mt-2 text-sm text-white/60">804 open · 0 in progress</div>
            </div>
            <div className="flex h-16 items-end gap-1.5 pt-3">
              {[40, 55, 35, 70, 50, 85, 60].map((h, i) => (
                <div
                  key={i}
                  className="w-2 rounded-full bg-white/30"
                  style={{
                    height: `${h}%`,
                    background: i === 5 ? "oklch(1 0 0 / 80%)" : "oklch(1 0 0 / 30%)",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[oklch(0.66_0.24_22)] pulse-dot" />
                <span className="text-sm font-medium text-white">Critical</span>
              </div>
              <ArrowRight className="h-4 w-4 text-white/50 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </DashboardTile>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DashboardTile
            icon={CheckSquare}
            label="Checklist"
            variant="checklist"
            delay={0.12}
            onClick={() => setActive(tileDetails.checklist)}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-display text-5xl text-white">87</span>
              <span className="text-lg text-white/50">/ 100</span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "87%" }}
                transition={{ duration: 1.1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, oklch(0.78 0.2 145), oklch(0.85 0.18 155))",
                }}
              />
            </div>
            <div className="mt-3 text-xs text-white/55">87% completed</div>
          </DashboardTile>

          <DashboardTile
            icon={HeartPulse}
            label="Health"
            variant="health"
            delay={0.18}
            onClick={() => setActive(tileDetails.health)}
          >
            <div className="text-display text-4xl text-[oklch(0.78_0.2_22)] sm:text-5xl">
              Critical
            </div>
            <div className="mt-2 text-sm text-white/60">804 open tickets</div>
            <div className="mt-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[oklch(0.66_0.24_22)] pulse-dot" />
              <span className="text-xs text-white/70">Live</span>
            </div>
          </DashboardTile>
        </div>

        <div className="mt-4">
          <DashboardTile
            icon={Zap}
            label="Energy Usage"
            variant="energy"
            delay={0.24}
            onClick={() => setActive(tileDetails.energy)}
          >
            <div className="flex items-end justify-between gap-4">
              <div className="flex items-baseline gap-2">
                <span className="text-display text-5xl text-white">1,248</span>
                <span className="text-base text-white/50">kWh</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-[oklch(0.78_0.2_145)]">
                <span className="h-2 w-2 rounded-full bg-[oklch(0.78_0.2_145)]" />
                +12%
              </div>
            </div>
            <div className="mt-5 flex h-10 items-end gap-2">
              {[35, 55, 70, 92, 78, 60, 45].map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.6, delay: 0.3 + i * 0.05 }}
                  className="flex-1 origin-bottom rounded-md"
                  style={{
                    height: `${h}%`,
                    background:
                      i === 3
                        ? "linear-gradient(180deg, oklch(0.9 0.18 65), oklch(0.7 0.18 50))"
                        : "oklch(1 0 0 / 18%)",
                  }}
                />
              ))}
            </div>
            <div className="mt-3 text-xs text-white/50">Grid + DG consumption</div>
          </DashboardTile>
        </div>
      </div>

      <motion.nav
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full glass-strong px-2 py-2"
      >
        {[Home, Building2, null, BarChart3, User].map((Icon, i) =>
          Icon ? (
            <button
              key={i}
              onClick={() => Icon === Building2 && navigate({ to: "/" })}
              className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <Icon className="h-5 w-5" />
            </button>
          ) : (
            <SidekickFace
              key={i}
              compact
              size={56}
              className="mx-1"
              onClick={() => setChatOpen(true)}
            />
          ),
        )}
      </motion.nav>

      <SidekickChat open={chatOpen} onClose={() => setChatOpen(false)} />
      <DetailModal detail={active} onClose={() => setActive(null)} />
    </div>
  );
}
