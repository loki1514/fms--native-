# Gamification System — Full Design & Implementation Plan

**Project:** FMS SaaS — Maintenance Staff Tool Gamification
**Date:** 2026-04-19
**Status:** Architecture Design — Ready for Implementation

---

## Executive Summary

The app already has a gamification *shell* — UI types, a `useGamification` hook, leaderboard display, SLA timers, and daily countdowns — but **zero backend logic**. All gamification data flows are stubs. This plan designs a complete, cascading 3-tier reward system where every action by an MST staff member contributes upward to Assistant Manager and Property Admin dashboards, making gamification a core measurement layer across all dashboards.

---

## Part 1 — What Already Exists

| Component | Location | Status |
|---|---|---|
| `useGamification` hook | `hooks/mst/useGamification.ts` | Frontend only — calls non-existent API |
| `LeaderboardEntry` type | `utils/api/mobileApi.ts:254` | Types defined, no backend |
| `MyStatsResponse` type | `utils/api/mobileApi.ts:293` | Types defined, no backend |
| `getLeaderboard()` API fn | `utils/api/mobileApi.ts:329` | Calls `GET /api/mst/gamification/leaderboard` (missing route) |
| `getMyGamificationStats()` API fn | `utils/api/mobileApi.ts:335` | Calls `GET /api/mst/gamification/my-stats` (missing route) |
| Leaderboard UI | `NewMstDashboard.tsx:738` | Shows leaderboard + countdown |
| Champion card UI | `NewMstDashboard.tsx:778` | Weekly champion display |
| SLA Timer (pill + circular) | `components/ui/SLATimer.tsx` | Fully functional |
| SLA Indicator (timeline) | `components/tickets/SLAIndicator.tsx` | Fully functional |
| Ticket SLA Tile | `components/dashboard/TicketSLATile.tsx` | Fully functional |
| Shift check-in/out | `MstDashboard.tsx:158` | Functional (time tracking) |
| SOP/Checklist CRUD | `services/sopService.ts` | Functional but no gamification |
| Meter readings service | `services/cassandra/` | Functional but no gamification |
| Supabase `mst_daily_scores` subscription | `useGamification.ts:61` | Subscribes to non-existent table |

**Nothing that calculates, stores, or awards points/badges/streaks is implemented.**

---

## Part 2 — The Game Design: Cascading 3-Tier System

### Philosophy: "Every Action Ripples Up"

The fundamental design insight is that an MST staff member's daily actions are the **only source of truth** for the entire organization's health metrics. Assistant Managers and Property Admins don't "do" things — they oversee things that MSTs do. So the gamification system is a **waterfall**:

```
MST (L1) → does actions → earns points
  ↓ those same points aggregate upward
Assistant Manager (L2) → sees L1 performance → earns points from team performance
  ↓ those same points aggregate upward
Property Admin (L3) → sees L1+L2 performance → earns points from org performance
```

**Consequence:** L1 actions are the only thing that needs to be instrumented. The system automatically computes L2 and L3 from L1 data.

---

### Tier 1 — MST Level (Maintenance Staff)

This is where all points originate. Every action is measurable.

#### Point Sources

| Action | Points | Trigger | Bonus Conditions |
|---|---|---|---|
| **App opens on streak** | +5 | Daily login | +2 bonus per consecutive day (caps at +15/day from streak) |
| **Meter reading submitted on time** | +10 | Reading saved before deadline | +5 if submitted >2hr before deadline |
| **Meter reading late** | +2 | Reading saved after deadline | 0 if missed entirely |
| **Checklist completed 100%** | +20 | All steps completed | +5 if completed >30min before deadline |
| **Checklist partially completed** | +3/steps | Each step completed | — |
| **SLA not breached on resolved ticket** | +15 | Ticket resolved before SLA | +5 bonus if resolved >50% before SLA |
| **First-time fix (no reassign)** | +10 | Ticket resolved without reassignment | — |
| **Ticket reopens (staff error)** | -5 | Ticket status reverts to open | — |
| **SLA breached** | -10 | SLA deadline passed while open | — |
| **AMC maintenance logged on time** | +15 | AMC task completed before due date | +5 if photo evidence attached |
| **AMC maintenance missed** | -8 | AMC task not done by due date | — |
| **Shift check-in on time** | +5 | Check-in within 5 min of shift start | — |
| **Shift check-in late** | +1 | Check-in 5–30 min late | 0 if >30min late |

