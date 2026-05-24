/**
 * routes/mst.tsx — Maintenance Service Technician (field worker) role.
 *
 * Responsibility: Three-tab experience for field staff:
 *   1. My Dashboard — gamification strip, stats card, swipeable ticket stack.
 *   2. Daily Board  — countdown to end-of-day + today's standings leaderboard.
 *   3. Live Flow    — weekly champion card + grid of properties with on-site MSTs.
 *
 * Currently uses its own header instead of RoleShell to keep the bespoke
 *   3-tab bottom layout. Fold into RoleShell when the layouts converge.
 * Related: lib/gamification.ts (mstUser, weeklyLeaderboard), components/gamification/*.
 *
 * Gotcha: TicketStack uses framer-motion drag — the top card is the ONLY
 *   draggable one; lower cards have pointer-events disabled so taps never
 *   land on them while peeking through.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Bell,
  Settings2,
  Share2,
  Pencil,
  Timer,
  LayoutDashboard,
  ClipboardList,
  Radio,
  ArrowLeft,
  Crown,
  Clock,
  MapPin,
  Trophy,
  Target,
  CheckCircle2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { LevelBadge } from "@/components/gamification/LevelBadge";
import { XPBar } from "@/components/gamification/XPBar";
import { StreakChip } from "@/components/gamification/StreakChip";
import { Leaderboard } from "@/components/gamification/Leaderboard";
import { AchievementBadge } from "@/components/gamification/AchievementBadge";
import { mstUser, weeklyLeaderboard, achievements } from "@/lib/gamification";
import { properties } from "@/lib/properties";
import { WeatherBackdrop } from "@/components/WeatherBackdrop";
import { CassandraDock } from "@/components/CassandraDock";

export const Route = createFileRoute("/mst")({
  component: MstDashboardPage,
});

interface Ticket {
  id: string;
  date: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "ASSIGNED" | "PENDING" | "IN-PROGRESS";
  title: string;
  assignee: string;
  initials: string;
  sla: string;
  score: string;
}

const tickets: Ticket[] = [
  {
    id: "TKT-1775035028822",
    date: "Apr 01, 2026 · 02:47 PM",
    priority: "MEDIUM",
    status: "ASSIGNED",
    title: "Kindly check cafeteria air cooler water supply. No water leaking",
    assignee: "Manjunatha AS",
    initials: "MA",
    sla: "1d 8h 54m",
    score: "Score +5",
  },
  {
    id: "TKT-1775035028821",
    date: "Apr 01, 2026 · 11:12 AM",
    priority: "HIGH",
    status: "PENDING",
    title: "Lift 3 emitting unusual noise on 4th floor stop. Please inspect.",
    assignee: "Ravi Kumar",
    initials: "RK",
    sla: "0d 4h 12m",
    score: "Score +8",
  },
  {
    id: "TKT-1775035028820",
    date: "Mar 31, 2026 · 06:30 PM",
    priority: "LOW",
    status: "IN-PROGRESS",
    title: "Replace bulb in basement parking section B near pillar 12.",
    assignee: "Suresh N",
    initials: "SN",
    sla: "2d 1h 04m",
    score: "Score +3",
  },
];

const priorityStyle: Record<Ticket["priority"], string> = {
  LOW: "bg-[oklch(0.88_0.12_150/25%)] text-[oklch(0.94_0.1_150)] border-[oklch(0.88_0.12_150/40%)]",
  MEDIUM: "bg-[oklch(0.92_0.12_90/28%)] text-[oklch(0.96_0.1_90)] border-[oklch(0.92_0.12_90/45%)]",
  HIGH: "bg-[oklch(0.85_0.14_30/28%)] text-[oklch(0.94_0.11_30)] border-[oklch(0.85_0.14_30/45%)]",
};

const statusStyle: Record<Ticket["status"], string> = {
  ASSIGNED: "bg-[oklch(0.85_0.1_265/28%)] text-[oklch(0.94_0.08_265)] border-[oklch(0.85_0.1_265/45%)]",
  PENDING: "bg-[oklch(0.9_0.1_70/28%)] text-[oklch(0.96_0.09_70)] border-[oklch(0.9_0.1_70/45%)]",
  "IN-PROGRESS": "bg-[oklch(0.85_0.1_210/30%)] text-[oklch(0.94_0.08_210)] border-[oklch(0.85_0.1_210/45%)]",
};

type Tab = "dashboard" | "daily" | "flow" | "profile";

function MstDashboardPage() {
  // ── State ──────────────────────────────────────────
  // activeTab also accepts "profile" — entered by tapping the header avatar,
  // exited via the back arrow. Profile is intentionally NOT in the bottom tab
  // bar (it's a personal sub-screen, not a primary nav destination).
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  return (
    <WeatherBackdrop>
    <div className="min-h-screen pb-44 text-white">
      <div className="mx-auto w-full max-w-md px-5 pt-6 sm:pt-10">
        {/* Top greeting bar */}
        <div className="mb-6 flex items-center gap-3">
          {activeTab === "profile" ? (
            <button
              onClick={() => setActiveTab("dashboard")}
              aria-label="Back to dashboard"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-xl transition hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link
              to="/"
              aria-label="Switch role"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-xl transition hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          {/* Avatar — tap to open profile */}
          <button
            onClick={() => setActiveTab("profile")}
            aria-label="Open profile"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-[oklch(0.55_0.14_30)] to-[oklch(0.4_0.1_15)] text-sm font-semibold transition hover:ring-2 hover:ring-white/30"
          >
            MA
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-display text-base font-semibold leading-tight">
              Hey, Manjunatha
            </div>
            <div className="text-xs text-white/60">Good Morning</div>
          </div>
          <button
            aria-label="Notifications"
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-xl transition hover:bg-white/20"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[oklch(0.7_0.22_25)] shadow-[0_0_8px_oklch(0.7_0.22_25)]" />
          </button>
        </div>

        {activeTab === "dashboard" && <MyDashboard />}
        {activeTab === "daily" && <DailyBoard />}
        {activeTab === "flow" && <LiveFlow />}
        {activeTab === "profile" && <Profile />}
      </div>

      {/* Bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[oklch(0.12_0.03_260/85%)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-3">
          <TabButton
            icon={LayoutDashboard}
            label="My Dashboard"
            active={activeTab === "dashboard"}
            onClick={() => setActiveTab("dashboard")}
          />
          <TabButton
            icon={ClipboardList}
            label="Daily Board"
            active={activeTab === "daily"}
            onClick={() => setActiveTab("daily")}
          />
          <TabButton
            icon={Radio}
            label="Live Flow"
            active={activeTab === "flow"}
            onClick={() => setActiveTab("flow")}
          />
        </div>
      </nav>

      {/* Floating Cassandra dock — sits above the MST tab bar. */}
      <CassandraDock bottomOffset={88} />
    </div>
    </WeatherBackdrop>
  );
}

