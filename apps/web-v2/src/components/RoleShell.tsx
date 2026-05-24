/**
 * RoleShell.tsx — Shared chrome for role-scoped pages (greeting + bottom tabs).
 *
 * Responsibility: Provides the consistent top bar (menu button → AppSidebar,
 *   back-to-roles, avatar, name/sub, notification bell) and an optional fixed
 *   bottom tab bar. The tab bar is only rendered when both `tabs` and
 *   `activeTab` + `onTabChange` are supplied — otherwise the page is plain.
 * Used by: routes/property-admin.tsx (5 tabs), and any future role page that
 *   wants the same shell. MST currently re-implements its own header — fold
 *   into this when convenient.
 *
 * Generic `<T extends string>` lets callers pass their own tab union (e.g.
 *   "dashboard" | "tickets" | ...) without losing type safety on activeTab.
 */

import { Link } from "@tanstack/react-router";
import { Bell, Menu, ArrowLeft, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { WeatherBackdrop } from "@/components/WeatherBackdrop";
import { CassandraDock } from "@/components/CassandraDock";

export interface BottomTab<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

interface RoleShellProps<T extends string> {
  greeting?: { name: string; sub: string; initials: string; tint?: string };
  tabs?: BottomTab<T>[];
  activeTab?: T;
  onTabChange?: (id: T) => void;
  children: ReactNode;
  showNotifications?: boolean;
}

export function RoleShell<T extends string>({
  greeting,
  tabs,
  activeTab,
  onTabChange,
  children,
  showNotifications = true,
}: RoleShellProps<T>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // pb-40 reserves room for both the role tab bar AND the floating Cassandra
  // dock (which sits above it). When no tabs are present, the dock alone is
  // accommodated by pb-28 worth of safe area inside.
  const hasTabs = !!tabs && tabs.length > 0 && !!activeTab && !!onTabChange;

  return (
    <WeatherBackdrop>
    <div className={`min-h-screen text-white ${hasTabs ? "pb-44" : "pb-32"}`}>
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="mx-auto w-full max-w-md px-5 pt-6 sm:pt-10">
        {greeting && (
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-xl transition hover:bg-white/20"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link
              to="/"
              aria-label="Switch role"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-xl transition hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-sm font-semibold"
              style={{
                background:
                  greeting.tint ??
                  "linear-gradient(135deg, oklch(0.55 0.14 265), oklch(0.4 0.1 250))",
              }}
            >
              {greeting.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-display text-base font-semibold leading-tight">
                Hey, {greeting.name}
              </div>
              <div className="text-xs text-white/60">{greeting.sub}</div>
            </div>
            {showNotifications && (
              <button
                aria-label="Notifications"
                className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-xl transition hover:bg-white/20"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[oklch(0.7_0.22_25)] shadow-[0_0_8px_oklch(0.7_0.22_25)]" />
              </button>
            )}
          </div>
        )}

        {children}
      </div>

      {tabs && tabs.length > 0 && activeTab && onTabChange && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[oklch(0.12_0.03_260/85%)] backdrop-blur-2xl">
          <div className="mx-auto flex max-w-md items-center justify-around px-2 py-3">
            {tabs.map((t) => {
              const active = t.id === activeTab;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => onTabChange(t.id)}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 transition ${
                    active ? "text-white" : "text-white/55 hover:text-white/80"
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                  <span className="text-[10px] font-medium tracking-wide">
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Floating Cassandra dock — lifted above any role tab bar. */}
      <CassandraDock bottomOffset={hasTabs ? 88 : 16} />
    </div>
    </WeatherBackdrop>
  );
}