#### Streak Mechanics

- **Opening streak:** Consecutive days the app is opened. Resets to 0 if a day is missed. Visual: fire icon that grows from ember → flame → inferno at 7/14/30 days.
- **Checklist streak:** Consecutive days all assigned checklists were completed 100%.
- **SLA streak:** Consecutive tickets resolved before SLA. Resets on any breach.
- **Streak multiplier:** After 7-day streak on any metric, that metric's points double until streak breaks.

#### MST Badges

| Badge | Code | Criteria | Tier |
|---|---|---|---|
| First Light | `first_light` | Complete first checklist | Bronze |
| Early Bird | `early_bird` | Submit first on-time reading | Bronze |
| Streak Starter | `streak_3` | 3-day opening streak | Bronze |
| Streak Runner | `streak_7` | 7-day opening streak | Silver |
| Streak Master | `streak_14` | 14-day opening streak | Silver |
| Streak Legend | `streak_30` | 30-day opening streak | Gold |
| SLA Guardian | `sla_guardian_10` | 10 consecutive SLA-met tickets | Bronze |
| SLA Champion | `sla_champion_50` | 50 consecutive SLA-met tickets | Silver |
| SLA Immortal | `sla_immortal_100` | 100 consecutive SLA-met tickets | Gold |
| Checklist Pro | `checklist_10` | Complete 10 checklists | Bronze |
| Checklist Expert | `checklist_50` | Complete 50 checklists | Silver |
| Checklist Master | `checklist_100` | Complete 100 checklists | Gold |
| First Responder | `first_response` | First ticket resolved | Bronze |
| Top Performer | `top_3` | End of week in top 3 of leaderboard | Silver |
| Champion | `champion` | End of week #1 on leaderboard | Gold |
| AMC Keeper | `amc_on_time` | All AMC tasks on time for 7 days | Silver |

#### MST Level Display (UI)

The `NewMstDashboard` becomes the primary gamification surface:

```
┌──────────────────────────────────────────────────────┐
│  [🔥 Streak: 12 days]  [⚡ 847 pts today]  [🎯 Lv.7] │
│  ████████████░░░░ 1,240 / 1,500 to Level 8         │
└──────────────────────────────────────────────────────┘
```

A **gamification banner** is added at the top of the dashboard showing:
- Current level + XP bar to next level
- Points earned today
- Active streak with fire icon
- Nearest badge progress

---

### Tier 2 — Assistant Manager Level

AMs oversee 3–8 MSTs. Their score = **sum of their team's L1 points**, multiplied by an oversight bonus.

#### Point Sources

| Source | Points | Formula |
|---|---|---|
| **Team's L1 points** | — | Sum of all MST points in AM's team per day |
| **Team SLA compliance rate** | +20/day | +20 if team SLA >= 95%, +10 if >= 85%, 0 if < 85% |
| **Team checklist completion rate** | +15/day | +15 if team 100%, +8 if >= 80%, 0 if < 80% |
| **AM responds to escalations fast** | +10/escalation | AM resolves escalated ticket within 2hr |
| **Daily team huddle logged** | +5 | AM submits daily standup notes |
| **Performance review submitted** | +25 | AM submits weekly performance review for each MST |
| **Team member promoted (MST → AM)** | +100 | When an MST under the AM earns enough XP to be recognized |

#### Level Progression (AM)

| Level | Title | XP Required | Unlocks |
|---|---|---|---|
| 1 | Trainee AM | 0 | Basic dashboard |
| 2 | Associate AM | 2,000 | Team attendance view |
| 3 | AM | 5,000 | Custom team KPIs |
| 4 | Senior AM | 10,000 | Multi-property oversight |
| 5 | Lead AM | 20,000 | Custom badges creation |
| 6 | Principal AM | 40,000 | Org-wide analytics |
| 7 | AM Director | 75,000 | Full dashboard customization |
| 8 | Operations Lead | 120,000 | API access + export |
| 9 | Head of Operations | 200,000 | Executive dashboard |

#### AM Badges