/* ---------- Tab: My Dashboard ---------- */

function MyDashboard() {
  return (
    <>
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="text-display text-3xl font-bold uppercase leading-[1.05] tracking-tight sm:text-4xl"
      >
        Your SS Plaza
        <br />
        Tasks & Stats
      </motion.h1>

      {/* Gamification strip */}
      <div className="mt-5">
        <GlassCard glow="oklch(0.55 0.18 145 / 55%)">
          <div className="flex items-center gap-3 p-4">
            <LevelBadge level={mstUser.level} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="text-display text-sm font-semibold">
                  {mstUser.levelName}
                </div>
                <div className="flex items-center gap-2">
                  <StreakChip streak={mstUser.streak} />
                  <div className="rounded-full bg-[oklch(0.85_0.18_85/25%)] px-2 py-1 text-[10px] font-bold text-[oklch(0.95_0.14_85)]">
                    #{mstUser.weeklyRank}
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <XPBar xp={mstUser.xp} xpForNext={mstUser.xpForNext} />
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Stats card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl"
      >
        <div className="flex justify-end">
          <button className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/80 transition hover:bg-white/15">
            <Settings2 className="h-3.5 w-3.5" />
            Customize
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatTile value="757" label="TOTAL" tint="from-[oklch(0.55_0.14_240/45%)] to-[oklch(0.4_0.1_245/30%)]" />
          <StatTile value="71" label="ACTIVE" tint="from-[oklch(0.55_0.14_295/45%)] to-[oklch(0.4_0.1_285/30%)]" />
        </div>
        <div className="mt-3">
          <StatTile
            value="634"
            label="COMPLETED"
            tint="from-[oklch(0.55_0.16_150/45%)] to-[oklch(0.4_0.12_165/30%)]"
            wide
          />
        </div>
      </motion.div>

      {/* Property Requests */}
      <div className="mt-8 mb-3 flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-white/60">
          Property Requests
        </div>
        <div className="text-[10px] font-medium tracking-wide text-white/40">
          Tap top card to cycle
        </div>
      </div>

      <TicketStack tickets={tickets} />
    </>
  );
}

