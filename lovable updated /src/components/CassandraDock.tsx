/**
 * CassandraDock.tsx — Floating bottom dock with Home / Properties / Cassandra
 *   orb / Analytics / Profile, shared across every role surface.
 *
 * Responsibility: Lifts the floating bottom nav originally inline in the
 *   property dashboard into a reusable component so Super Admin, Property
 *   Admin, MST and the role picker all get the same Sidekick entry point.
 *   Owns chatOpen state and renders <SidekickChat/>. The orb keeps its
 *   floating "Ask Cassandra" caption + hover tooltip exactly as before.
 * Used by: routes/index, super-admin, dashboard.$propertyId, RoleShell.
 *
 * Gotcha: Pages must reserve enough bottom padding (pb-28 or more) so the
 *   dock doesn't cover content. RoleShell already does; super-admin and
 *   index were updated alongside this component. The dock sits at z-30,
 *   below modals / sidebars (z-40+).
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { Home, Building2, BarChart3, User, type LucideIcon } from "lucide-react";
import { SidekickFace } from "@/components/SidekickFace";
import { SidekickChat } from "@/components/SidekickChat";

interface Props {
  /** Extra bottom offset (px) — bump when a page also has a tab bar below. */
  bottomOffset?: number;
}

interface DockSlot {
  icon: LucideIcon;
  label: string;
  to: string;
}

// Default targets. Each role page mounts the same dock — wiring is uniform.
const slots: DockSlot[] = [
  { icon: Home, label: "Home", to: "/" },
  { icon: Building2, label: "Properties", to: "/super-admin" },
  // null slot reserved for the Sidekick orb (rendered separately)
  { icon: BarChart3, label: "Analytics", to: "/super-admin" },
  { icon: User, label: "Profile", to: "/" },
];

export function CassandraDock({ bottomOffset = 16 }: Props) {
  const [chatOpen, setChatOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <motion.nav
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        style={{ bottom: bottomOffset }}
        className="fixed left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full glass-strong px-2 py-2"
      >
        {/* Left two slots */}
        {slots.slice(0, 2).map((s, i) => (
          <button
            key={`l-${i}`}
            onClick={() => navigate({ to: s.to })}
            aria-label={s.label}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <s.icon className="h-5 w-5" />
          </button>
        ))}

        {/* ── Sidekick orb with floating caption + hover tooltip ── */}
        <div className="group relative mx-1 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: [0, -3, 0] }}
            transition={{
              opacity: { duration: 0.6, delay: 0.8 },
              y: { duration: 2.6, repeat: Infinity, ease: "easeInOut" },
            }}
            className="pointer-events-none absolute -top-7 whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/85 backdrop-blur-xl"
          >
            Ask Cassandra
          </motion.div>
          <SidekickFace compact size={56} onClick={() => setChatOpen(true)} />
          <div className="pointer-events-none absolute -top-16 left-1/2 w-56 -translate-x-1/2 rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-center text-[11px] text-white/85 opacity-0 shadow-xl backdrop-blur-xl transition-opacity duration-200 group-hover:opacity-100">
            <span className="text-display block text-white">
              Cassandra · AI Sidekick
            </span>
            <span className="mt-0.5 block text-white/60">
              Tap to ask about tickets, energy, or your team
            </span>
          </div>
        </div>

        {/* Right two slots */}
        {slots.slice(2).map((s, i) => (
          <button
            key={`r-${i}`}
            onClick={() => navigate({ to: s.to })}
            aria-label={s.label}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <s.icon className="h-5 w-5" />
          </button>
        ))}
      </motion.nav>

      <SidekickChat open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
