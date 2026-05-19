/**
 * gamification.ts — Mock XP/levels/achievements/leaderboard/quests data.
 *
 * Responsibility: Type definitions and demo content powering the gamified UI
 *   on Property Admin and MST roles. Two distinct user personas (propertyAdmin
 *   vs mst) so each role shows its own level, streak, and weekly rank.
 * Used by: routes/property-admin.tsx, routes/mst.tsx, components/gamification/*.
 * Related: lib/properties.ts (leaderboard rows reference property names).
 *
 * Gotcha: `weeklyLeaderboard` row with `isMe: true` highlights the current user
 *   row in the Leaderboard component — only one row should set this flag.
 */

import {
  Award,
  Flame,
  Moon,
  Trophy,
  Zap,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

export interface UserStats {
  name: string;
  initials: string;
  level: number;
  levelName: string;
  xp: number;
  xpForNext: number;
  totalXp: number;
  streak: number;
  weeklyRank: number;
  weeklyTotal: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  unlocked: boolean;
  tint: string;
}

export interface LeaderRow {
  rank: number;
  name: string;
  initials: string;
  property: string;
  xp: number;
  resolved: number;
  streak: number;
  isMe?: boolean;
}

export interface Quest {
  id: string;
  title: string;
  reward: number;
  progress: number;
  total: number;
}

export const propertyAdminUser: UserStats = {
  name: "Amar",
  initials: "AS",
  level: 7,
  levelName: "Operations Pro",
  xp: 1240,
  xpForNext: 2000,
  totalXp: 8420,
  streak: 12,
  weeklyRank: 3,
  weeklyTotal: 24,
};

export const mstUser: UserStats = {
  name: "Manjunatha",
  initials: "MA",
  level: 9,
  levelName: "Field Master",
  xp: 1820,
  xpForNext: 2500,
  totalXp: 11240,
  streak: 18,
  weeklyRank: 1,
  weeklyTotal: 36,
};

export const achievements: Achievement[] = [
  {
    id: "first-ticket",
    name: "First Ticket",
    description: "Resolve your first ticket",
    icon: CheckCircle2,
    unlocked: true,
    tint: "oklch(0.78 0.2 145)",
  },
  {
    id: "week-streak",
    name: "Week Streak",
    description: "7 days in a row",
    icon: Flame,
    unlocked: true,
    tint: "oklch(0.7 0.22 35)",
  },
  {
    id: "ticket-master",
    name: "Ticket Master",
    description: "Resolve 100 tickets",
    icon: Trophy,
    unlocked: true,
    tint: "oklch(0.82 0.18 80)",
  },
  {
    id: "night-owl",
    name: "Night Owl",
    description: "Resolve 10 after 10pm",
    icon: Moon,
    unlocked: false,
    tint: "oklch(0.65 0.2 280)",
  },
  {
    id: "top-resolver",
    name: "Top Resolver",
    description: "#1 weekly leaderboard",
    icon: Award,
    unlocked: false,
    tint: "oklch(0.72 0.18 235)",
  },
  {
    id: "power-saver",
    name: "Power Saver",
    description: "Reduce energy 10%",
    icon: Zap,
    unlocked: false,
    tint: "oklch(0.78 0.18 65)",
  },
];

export const weeklyLeaderboard: LeaderRow[] = [
  { rank: 1, name: "Manjunatha A", initials: "MA", property: "SS Plaza", xp: 2840, resolved: 36, streak: 18 },
  { rank: 2, name: "Ravi Kumar", initials: "RK", property: "Rabale", xp: 2410, resolved: 31, streak: 9 },
  { rank: 3, name: "Amar Singh", initials: "AS", property: "SS Plaza", xp: 2180, resolved: 24, streak: 12, isMe: true },
  { rank: 4, name: "Suresh N", initials: "SN", property: "ETPL Digitide", xp: 1920, resolved: 22, streak: 6 },
  { rank: 5, name: "Priya M", initials: "PM", property: "Head Office", xp: 1740, resolved: 19, streak: 4 },
];

export const dailyQuests: Quest[] = [
  { id: "q1", title: "Resolve 5 tickets", reward: 50, progress: 3, total: 5 },
  { id: "q2", title: "Log diesel reading", reward: 20, progress: 1, total: 1 },
  { id: "q3", title: "Update meter reading", reward: 20, progress: 0, total: 1 },
];