/* ---------- Tab: Daily Board ---------- */

function DailyBoard() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const ms = Math.max(0, end.getTime() - now);
  const hh = Math.floor(ms / 3600000);
  const mm = Math.floor((ms % 3600000) / 60000);
  const ss = Math.floor((ms % 60000) / 1000);

  return (
    <>
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-display text-3xl font-bold uppercase leading-[1.05] tracking-tight"
      >
        Daily Board
      </motion.h1>

      <div className="mt-5">
        <GlassCard variant="strong" glow="oklch(0.7 0.22 25 / 50%)">
          <div className="p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
              <Clock className="h-3 w-3" />
              Time left today
            </div>
            <div className="text-display mt-2 flex items-center justify-center gap-2 text-4xl font-bold tabular-nums">
              <TimeBlock val={hh} />
              <span className="text-white/30">:</span>
              <TimeBlock val={mm} />
              <span className="text-white/30">:</span>
              <TimeBlock val={ss} />
            </div>
            <div className="mt-2 text-xs text-white/55">
              Resolve more tickets to climb the board
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="mt-6">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
          Today's Standings
        </div>
        <Leaderboard rows={weeklyLeaderboard} />
      </div>
    </>
  );
}

function TimeBlock({ val }: { val: number }) {
  return (
    <span className="rounded-xl bg-white/10 px-3 py-1.5">
      {String(val).padStart(2, "0")}
    </span>
  );
}

/* ---------- Tab: Live Flow ---------- */