| Badge | Code | Criteria |
|---|---|---|
| Team Builder | `team_built` | AM has 5+ MSTs under them |
| SLA Commander | `sla_95_team` | Team maintains 95% SLA for 30 days |
| Streak Manager | `streak_manager_7` | Team achieves 7-day streak collectively |
| Growth Coach | `promoted_1` | First MST under them promoted |
| Escalation Zero | `escalation_zero_7` | No escalations in 7 days |
| Perfect Week | `perfect_week` | All MSTs on team score 100% daily |
| Drill Sergeant | `drill_sergeant` | Team hits 100% checklist completion for 14 days |

#### AM Level Display (UI)

The `AssistantManagerDashboard` (to be created or existing `MasterAdminDashboard` modified) shows:

```
┌────────────────────────────────────────────────────────┐
│  Team Health: ████████████ 92% SLA    Streak: 8 days  │
│  Team Points Today: ⚡ 3,847 pts   [🎖️ Lv.4 Senior AM]│
│  ████████████░░░░ 1,240 / 1,500 to Level 5            │
│                                                        │
│  ┌─ Team Leaderboard ─────────────────────────────┐   │
│  │ 1. 🔥 Rahul K.     847pts   |  12-day streak  │   │
│  │ 2. 🔥 Priya M.     723pts   |   8-day streak  │   │
│  │ 3. 🔥 Ankit S.     698pts   |   5-day streak  │   │
│  └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

---

### Tier 3 — Property Admin Level

Property Admins oversee the entire property. Their score = **sum of all L1 + L2 points** for the property, plus org-level bonuses.

#### Point Sources

| Source | Points | Formula |
|---|---|---|
| **All L1 + L2 points in property** | — | Sum of all MST + AM points daily |
| **Property SLA overall** | +30/day | +30 if org SLA >= 95%, +15 if >= 85%, 0 if < 85% |
| **Property checklist compliance** | +25/day | +25 if all checklists 100%, +12 if >= 90% |
| **AMC compliance across all MSTs** | +20/day | +20 if all AMC tasks on schedule |
| **No critical incidents this week** | +50/week | Property has 0 critical tickets unresolved >24hr |
| **All shifts filled** | +10/day | 100% shift coverage (no unfilled shifts) |
| **Energy efficiency target met** | +15/day | Grid consumption within ±5% of target |
| **Tenant satisfaction score** | +20/quarter | NPS/CSAT survey score above threshold |
| **Zero escalations this week** | +35/week | No tickets escalated to management |

#### Level Progression (Property Admin)

| Level | Title | XP Required | Unlocks |
|---|---|---|---|
| 1 | Trainee Admin | 0 | Property overview |
| 2 | Property Admin | 5,000 | Budget management view |
| 3 | Senior Property Admin | 15,000 | Multi-property view |
| 4 | Regional Lead | 35,000 | Regional analytics |
| 5 | Operations Manager | 70,000 | Cross-property comparison |
| 6 | Regional Director | 150,000 | Custom KPI builder |
| 7 | VP Operations | 300,000 | Executive reporting |
| 8 | COO | 500,000 | Full org control |

#### Property Admin Badges

| Badge | Code | Criteria |
|---|---|---|
| Fortress | `fortress_95` | Property 95%+ SLA for 90 days |
| Fortress Platinum | `fortress_99` | Property 99%+ SLA for 30 days |
| Checklist Kingdom | `checklist_kingdom` | All checklists 100% for 30 days |
| Energy Efficient | `energy_saver` | Energy target met 30 days consecutively |
| Perfect Month | `perfect_month` | Zero SLA breaches for 30 days |
| Zero Escalations | `escalation_free_30` | No escalations for 30 days |
| Mentor | `mentor_10` | 10 MSTs under management promoted |
| Safety Champion | `safety_first` | Zero safety incidents for 180 days |
| Gold Property | `gold_property` | Top 10% property on national leaderboard |

#### Property Admin Level Display (UI)

The `PropertyAdminDashboard` (or existing) shows the org-wide gamification view:

```
┌─────────────────────────────────────────────────────────────┐
│  ⚡ 12,847 org pts today  |  🏆 #3 of 47 properties       │
│  SLA: 94.2%  ✓  |  Checklist: 97%  ✓  |  AMC: 98%  ✓      │
│  [🎖️ Lv.5 Operations Manager]  ████████░░░ 8,240/12,000   │
│                                                             │
│  ┌─ Property Leaderboard ───────────────────────────────┐    │
│  │ #1 ██ SS Plaza         18,432 pts  |  94% SLA     │    │
│  │ #2 ██ Tech Park West   17,891 pts  |  91% SLA     │    │
│  │ #3 ██ SS Plaza (you)  12,847 pts  |  94% SLA     │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 3 — XP Calculation Formulas

