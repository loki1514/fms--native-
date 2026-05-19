# Cassandra Tools Enhancement Plan

> **Scope:** Enhance existing tool calling ONLY. No new UI. No new screens. Voice on hold.
> **Goal:** When user asks "today's diesel consumption" or "today's tickets" in the existing chat, real data comes back.

---

## What's Already Working

The existing pipeline in `services/ai/pipeline/`:
1. `voicePipeline.ts` → tries backend proxy first, falls back to local
2. `intent.ts` → keyword matching (`diesel` → diesel intent)
3. `planner.ts` → maps intent to execution step
4. `tools.ts` → Supabase query function
5. `voicePipeline.ts` (`executeStep`) → switch case calls the tool
6. `voicePipeline.ts` (`generateTemplateResponse`) → formats answer for display

**Current tools:** tickets, meeting rooms, visitors, property info
**Missing tools:** diesel, electricity, stock, SOPs, PPM, vendors, escalation, staff

---

## Tools to Add (Phase 1)

### 1. Diesel Tool
**Triggers:** "diesel", "fuel", "generator", "tank", "dg"
**Query:** `diesel_logs` + `dg_generators`
**Displays:** Current level %, liters, last fill date, generator status

### 2. Electricity Tool
**Triggers:** "electricity", "power", "kwh", "consumption", "units"
**Query:** `electricity_readings`
**Displays:** Today's reading, previous reading, consumption, trend

### 3. Stock/Inventory Tool
**Triggers:** "stock", "inventory", "spare parts", "supplies", "reorder"
**Query:** `stock_items`
**Displays:** Low stock items, reorder alerts, quantities

### 4. SOP/Checklist Tool
**Triggers:** "sop", "checklist", "daily task", "completion", "missed"
**Query:** `sop_templates` + `sop_completions`
**Displays:** Today's completion rate, missed tasks, pending items

### 5. PPM Schedule Tool
**Triggers:** "ppm", "preventive", "maintenance schedule", "upcoming", "overdue"
**Query:** `ppm_schedules`
**Displays:** Upcoming PPM, overdue items, next due date

---

## Files to Modify (No New Files Except Tool Modules)

### File 1: `services/ai/pipeline/tools.ts`
Add 5 new exported functions:
```typescript
export async function getDieselLogTool(propertyId, params) → ToolResult
export async function getElectricityTool(propertyId, params) → ToolResult
export async function getStockTool(propertyId, params) → ToolResult
export async function getSOPStatusTool(propertyId, params) → ToolResult
export async function getPPMScheduleTool(propertyId, params) → ToolResult
```

### File 2: `services/ai/pipeline/intent.ts`
Add 5 new intents to the `Intent` union type:
```typescript
| 'get_diesel'
| 'get_electricity'
| 'get_stock'
| 'get_sop_status'
| 'get_ppm_schedule'
```

Add keyword matching in `fastPathClassification()`:
```typescript
if (/diesel|fuel|generator|tank|dg/.test(lower))
  return { intent: 'get_diesel', ... };
if (/electricity|power|kwh|consumption|units/.test(lower))
  return { intent: 'get_electricity', ... };
// etc.
```

### File 3: `services/ai/pipeline/planner.ts`
Add 5 new entries to `INTENT_TO_STEPS`:
```typescript
get_diesel: () => [
  { step: 'get_diesel_log', params: {}, purpose: 'Get diesel level', required: true },
],
get_electricity: () => [
  { step: 'get_electricity', params: {}, purpose: 'Get electricity reading', required: true },
],
// etc.
```

### File 4: `services/ai/pipeline/voicePipeline.ts`

**Import new tools** at the top:
```typescript
import {
  // existing imports...
  getDieselLogTool,
  getElectricityTool,
  getStockTool,
  getSOPStatusTool,
  getPPMScheduleTool,
} from './tools';
```

**Add cases to `executeStep()` switch:**
```typescript
case 'get_diesel_log':
  return getDieselLogTool(ctx.propertyId, sanitized);
case 'get_electricity':
  return getElectricityTool(ctx.propertyId, sanitized);
// etc.
```

**Add template responses to `generateTemplateResponse()`:**
```typescript
const dieselStep = steps.find(s => s.step === 'get_diesel_log');
if (dieselStep?.success && dieselStep.data) {
  const d = dieselStep.data as { tank_percent: number; liters: number; last_filled: string };
  return `Tank 2 is at ${d.tank_percent}% (${d.liters}L). Last filled ${d.last_filled}.`;
}

const electricityStep = steps.find(s => s.step === 'get_electricity');
if (electricityStep?.success && electricityStep.data) {
  const d = electricityStep.data as { today_kwh: number; previous_kwh: number; trend: number };
  return `Today's consumption: ${d.today_kwh} kWh (${d.trend > 0 ? '+' : ''}${d.trend}% vs yesterday).`;
}
// etc.
```

---

## What This Gets You

User opens existing `CassandraSessionModal` → types "How much diesel is left?" →
1. Backend proxy tries first (if available)
2. Falls back to local pipeline
3. `intent.ts` matches "diesel" keyword
4. `planner.ts` maps to `get_diesel_log` step
5. `tools.ts` queries `diesel_logs` table
6. `generateTemplateResponse()` formats: "Tank 2 is at 68% (340L). Last filled 3 days ago."

**Zero UI changes.** The same chat bubble displays the answer.

---

## What's NOT in This Plan

| Item | Status |
|------|--------|
| New screens | ❌ Not building |
| New components | ❌ Not building |
| Voice features | ❌ On hold |
| Backend `/chat` endpoint | ❌ Not in this repo |
| Tool registry pattern | ❌ Not refactoring existing architecture |
| Vendors/escalation/staff tools | ⏸ Phase 2 (after Phase 1 works) |

---

## Estimated Effort

| Tool | Files Touched | Time |
|------|--------------|------|
| Diesel | tools.ts, intent.ts, planner.ts, voicePipeline.ts | 30 min |
| Electricity | same 4 files | 30 min |
| Stock | same 4 files | 30 min |
| SOP | same 4 files | 30 min |
| PPM | same 4 files | 30 min |
| **Total** | **4 files, 5 tools** | **~2.5 hours** |

---

## Testing Checklist

- [ ] "How much diesel is left?" → returns real data from `diesel_logs`
- [ ] "What was today's electricity consumption?" → returns real data from `electricity_readings`
- [ ] "Any low stock items?" → returns real data from `stock_items`
- [ ] "Did today's checklist get completed?" → returns real data from `sop_completions`
- [ ] "When is the next PPM?" → returns real data from `ppm_schedules`
