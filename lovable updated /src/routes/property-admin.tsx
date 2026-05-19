/**
 * routes/property-admin.tsx — Single-property admin role with gamification.
 *
 * Responsibility: Five-tab experience inside RoleShell:
 *   1. Dashboard — period toggle, gamification strip, KPI cards, snapshot
 *      tiles, and an electricity ring. Toned-down version of Super Admin.
 *   2. Tickets — filterable ticket list (all/open/in-progress/resolved).
 *   3. Loggers — diesel/electricity logger entries.
 *   4. Gamify — level + XP bar, achievements grid, daily quests, leaderboard.
 *   5. Settings — basic preference rows.
 *
 * Property is hard-coded to `properties[0]` (SS Plaza) for the demo. Replace
 *   with a route param or context when multi-property auth lands.
 * Related: lib/gamification.ts (XP/quests/leaderboard), components/gamification/*,
 *   GlassCard, RoleShell, AppSidebar.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Ticket as TicketIcon,
  Gauge,
  Trophy,
  Settings as SettingsIcon,
  Fuel,
  Zap,
  Users,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  Calendar,
  ChevronRight,
  AlertTriangle,
  ShieldCheck,
  Bell,
  Moon,
  HelpCircle,
} from "lucide-react";
import { RoleShell, type BottomTab } from "@/components/RoleShell";
import { GlassCard } from "@/components/GlassCard";
import { XPBar } from "@/components/gamification/XPBar";
import { StreakChip } from "@/components/gamification/StreakChip";
import { LevelBadge } from "@/components/gamification/LevelBadge";
import { AchievementBadge } from "@/components/gamification/AchievementBadge";
import { Leaderboard } from "@/components/gamification/Leaderboard";
import { DailyQuests } from "@/components/gamification/DailyQuests";
import {
  achievements,
  dailyQuests,
  propertyAdminUser,
  weeklyLeaderboard,
} from "@/lib/gamification";
import { properties } from "@/lib/properties";

type Tab = "dashboard" | "tickets" | "loggers" | "gamify" | "settings";
type Period = "today" | "month" | "all";

export const Route = createFileRoute("/property-admin")({
  component: PropertyAdminPage,
});

const tabs: BottomTab<Tab>[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "tickets", label: "Tickets", icon: TicketIcon },
  { id: "loggers", label: "Loggers", icon: Gauge },
  { id: "gamify", label: "Gamify", icon: Trophy },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

const property = properties[0]; // SS Plaza

function PropertyAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  return (
    <RoleShell
      greeting={{
        name: propertyAdminUser.name,
        sub: `${property.name} · ${property.code}`,
        initials: propertyAdminUser.initials,
        tint:
          "linear-gradient(135deg, oklch(0.55 0.16 285), oklch(0.4 0.12 270))",
      }}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === "dashboard" && <DashboardTab />}
      {activeTab === "tickets" && <TicketsTab />}
      {activeTab === "loggers" && <LoggersTab />}
      {activeTab === "gamify" && <GamifyTab />}
      {activeTab === "settings" && <SettingsTab />}
    </RoleShell>
  );
}

/* ---------------- Dashboard ---------------- */