### Daily XP for MST (L1)

```
daily_mst_xp =
  (streak_points)
  + (meter_reading_points)
  + (checklist_points)
  + (ticket_resolution_points)
  + (amc_points)
  + (shift_points)

where:
  streak_points = min(5 + (streak_days * 2), 15)
  meter_reading_points = on_time ? 10 : (late ? 2 : 0)
  checklist_points = completed ? 20 : (partial ? steps_completed * 3 : 0)
  ticket_resolution_points = sla_met ? 15 : (breach ? -10 : 0)
  amc_points = on_time ? 15 : (missed ? -8 : 0)
  shift_points = on_time ? 5 : (late ? 1 : 0)
```

### Level Thresholds (MST)

| Level | Title | Cumulative XP |
|---|---|---|
| 1 | Rookie | 0 |
| 2 | Apprentice | 300 |
| 3 | Junior | 800 |
| 4 | Staff | 1,500 |
| 5 | Senior | 2,800 |
| 6 | Specialist | 4,500 |
| 7 | Expert | 7,000 |
| 8 | Master | 10,000 |
| 9 | Elite | 14,000 |
| 10 | Legend | 20,000 |

### Cascading Aggregation

```
L1_score = Σ(mst_daily_xp for all MSTs)

L2_score = Σ(L1_score) + oversight_bonus + review_bonus

L3_score = Σ(L1_score + L2_score) + org_bonus

All scores reset daily (daily leaderboard).
Weekly leaderboard = Σ(daily scores for 7 days).
Monthly leaderboard = Σ(weekly scores for 4 weeks).
```

---

## Part 4 — What Needs to Be Built

### Phase 1: Foundation (Backend + DB) — Critical Path

**4.1 Supabase Tables**

```sql
-- Core gamification: records every point event
CREATE TABLE gamification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  property_id UUID REFERENCES properties(id) NOT NULL,
  event_type TEXT NOT NULL,          -- 'app_open', 'meter_reading', 'checklist_complete', 'ticket_resolved', etc.
  event_data JSONB DEFAULT '{}',      -- Flexible payload (e.g., { ticket_id, sla_met: true, reading_id })
  points INTEGER NOT NULL,
  multiplier FLOAT DEFAULT 1.0,      -- streak multiplier
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Partition by day for performance
  date DATE GENERATED ALWAYS AS (created_at::date) STORED
);

-- Daily aggregated scores per user
CREATE TABLE mst_daily_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  property_id UUID REFERENCES properties(id) NOT NULL,
  date DATE NOT NULL,
  total_points INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  tickets_resolved INTEGER DEFAULT 0,
  sla_met_count INTEGER DEFAULT 0,
  first_time_fixes INTEGER DEFAULT 0,
  checklist_completions INTEGER DEFAULT 0,
  meter_readings INTEGER DEFAULT 0,
  amc_completions INTEGER DEFAULT 0,
  shift_ontime BOOLEAN DEFAULT false,
  badges_earned TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, property_id, date)
);

-- Weekly aggregated scores
CREATE TABLE mst_weekly_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  property_id UUID REFERENCES properties(id) NOT NULL,
  week_start DATE NOT NULL,
  total_points INTEGER DEFAULT 0,
  avg_daily_points FLOAT DEFAULT 0,
  streak_continuation INTEGER DEFAULT 0,
  badges_earned TEXT[] DEFAULT '{}',
  rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, property_id, week_start)
);

-- Badge definitions
CREATE TABLE gamification_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  tier TEXT CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  criteria_type TEXT NOT NULL,       -- 'streak', 'count', 'sla', 'checklist', 'leaderboard'
  criteria_threshold INTEGER NOT NULL,
  criteria_field TEXT NOT NULL,       -- e.g., 'streak_days', 'tickets_resolved'
  xp_reward INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User badges (earned)
CREATE TABLE mst_user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  badge_code TEXT REFERENCES gamification_badges(code) NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_code)
);

-- User levels
CREATE TABLE mst_user_levels (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  current_level INTEGER DEFAULT 1,
  total_xp INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Level definitions
CREATE TABLE gamification_levels (
  level INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  min_xp INTEGER NOT NULL,
  max_xp INTEGER NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL
);
```

