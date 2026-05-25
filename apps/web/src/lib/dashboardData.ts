import {
  Ticket,
  CheckSquare,
  HeartPulse,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface ChartPoint {
  label: string;
  value: number;
}

export interface BreakdownItem {
  label: string;
  value: string | number;
  color: string;
}

export interface TileDetail {
  id: string;
  icon: LucideIcon;
  label: string;
  title: string;
  metrics: { label: string; value: string }[];
  chartTitle: string;
  chartData: ChartPoint[];
  chartColor: string;
  trendDirection: "up" | "down";
  trendLabel: string;
  breakdownTitle: string;
  breakdown: BreakdownItem[];
  aiAnalysis: string;
}

export const tileDetails: Record<string, TileDetail> = {
  tickets: {
    id: "tickets",
    icon: Ticket,
    label: "Tickets",
    title: "SS Plaza · Tickets",
    metrics: [
      { label: "Raised today", value: "51" },
      { label: "Daily avg", value: "48.8" },
      { label: "Total", value: "1,463" },
    ],
    chartTitle: "7-Day History",
    chartData: [
      { label: "Mon", value: 206 },
      { label: "Tue", value: 211 },
      { label: "Wed", value: 210 },
      { label: "Thu", value: 210 },
      { label: "Fri", value: 207 },
      { label: "Sat", value: 211 },
      { label: "Sun", value: 209 },
    ],
    chartColor: "oklch(0.72 0.18 235)",
    trendDirection: "up",
    trendLabel: "+2.4% vs last week",
    breakdownTitle: "Status Breakdown",
    breakdown: [
      { label: "Open", value: 804, color: "oklch(0.78 0.18 65)" },
      { label: "In Progress", value: 0, color: "oklch(0.72 0.15 235)" },
      { label: "Resolved", value: 659, color: "oklch(0.78 0.2 145)" },
    ],
    aiAnalysis:
      "Ticket volume is critically high. Recommend immediate staff reallocation and priority triage. Resolution rate is below the optimal threshold for SLA compliance.",
  },
  checklist: {
    id: "checklist",
    icon: CheckSquare,
    label: "Checklist",
    title: "SS Plaza · Daily Checklist",
    metrics: [
      { label: "Completed", value: "87" },
      { label: "Total", value: "100" },
      { label: "Overdue", value: "4" },
    ],
    chartTitle: "Completion Trend",
    chartData: [
      { label: "Mon", value: 78 },
      { label: "Tue", value: 82 },
      { label: "Wed", value: 85 },
      { label: "Thu", value: 80 },
      { label: "Fri", value: 88 },
      { label: "Sat", value: 90 },
      { label: "Sun", value: 87 },
    ],
    chartColor: "oklch(0.78 0.2 145)",
    trendDirection: "up",
    trendLabel: "+5.1% this week",
    breakdownTitle: "Category Status",
    breakdown: [
      { label: "Safety", value: "24/25", color: "oklch(0.78 0.2 145)" },
      { label: "Maintenance", value: "31/35", color: "oklch(0.72 0.15 235)" },
      { label: "Cleaning", value: "20/25", color: "oklch(0.78 0.18 65)" },
      { label: "Inspection", value: "12/15", color: "oklch(0.65 0.2 295)" },
    ],
    aiAnalysis:
      "Daily completion is above target at 87%. Cleaning category is trending below benchmark — assign additional resources during the 14:00–17:00 window to close the gap.",
  },
  health: {
    id: "health",
    icon: HeartPulse,
    label: "Health",
    title: "SS Plaza · Facility Health",
    metrics: [
      { label: "Score", value: "62" },
      { label: "Open issues", value: "804" },
      { label: "Critical", value: "12" },
    ],
    chartTitle: "Health Score · 7 Days",
    chartData: [
      { label: "Mon", value: 78 },
      { label: "Tue", value: 75 },
      { label: "Wed", value: 71 },
      { label: "Thu", value: 68 },
      { label: "Fri", value: 65 },
      { label: "Sat", value: 63 },
      { label: "Sun", value: 62 },
    ],
    chartColor: "oklch(0.66 0.24 22)",
    trendDirection: "down",
    trendLabel: "-20.5% vs last week",
    breakdownTitle: "System Status",
    breakdown: [
      { label: "HVAC", value: "Critical", color: "oklch(0.66 0.24 22)" },
      { label: "Electrical", value: "Warning", color: "oklch(0.78 0.18 65)" },
      { label: "Plumbing", value: "Healthy", color: "oklch(0.78 0.2 145)" },
      { label: "Fire Safety", value: "Healthy", color: "oklch(0.78 0.2 145)" },
    ],
    aiAnalysis:
      "Health score has declined 20% week-over-week, primarily driven by HVAC failures on floors 4–7. Schedule preventive maintenance within 48 hours to avoid escalation.",
  },
  energy: {
    id: "energy",
    icon: Zap,
    label: "Energy Usage",
    title: "SS Plaza · Energy",
    metrics: [
      { label: "Today (kWh)", value: "1,248" },
      { label: "Avg / day", value: "1,114" },
      { label: "Peak hour", value: "14:00" },
    ],
    chartTitle: "Hourly Consumption",
    chartData: [
      { label: "06", value: 420 },
      { label: "09", value: 780 },
      { label: "12", value: 1080 },
      { label: "15", value: 1248 },
      { label: "18", value: 980 },
      { label: "21", value: 640 },
      { label: "00", value: 380 },
    ],
    chartColor: "oklch(0.78 0.18 65)",
    trendDirection: "up",
    trendLabel: "+12% vs avg",
    breakdownTitle: "Source Mix",
    breakdown: [
      { label: "Grid", value: "68%", color: "oklch(0.72 0.15 235)" },
      { label: "DG (Diesel)", value: "24%", color: "oklch(0.78 0.18 65)" },
      { label: "Solar", value: "8%", color: "oklch(0.78 0.2 145)" },
    ],
    aiAnalysis:
      "Consumption is 12% above the 30-day average. Peak demand at 14:00 suggests HVAC over-cycling. Shifting non-essential loads to off-peak hours could reduce cost by ~₹38k this month.",
  },
};