function LiveFlow() {
  const champion = weeklyLeaderboard[0];
  return (
    <>
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-display text-3xl font-bold uppercase leading-[1.05] tracking-tight"
      >
        Live Flow
      </motion.h1>

      {/* Weekly Champion */}
      <div className="mt-5">
        <GlassCard variant="strong" glow="oklch(0.85 0.18 85 / 65%)">
          <div className="flex items-center gap-4 p-5">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[oklch(0.85_0.18_85/45%)] bg-gradient-to-br from-[oklch(0.55_0.14_30)] to-[oklch(0.4_0.1_15)] text-base font-bold shadow-[0_0_24px_oklch(0.85_0.18_85/45%)]">
              {champion.initials}
              <Crown className="absolute -top-3 left-1/2 h-5 w-5 -translate-x-1/2 text-[oklch(0.88_0.18_85)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.88_0.18_85)]">
                Weekly Champion
              </div>
              <div className="text-display text-lg font-bold leading-tight">
                {champion.name}
              </div>
              <div className="text-xs text-white/60">
                {champion.xp.toLocaleString()} XP · {champion.resolved} resolved
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Property grid */}
      <div className="mt-6">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
          Active Properties
        </div>
        <div className="grid grid-cols-2 gap-3">
          {properties.slice(0, 4).map((p, i) => (
            <PropertyFlowTile key={p.id} name={p.name} code={p.code} active={i + 1} />
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------- Tab: Profile (sub-screen, opened from header avatar) ---------- */

function Profile() {
  // ── Derived values ──────────────────────────────────
  // Split achievements so unlocked ones display first with a count badge.
  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);
  const myRow = weeklyLeaderboard.find((r) => r.isMe) ?? weeklyLeaderboard[0];

  return (
    <>
      {/* Identity card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <GlassCard variant="strong" glow="oklch(0.55 0.18 255 / 50%)">
          <div className="flex items-center gap-4 p-5">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-[oklch(0.55_0.14_30)] to-[oklch(0.4_0.1_15)] text-xl font-bold shadow-[0_0_28px_oklch(0.55_0.18_255/40%)]">
              {mstUser.initials}
              <div className="absolute -bottom-1 -right-1">
                <LevelBadge level={mstUser.level} size="sm" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-display text-xl font-bold leading-tight">
                {mstUser.name}
              </div>
              <div className="text-xs text-white/60">{mstUser.levelName}</div>
              <div className="mt-2 flex items-center gap-2">
                <StreakChip streak={mstUser.streak} />
                <div className="rounded-full bg-[oklch(0.85_0.18_85/25%)] px-2 py-1 text-[10px] font-bold text-[oklch(0.95_0.14_85)]">
                  Rank #{mstUser.weeklyRank}
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 px-5 py-4">
            <XPBar xp={mstUser.xp} xpForNext={mstUser.xpForNext} />
            <div className="mt-2 text-[11px] text-white/55">
              {mstUser.xpForNext - mstUser.xp} XP to level {mstUser.level + 1}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Lifetime stats grid */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <ProfileStat
          icon={Trophy}
          value={mstUser.totalXp.toLocaleString()}
          label="TOTAL XP"
          tint="oklch(0.82 0.18 80)"
        />
        <ProfileStat
          icon={CheckCircle2}
          value={String(myRow.resolved)}
          label="RESOLVED"
          tint="oklch(0.78 0.2 145)"
        />
        <ProfileStat
          icon={Target}
          value={`${unlocked.length}/${achievements.length}`}
          label="BADGES"
          tint="oklch(0.72 0.18 235)"
        />
      </div>

      {/* Achievements */}
      <div className="mt-8 mb-3 flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-white/60">
          Achievements
        </div>
        <div className="text-[10px] font-medium tracking-wide text-white/40">
          {unlocked.length} of {achievements.length} unlocked
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[...unlocked, ...locked].map((a, i) => (
          <AchievementBadge key={a.id} a={a} delay={i * 0.05} />
        ))}
      </div>
    </>
  );
}

function ProfileStat({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: typeof Trophy;
  value: string;
  label: string;
  tint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-center backdrop-blur-xl">
      <div
        className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl"
        style={{
          background: tint.replace(")", " / 18%)"),
          boxShadow: `0 0 14px ${tint.replace(")", " / 30%)")}`,
        }}
      >
        <Icon className="h-4 w-4" style={{ color: tint }} strokeWidth={2.4} />
      </div>
      <div className="text-display mt-2 text-lg font-bold leading-none tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-[9px] font-semibold tracking-[0.18em] text-white/55">
        {label}
      </div>
    </div>
  );
}

function PropertyFlowTile({
  name,
  code,
  active,
}: {
  name: string;
  code: string;
  active: number;
}) {
  return (
    <GlassCard>
      <div className="p-3.5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
          <MapPin className="h-3 w-3" />
          {code}
        </div>
        <div className="text-display mt-1 text-sm font-semibold leading-tight">
          {name}
        </div>
        <div className="mt-3 flex -space-x-1.5">
          {Array.from({ length: active }).map((_, i) => (
            <div
              key={i}
              className="h-6 w-6 rounded-full border border-white/20 bg-gradient-to-br from-[oklch(0.5_0.14_265)] to-[oklch(0.35_0.1_280)] text-[9px] font-bold flex items-center justify-center"
            >
              {String.fromCharCode(65 + i)}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/55">
          <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.78_0.2_145)] shadow-[0_0_6px_oklch(0.78_0.2_145)] pulse-dot" />
          {active} MST{active > 1 ? "s" : ""} on-site
        </div>
      </div>
    </GlassCard>
  );
}

/* ---------- Shared sub-components ---------- */

function StatTile({
  value,
  label,
  tint,
  wide = false,
}: {
  value: string;
  label: string;
  tint: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${tint} px-4 py-5 text-center backdrop-blur-xl ${wide ? "" : ""}`}
    >
      <div
        className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full bg-white/15 opacity-40 blur-2xl"
        aria-hidden
      />
      <div className="text-display text-4xl font-bold leading-none tracking-tight">
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-semibold tracking-[0.2em] text-white/70">
        {label}
      </div>
    </div>
  );
}

function TicketStack({ tickets }: { tickets: Ticket[] }) {
  const [order, setOrder] = useState(tickets);

  const sendToBack = () => {
    setOrder((prev) => {
      if (prev.length < 2) return prev;
      const [first, ...rest] = prev;
      return [...rest, first];
    });
  };

  const STACK_HEIGHT = 420;

  return (
    <div className="relative" style={{ height: STACK_HEIGHT, perspective: 1200 }}>
      {order.map((t, i) => {
        const isTop = i === 0;
        const offset = i * 12;
        const scale = 1 - i * 0.045;
        const opacity = i > 3 ? 0 : 1 - i * 0.18;

        return (
          <motion.div
            key={t.id}
            layout
            initial={false}
            animate={{ y: offset, scale, opacity, zIndex: order.length - i }}
            transition={{ type: "spring", stiffness: 240, damping: 28 }}
            drag={isTop ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={(_, info) => {
              if (Math.abs(info.offset.x) > 100 || Math.abs(info.velocity.x) > 500) {
                sendToBack();
              }
            }}
            onClick={() => isTop && sendToBack()}
            className={`absolute inset-x-0 top-0 origin-top ${isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
            style={{ zIndex: order.length - i }}
          >
            <TicketCard ticket={t} />
          </motion.div>
        );
      })}
    </div>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <div className="rounded-3xl border border-white/15 bg-[oklch(0.32_0.04_260/75%)] p-4 shadow-[0_20px_60px_oklch(0_0_0/45%)] backdrop-blur-2xl">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-[oklch(0.4_0.06_240)] to-[oklch(0.25_0.04_250)]">
          <Timer className="h-5 w-5 text-white/80" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-display truncate text-sm font-semibold">
            {ticket.id}
          </div>
          <div className="text-[11px] text-white/60">{ticket.date}</div>
        </div>
        <button
          aria-label="Share"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/15"
        >
          <Share2 className="h-3.5 w-3.5" />
        </button>
        <button
          aria-label="Edit"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/15"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider ${priorityStyle[ticket.priority]}`}
        >
          {ticket.priority}
        </span>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider ${statusStyle[ticket.status]}`}
        >
          {ticket.status}
        </span>
      </div>

      <p className="mt-3 text-[15px] font-medium leading-snug text-white">
        {ticket.title}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[oklch(0.55_0.14_265)] text-[10px] font-bold">
          {ticket.initials}
        </div>
        <span className="text-xs text-white/80">{ticket.assignee}</span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
            SLA Countdown
          </div>
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.7_0.22_25/25%)] px-2.5 py-1 text-xs font-semibold text-[oklch(0.92_0.14_30)]">
            <Timer className="h-3 w-3" />
            {ticket.sla}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
            Score
          </div>
          <div className="mt-1.5 text-sm font-semibold text-white">
            {ticket.score}
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button className="flex-1 rounded-full bg-[oklch(0.55_0.18_255)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_oklch(0.55_0.18_255/40%)] transition hover:bg-[oklch(0.6_0.18_255)]">
          View Ticket
        </button>
        <button className="flex-1 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/10">
          Accept Task
        </button>
      </div>
    </div>
  );
}

function TabButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 transition ${
        active ? "text-white" : "text-white/55 hover:text-white/80"
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
      <span className="text-[10px] font-medium tracking-wide">{label}</span>
    </button>
  );
}