**4.2 Backend API Routes** (in `saas_mobile/app/api/mst/gamification/`)

| Route | Method | Description |
|---|---|---|
| `leaderboard/route.ts` | GET | Returns ranked list of users with scores for a property |
| `my-stats/route.ts` | GET | Returns current user's stats, XP, level, badges, streak |
| `events/route.ts` | POST | Records a gamification event (called by other services) |
| `badges/route.ts` | GET | Returns all available badges + user's earned badges |
| `levels/route.ts` | GET | Returns level thresholds and definitions |
| `weekly-summary/route.ts` | GET | Returns weekly summary for all users in property |

**4.3 Event Ingestion Service**

A central function that all other services call when actions happen:

```typescript
// services/gamificationService.ts
async function recordEvent(params: {
  userId: string;
  propertyId: string;
  eventType: GamificationEventType;
  eventData?: Record<string, any>;
}): Promise<{ pointsEarned: number; badgesEarned: string[]; leveledUp: boolean }>
```

This is called from:
- Meter reading save flow
- Checklist completion flow
- Ticket resolution flow
- AMC task completion flow
- Shift check-in flow
- App open (handled client-side)

---

### Phase 2: Integrate Into Existing Services

**4.4 Hook `recordEvent` Into**

| Where | Trigger | Event Type |
|---|---|---|
| `services/sopService.ts` — `completeStep()` | Each step done | `checklist_step_complete` |
| `services/sopService.ts` — `completeChecklistRun()` | Full completion | `checklist_complete` |
| `services/meterService.ts` (or cassandra service) | Reading saved | `meter_reading_submit` |
| Ticket resolution (in ticket components) | Ticket status → resolved | `ticket_resolved` |
| Ticket SLA breach (background job or trigger) | SLA passes | `sla_breach` |
| AMC task service | Task completed | `amc_complete` |
| Shift service | Check-in | `shift_checkin` |

**4.5 Daily Reset Job (Supabase Cron / pg_cron)**

Runs at 00:00 IST every day:

1. Copy yesterday's `gamification_events` aggregation → `mst_daily_scores`
2. Calculate streak (if last_active_date == yesterday → streak++, else streak = 0)
3. Check for badge awards
4. Calculate L2 (AM) and L3 (Property Admin) scores from L1 data
5. Insert into `mst_weekly_scores` if week boundary

---

### Phase 3: UI — Gamification as Core Element of MST Dashboard

**4.6 MST Dashboard Gamification Banner** (add to `NewMstDashboard.tsx`)

Replaces or sits above the current stats bar:

```
┌──────────────────────────────────────────────────────┐
│ 🔥 12d  ⚡ 847pts  [████████░░] Lv.7  / 1,500 to Lv.8 │
│ Nearest badge: [SLA Guardian] 7/10 SLA-met in streak │
└──────────────────────────────────────────────────────┘
```

Components to add:
- `GamificationBanner` — top-of-dashboard XP/level/streak bar
- `BadgeProgressRing` — circular progress showing nearest badge
- `StreakFlame` — animated flame that grows with streak length
- `LevelBadge` — current level display with level number

**4.7 Leaderboard Enhancement**

The existing `LeaderboardEntry` component already shows some data. Upgrade it to:
- Show exact XP earned today
- Show level badge
- Show active streak
- Show nearest badge progress
- Highlight user's own row
- Show rank change indicator (↑↓ vs last period)

**4.8 Badge Showcase**

A `BadgeShowcase` component (accessible from profile) showing:
- Earned badges (grid, organized by tier)
- Locked badges (greyed out with progress)
- Badge detail modal on tap
- Badge rarity percentage (% of users who have it)

**4.9 Assistant Manager Dashboard**

Modify `MasterAdminDashboard.tsx` to add:
- Team gamification section
- Per-MST performance cards
- Team leaderboard
- AM's own XP bar and level

