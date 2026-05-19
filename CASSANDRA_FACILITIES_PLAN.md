# Cassandra Facilities Operations Q&A — Implementation Plan

> Goal: Make Cassandra answer day-to-day facilities operations questions using what we already have.
> Constraint: Don't reinvent voice/chat infrastructure. Expand the local fallback pipeline.

---

## Phase 1: Expand Local Tool Layer (`services/ai/pipeline/`)

### 1.1 Add Facilities Tools to `tools.ts`

New tools to add alongside existing `listTicketsTool`, `createTicketTool`, etc.:

| Tool | Queries |
|------|---------|
| `listSOPsTool` | `sop_templates`, `sop_completions` — today's checklist, missed SOPs |
| `getStockTool` | `stock_items` — inventory levels, low stock alerts |
| `getPPMScheduleTool` | `ppm_schedules` — upcoming PPM, overdue maintenance |
| `getDieselLogTool` | `diesel_logs`, `dg_generators` — last fill, runtime, tank level |
| `getElectricityTool` | `electricity_readings` — today's consumption, peak hours |
| `listVendorsTool` | `vendors` — vendor list, AMC status, contact info |
| `getEscalationPathTool` | `escalation_hierarchies` — who to call for what severity |
| `getStaffOnCallTool` | `users` + `property_memberships` — on-duty staff |

**Effort:** Low. Pattern already exists. Just add Supabase queries.

### 1.2 Expand `retrieval.ts`

Currently fetches: tickets, properties, meeting room bookings.

Add retrieval for:
- Recent SOP completions (last 7 days)
- Stock items below reorder level
- PPM schedules due this week
- Last diesel reading + generator status
- Last electricity reading + trend
- Active vendors with AMC expiring < 30 days
- Escalation hierarchy for current property

**Effort:** Low. Same Supabase query pattern.

### 1.3 Update `intent.ts`

Add facilities-focused intents:
- `sop_status` — "Did the cleaning team finish today's checklist?"
- `stock_check` — "How much diesel is left?" / "Do we have enough toilet paper?"
- `ppm_query` — "When is the next AC maintenance?"
- `energy_query` — "Why is electricity usage high today?"
- `vendor_query` — "Who is the plumber on call?"
- `escalation_query` — "Who do I escalate this to?"
- `staff_query` — "Who is on duty tonight?"

**Effort:** Low. Keyword-based matching.

### 1.4 Update `planner.ts`

Map new intents to execution steps that call the new tools.

**Effort:** Low. Deterministic mapping.

---

## Phase 2: Upgrade System Prompt & Context

### 2.1 Rewrite `buildSystemPrompt()` in `openaiRealtimeService.ts`

Current prompt is generic: "You are Autopilot, a friendly voice assistant..."

Replace with facilities-expert prompt:

```
You are Cassandra, the facilities operations AI for Autopilot.
You are speaking to {userName}, a {userRole} at {propertyName}.

YOUR EXPERTISE:
- Planned Preventive Maintenance (PPM) scheduling and compliance
- Inventory and stock management
- Diesel generator monitoring and fuel tracking
- Electricity and utility consumption analysis
- Vendor and AMC management
- Escalation hierarchies and on-call staff
- SLA compliance and ticket triage
- Meeting room and visitor management

RULES:
- Be concise. 1-2 sentences for voice, 2-3 for chat.
- Always reference real data from the tools. Never guess.
- If data is missing, say "I don't have that information right now."
- For urgent issues (SLA breach, critical ticket, low diesel), flag urgency explicitly.
- Give actionable next steps: "You should escalate to {name}" or "Schedule PPM for {date}."
```

**Effort:** Low. Just rewrite the string.

### 2.2 Update Suggested Prompts in `cassandraStore.ts`

Current prompts are generic. Replace with facilities-specific:

```typescript
suggestedPrompts: [
  "Did today's cleaning checklist get completed?",
  "How much diesel is left in the generator?",
  "Which tickets are breaching SLA right now?",
  "Who is the on-call electrician this week?",
  "When is the next PPM for the HVAC system?",
]
```

**Effort:** Low.

---

## Phase 3: UI Polish (No New Screens)

### 3.1 Update Skill Chips in `CassandraSessionModal`

Current chips: triage tickets, explain energy spikes, find on-call staff, summarize reports.

Add facilities-specific chips:
- "Check today's SOPs"
- "Low stock alerts"
- "Upcoming PPM"
- "Diesel status"
- "Escalation path"

Wire each to the appropriate backend endpoint or local tool.

**Effort:** Low. Reuse existing chip component.

### 3.2 Remove "Coming Soon" Stubs

In `app/cassandra/index.tsx`, the "Team" and "Files" dock buttons show `toast.info('coming soon')`. Either:
- Wire them to actual features, OR
- Remove them to reduce UI clutter

**Effort:** Low.

---

## Phase 4: Cleanup Legacy Code

### 4.1 Deprecate `useVoiceAgent` + `voiceAgentStore`

These are superseded by `useCassandraVoice` + `cassandraStore`. Keeping both causes confusion.

Action: Add `@deprecated` JSDoc and remove from any active UI wiring. Don't delete files yet — just stop using them.

**Effort:** Low.

### 4.2 Remove `responseGenerator.ts`

It's empty/deprecated. Either delete or repurpose for facilities template responses.

**Effort:** Low.

---

## What's NOT in Scope (Intentionally)

| Item | Why Not |
|------|---------|
| Backend `/api/voice` proxy changes | Lives in web app server, not this mobile repo |
| New voice architecture | `useCassandraVoice` (WebSocket V2) already works |
| New UI screens | `CassandraSessionModal` already handles chat + voice |
| Vector DB / RAG overhaul | Supabase queries are sufficient for structured ops data |

---

## Estimated Effort

| Phase | Files | Effort |
|-------|-------|--------|
| Phase 1: Tools + Intent + Retrieval | 4 files | ~2-3 hours |
| Phase 2: Prompt + Suggestions | 2 files | ~30 min |
| Phase 3: UI Chips + Stubs | 1-2 files | ~30 min |
| Phase 4: Legacy cleanup | 2-3 files | ~30 min |
| **Total** | **~10 files** | **~4 hours** |

---

## Success Criteria

A property admin should be able to ask Cassandra:
- [ ] "Did the security guard complete the night patrol checklist?"
- [ ] "How much diesel is in Tank 2?"
- [ ] "When is the next elevator PPM due?"
- [ ] "Who do I call for a plumbing emergency at 2 AM?"
- [ ] "Which stock items are below reorder level?"
- [ ] "Why was electricity consumption 20% higher yesterday?"

And get **real data from Supabase**, not "I don't know."

---

## File Checklist

- [ ] `services/ai/pipeline/tools.ts` — add 8 new tools
- [ ] `services/ai/pipeline/retrieval.ts` — expand context sources
- [ ] `services/ai/pipeline/intent.ts` — add facilities intents
- [ ] `services/ai/pipeline/planner.ts` — map intents to new tools
- [ ] `services/ai/openaiRealtimeService.ts` — rewrite system prompt
- [ ] `stores/cassandraStore.ts` — update suggested prompts
- [ ] `components/cassandra/CassandraSessionModal.tsx` — update skill chips
- [ ] `app/cassandra/index.tsx` — remove coming-soon stubs
- [ ] `services/ai/pipeline/voicePipeline.ts` — verify fallback triggers new tools
- [ ] `hooks/useCassandraVoice.ts` — add `@deprecated` to legacy hooks