function DashboardTab() {
  const [period, setPeriod] = useState<Period>("today");

  return (
    <div className="flex flex-col gap-5">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-display text-3xl font-bold uppercase leading-[1.05] tracking-tight"
      >
        Property
        <br />
        Overview
      </motion.h1>

      {/* Period toggle */}
      <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-xl">
        {(["today", "month", "all"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
              period === p ? "bg-white/15 text-white" : "text-white/55"
            }`}
          >
            {p === "all" ? "All Time" : p}
          </button>
        ))}
      </div>

      {/* Gamification strip */}
      <GlassCard glow="oklch(0.55 0.18 285 / 60%)">
        <div className="flex items-center gap-3 p-4">
          <LevelBadge level={propertyAdminUser.level} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <div className="text-display text-sm font-semibold">
                {propertyAdminUser.levelName}
              </div>
              <div className="flex items-center gap-2">
                <StreakChip streak={propertyAdminUser.streak} />
                <div className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white/85">
                  #{propertyAdminUser.weeklyRank}/{propertyAdminUser.weeklyTotal}
                </div>
              </div>
            </div>
            <div className="mt-2">
              <XPBar
                xp={propertyAdminUser.xp}
                xpForNext={propertyAdminUser.xpForNext}
              />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* KPI cards */}
      <div className="flex flex-col gap-3">
        <KpiCard
          icon={TicketIcon}
          tint="oklch(0.72 0.15 235)"
          label="Total Tickets"
          value="804"
          sub="91.9% resolved"
          progress={91.9}
        />
        <KpiCard
          icon={AlertTriangle}
          tint="oklch(0.78 0.18 65)"
          label="Open & Active"
          value="29"
          chips={[
            { label: "Open", count: 12, tint: "oklch(0.78 0.18 65)" },
            { label: "In-Progress", count: 14, tint: "oklch(0.72 0.15 235)" },
            { label: "Urgent", count: 3, tint: "oklch(0.7 0.22 25)" },
          ]}
        />
        <KpiCard
          icon={ShieldCheck}
          tint="oklch(0.78 0.2 145)"
          label="Resolved & Closed"
          value="739"
          chips={[
            { label: "Confirmed", count: 712, tint: "oklch(0.78 0.2 145)" },
            { label: "Awaiting", count: 27, tint: "oklch(0.78 0.18 65)" },
          ]}
        />
      </div>

      {/* Property snapshot */}
      <div className="grid grid-cols-3 gap-3">
        <SnapshotTile value="14" label="VISITORS" tint="oklch(0.72 0.15 235)" />
        <SnapshotTile
          value="5"
          label="IN"
          tint="oklch(0.78 0.2 145)"
          icon={ArrowDownRight}
        />
        <SnapshotTile
          value="9"
          label="OUT"
          tint="oklch(0.7 0.22 25)"
          icon={ArrowUpRight}
        />
      </div>

      {/* Electricity ring */}
      <GlassCard>
        <div className="flex items-center gap-4 p-4">
          <ElectricityRing percent={68} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
              Electricity Today
            </div>
            <div className="text-display mt-1 text-2xl font-bold tabular-nums">
              1,248 <span className="text-sm font-medium text-white/60">kVAh</span>
            </div>
            <div className="mt-1 text-xs text-white/60">
              68% of daily target · peak 14:00
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  tint,
  label,
  value,
  sub,
  progress,
  chips,
}: {
  icon: typeof TicketIcon;
  tint: string;
  label: string;
  value: string;
  sub?: string;
  progress?: number;
  chips?: { label: string; count: number; tint: string }[];
}) {
  return (
    <GlassCard glow={tint.replace(")", " / 50%)")}>
      <div className="p-4">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{
              background: tint.replace(")", " / 22%)"),
              boxShadow: `0 0 14px ${tint.replace(")", " / 35%)")}`,
            }}
          >
            <Icon className="h-4 w-4" style={{ color: tint }} strokeWidth={2.4} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">
            {label}
          </span>
          <div className="ml-auto text-display text-3xl font-light tabular-nums">
            {value}
          </div>
        </div>
        {sub && (
          <div className="mt-3 text-xs text-white/65">{sub}</div>
        )}
        {progress !== undefined && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${tint}, oklch(0.78 0.2 145))`,
              }}
            />
          </div>
        )}
        {chips && (
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((c) => (
              <div
                key={c.label}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px]"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: c.tint, boxShadow: `0 0 6px ${c.tint}` }}
                />
                <span className="text-white/75">{c.label}</span>
                <span className="font-bold tabular-nums text-white">{c.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function SnapshotTile({
  value,
  label,
  tint,
  icon: Icon,
}: {
  value: string;
  label: string;
  tint: string;
  icon?: typeof ArrowDownRight;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-4 text-center backdrop-blur-xl"
    >
      <div
        className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full opacity-30 blur-2xl"
        style={{ background: tint }}
      />
      {Icon && (
        <Icon className="mx-auto mb-1 h-3.5 w-3.5" style={{ color: tint }} />
      )}
      <div className="text-display text-2xl font-bold leading-none tabular-nums">
        {value}
      </div>
      <div className="mt-1.5 text-[9px] font-bold tracking-[0.2em] text-white/60">
        {label}
      </div>
    </div>
  );
}

function ElectricityRing({ percent }: { percent: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div className="relative h-20 w-20">
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle
          cx="36"
          cy="36"
          r={r}
          stroke="oklch(1 0 0 / 10%)"
          strokeWidth="6"
          fill="none"
        />
        <circle
          cx="36"
          cy="36"
          r={r}
          stroke="url(#elec)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="elec" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.18 65)" />
            <stop offset="100%" stopColor="oklch(0.7 0.22 25)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Zap className="h-4 w-4 text-[oklch(0.85_0.18_75)]" />
        <div className="text-display text-sm font-bold tabular-nums">{percent}%</div>
      </div>
    </div>
  );
}

/* ---------------- Tickets ---------------- */

interface PaTicket {
  id: string;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "IN-PROGRESS" | "RESOLVED";
  assignee: string;
  date: string;
}

const paTickets: PaTicket[] = [
  {
    id: "TKT-1775035028822",
    title: "Cafeteria air cooler water supply check",
    priority: "MEDIUM",
    status: "IN-PROGRESS",
    assignee: "Manjunatha A",
    date: "Apr 01 · 02:47 PM",
  },
  {
    id: "TKT-1775035028821",
    title: "Lift 3 unusual noise on 4th floor",
    priority: "HIGH",
    status: "OPEN",
    assignee: "Ravi Kumar",
    date: "Apr 01 · 11:12 AM",
  },
  {
    id: "TKT-1775035028820",
    title: "Replace bulb in basement parking B-12",
    priority: "LOW",
    status: "RESOLVED",
    assignee: "Suresh N",
    date: "Mar 31 · 06:30 PM",
  },
  {
    id: "TKT-1775035028819",
    title: "AC duct cleaning · 6th floor east wing",
    priority: "MEDIUM",
    status: "OPEN",
    assignee: "—",
    date: "Mar 31 · 09:10 AM",
  },
];

const priorityBar: Record<PaTicket["priority"], string> = {
  LOW: "oklch(0.78 0.2 145)",
  MEDIUM: "oklch(0.82 0.18 80)",
  HIGH: "oklch(0.7 0.22 25)",
};

const statusStyle: Record<PaTicket["status"], string> = {
  OPEN: "bg-[oklch(0.82_0.18_75/22%)] text-[oklch(0.94_0.14_70)] border-[oklch(0.82_0.18_75/40%)]",
  "IN-PROGRESS":
    "bg-[oklch(0.72_0.15_235/22%)] text-[oklch(0.92_0.1_235)] border-[oklch(0.72_0.15_235/40%)]",
  RESOLVED:
    "bg-[oklch(0.78_0.2_145/22%)] text-[oklch(0.94_0.14_145)] border-[oklch(0.78_0.2_145/40%)]",
};

function TicketsTab() {
  type FilterT = "all" | "open" | "ip" | "resolved";
  const [filter, setFilter] = useState<FilterT>("all");

  const counts = {
    all: paTickets.length,
    open: paTickets.filter((t) => t.status === "OPEN").length,
    ip: paTickets.filter((t) => t.status === "IN-PROGRESS").length,
    resolved: paTickets.filter((t) => t.status === "RESOLVED").length,
  };

  const filtered = paTickets.filter((t) => {
    if (filter === "all") return true;
    if (filter === "open") return t.status === "OPEN";
    if (filter === "ip") return t.status === "IN-PROGRESS";
    return t.status === "RESOLVED";
  });

  const chips: { id: FilterT; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "open", label: "Open", count: counts.open },
    { id: "ip", label: "In-Progress", count: counts.ip },
    { id: "resolved", label: "Resolved", count: counts.resolved },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-display text-2xl font-bold">Tickets</h1>

      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1.5 overflow-x-auto pb-1">
          {chips.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filter === c.id
                  ? "border-white/25 bg-white/15 text-white"
                  : "border-white/10 bg-white/5 text-white/65"
              }`}
            >
              {c.label}
              <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] tabular-nums">
                {c.count}
              </span>
            </button>
          ))}
        </div>
        <button className="flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-medium text-white/75">
          <Calendar className="h-3.5 w-3.5" />
          All Time
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((t) => (
          <PaTicketCard key={t.id} ticket={t} />
        ))}
      </div>
    </div>
  );
}

function PaTicketCard({ ticket }: { ticket: PaTicket }) {
  return (
    <GlassCard variant="default">
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{
          background: priorityBar[ticket.priority],
          boxShadow: `0 0 12px ${priorityBar[ticket.priority]}`,
        }}
      />
      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
              {ticket.id}
            </div>
            <div className="text-[10px] text-white/45">{ticket.date}</div>
          </div>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider ${statusStyle[ticket.status]}`}
          >
            {ticket.status}
          </span>
        </div>
        <p className="mt-2 text-[15px] font-medium leading-snug text-white">
          {ticket.title}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">
              {ticket.assignee
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </div>
            <span className="text-xs text-white/70">{ticket.assignee}</span>
          </div>
          <button className="flex items-center gap-1 text-xs font-semibold text-white/75 hover:text-white">
            View <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

/* ---------------- Loggers ---------------- */

function LoggersTab() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-display text-2xl font-bold">Loggers</h1>

      <GlassCard glow="oklch(0.7 0.22 25 / 50%)">
        <button className="flex w-full items-center gap-4 p-5 text-left">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[oklch(0.7_0.22_25/22%)] shadow-[0_0_18px_oklch(0.7_0.22_25/35%)]">
            <Fuel className="h-5 w-5 text-[oklch(0.85_0.16_30)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-display text-lg font-semibold">Diesel Logger</div>
            <div className="mt-0.5 text-xs text-white/60">
              4 generators · 1 low-fuel warning
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.7_0.22_25/20%)] px-2.5 py-0.5 text-[10px] font-bold text-[oklch(0.92_0.14_30)]">
              <AlertTriangle className="h-3 w-3" />
              DG-2 below 20%
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-white/45" />
        </button>
      </GlassCard>

      <GlassCard glow="oklch(0.78 0.18 65 / 50%)">
        <button className="flex w-full items-center gap-4 p-5 text-left">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[oklch(0.78_0.18_65/22%)] shadow-[0_0_18px_oklch(0.78_0.18_65/35%)]">
            <Zap className="h-5 w-5 text-[oklch(0.88_0.14_75)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-display text-lg font-semibold">
              Electricity Logger
            </div>
            <div className="mt-0.5 text-xs text-white/60">
              1 meter · 1,248 kVAh today
            </div>
            <div className="mt-2 text-[11px] font-medium text-white/55">
              Last reading 2 h ago
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-white/45" />
        </button>
      </GlassCard>
    </div>
  );
}

/* ---------------- Gamify ---------------- */

function GamifyTab() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display text-2xl font-bold">Gamify</h1>

      <GlassCard variant="strong" glow="oklch(0.55 0.18 285 / 65%)">
        <div className="p-5">
          <div className="flex items-center gap-3">
            <LevelBadge
              level={propertyAdminUser.level}
              name={propertyAdminUser.levelName}
              size="lg"
            />
            <div className="ml-auto text-right">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                Total XP
              </div>
              <div className="text-display text-2xl font-bold tabular-nums">
                {propertyAdminUser.totalXp.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <XPBar
              xp={propertyAdminUser.xp}
              xpForNext={propertyAdminUser.xpForNext}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <StreakChip streak={propertyAdminUser.streak} />
            <div className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/85">
              Weekly #{propertyAdminUser.weeklyRank}
            </div>
          </div>
        </div>
      </GlassCard>

      <div>
        <SectionTitle>Achievements</SectionTitle>
        <div className="grid grid-cols-3 gap-2.5">
          {achievements.map((a, i) => (
            <AchievementBadge key={a.id} a={a} delay={i * 0.05} />
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Daily Quests</SectionTitle>
        <DailyQuests quests={dailyQuests} />
      </div>

      <div>
        <SectionTitle>Weekly Leaderboard</SectionTitle>
        <Leaderboard rows={weeklyLeaderboard} />
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
      {children}
    </div>
  );
}

/* ---------------- Settings ---------------- */

function SettingsTab() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-display text-2xl font-bold">Settings</h1>

      <GlassCard>
        <div className="flex items-center gap-3 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-[oklch(0.55_0.16_285)] to-[oklch(0.4_0.12_270)] text-sm font-semibold">
            {propertyAdminUser.initials}
          </div>
          <div>
            <div className="text-display text-base font-semibold">
              {propertyAdminUser.name}
            </div>
            <div className="text-xs text-white/60">Property Admin · SS Plaza</div>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
            Property
          </div>
          <div className="text-display mt-1 text-base font-semibold">
            {property.name}
          </div>
          <div className="text-xs text-white/60">{property.code}</div>
        </div>
      </GlassCard>

      <SettingsRow icon={Moon} label="Appearance" value="Dark" />
      <SettingsRow icon={Bell} label="Notifications" value="On" />
      <SettingsRow icon={ShieldCheck} label="Security" value="Biometric" />
      <SettingsRow icon={HelpCircle} label="Help & Support" value="" />
      <SettingsRow icon={Filter} label="Terms & Privacy" value="" />
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Moon;
  label: string;
  value: string;
}) {
  return (
    <button className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.07]">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8">
        <Icon className="h-4 w-4 text-white/75" />
      </div>
      <span className="flex-1 text-sm font-medium">{label}</span>
      {value && <span className="text-xs text-white/55">{value}</span>}
      <ChevronRight className="h-4 w-4 text-white/40" />
    </button>
  );
}

// silence unused var warning for Users (kept for visual budget)
void Users;