**4.10 Property Admin Dashboard**

Modify `LovableSuperAdminDashboard.tsx` and `PropertyAdminDashboard.tsx` to add:
- Org gamification overview
- Property leaderboard (ranked properties)
- Org-level badges
- AM performance cards

---

## Part 5 — Implementation Roadmap

### Week 1-2: Database + Core API
- [ ] Create all Supabase tables
- [ ] Create API routes for leaderboard and my-stats
- [ ] Create `recordEvent()` service
- [ ] Seed badge and level definitions
- [ ] Create daily aggregation cron job
- [ ] Connect to existing `useGamification` hook (fix the missing data sources)

### Week 3-4: Event Integration
- [ ] Integrate `recordEvent()` into SOP/checklist service
- [ ] Integrate into meter reading service
- [ ] Integrate into ticket resolution flow
- [ ] Integrate into shift check-in
- [ ] Integrate into AMC service
- [ ] Write PostgreSQL trigger for SLA breach detection

### Week 5-6: UI — Level 1 (MST Dashboard)
- [ ] GamificationBanner component
- [ ] StreakFlame animated component
- [ ] LevelBadge component
- [ ] BadgeProgressRing component
- [ ] Upgrade LeaderboardEntry with gamification data
- [ ] BadgeShowcase screen
- [ ] Level up celebration animation

### Week 7-8: UI — Level 2 + 3 + Leaderboard
- [ ] AM team gamification section
- [ ] Property-level gamification overview
- [ ] Cross-property leaderboard
- [ ] Notification system for badge earned / level up
- [ ] Weekly digest (push notification)

### Week 9-10: Polish + Testing
- [ ] Performance testing (realtime subscriptions at scale)
- [ ] Leaderboard anti-gaming (edit-history, flag suspicious spikes)
- [ ] Admin tools to manually adjust scores
- [ ] Export/gaming analytics
- [ ] User testing and tuning of point values

---

## Part 6 — Tuning Parameters (To Be Calibrated With Data)

These numbers are starting points and should be adjusted based on real usage data:

| Parameter | Starting Value | Notes |
|---|---|---|
| Base points per day (active user) | 30–50 | Enough to reach Lv.2 in ~1 week |
| Points to Level 10 (Legend) | 20,000 XP | ~200 active days = ~9 months |
| Streak bonus cap | 15 pts/day | Prevents streak farming |
| SLA breach penalty | -10 pts | Significant but recoverable |
| Badge XP reward | 50–500 | Scales with tier |
| Leaderboard reset | Daily at midnight IST | Weekly/monthly views are aggregates |

---

## Appendix: Key Files to Modify

| File | Changes |
|---|---|
| `hooks/mst/useGamification.ts` | Point to real API, add `recordEvent` |
| `components/dashboard/NewMstDashboard.tsx` | Add GamificationBanner, enhance leaderboard |
| `components/dashboard/MasterAdminDashboard.tsx` | Add L2 gamification section |
| `components/dashboard/LovableSuperAdminDashboard.tsx` | Add L3 gamification section |
| `services/sopService.ts` | Call `recordEvent()` on step/complete |
| `services/cassandra/` | Call `recordEvent()` on reading save |
| Ticket resolution flow | Call `recordEvent()` on resolve |
| Shift check-in | Call `recordEvent()` on check-in |
| `utils/api/mobileApi.ts` | Add `recordEvent()`, `getBadges()`, `getLevels()` |
| `types/index.ts` | Add `GamificationEvent`, `LevelDefinition` types |
| Create: `services/gamificationService.ts` | Central event recording logic |
| Create: `components/gamification/GamificationBanner.tsx` | XP bar + streak + level |
| Create: `components/gamification/BadgeShowcase.tsx` | Badge gallery |
| Create: `components/gamification/StreakFlame.tsx` | Animated streak icon |
| Create: `app/api/mst/gamification/leaderboard/route.ts` | Backend leaderboard |
| Create: `app/api/mst/gamification/my-stats/route.ts` | Backend user stats |
| Create: `app/api/mst/gamification/events/route.ts` | Event ingestion |
| Create: `app/api/mst/gamification/badges/route.ts` | Badge definitions |
