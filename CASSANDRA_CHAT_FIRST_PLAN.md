# Cassandra: Chat-First, Voice-Later Product Plan

## Product Decision

**Chat first.** Voice comes later as the "creamy layer."

**Why this is the right call:**
- Chat forces you to nail intent understanding, tool quality, and response accuracy
- Voice is just chat + microphone + speaker — if the chat brain is solid, voice is additive
- Chat is easier to test, debug, and iterate
- Users will forgive a voice assistant that falls back to text. They won't forgive a chatbot that gives wrong answers.

## Architectural Reality Check

**What we control (this repo):** The mobile app (`saas_mobile/`)
**What we don't control (not in this repo):** The web backend (`saas_development/` only has build artifacts)

This means:
- We **CAN** build the mobile chat UI, local tool layer, and state management
- We **CANNOT** build the backend `/chat` endpoint from this repo
- We **CAN** use the existing backend endpoints: `/api/v1/features/voice/smart-query`, `/api/v1/features/voice/ticket`, etc.
- We **SHOULD** make the local fallback pipeline so robust that it feels like the backend is always there

## The Chat-First Architecture

```
┌──────────────────────────────────────────────┐
│           EXPO APP (Chat Mode Only)           │
│                                               │
│  ┌──────────────────────────────────────┐    │
│  │   Cassandra Chat Screen              │    │
│  │   - Message history (bubbles)        │    │
│  │   - Text input                       │    │
│  │   - Skill chips (quick actions)      │    │
│  │   - Typing indicator                 │    │
│  └──────────────────────────────────────┘    │
│                  │                            │
│         ┌────────┴────────┐                   │
│    Online│          Offline│                  │
│         ↓               ↓                     │
│  ┌─────────────┐   ┌──────────────┐          │
│  │ Backend API │   │ Local Tool   │          │
│  │ /smart-query│   │ Registry     │          │
│  │ /ticket     │   │ (Supabase)   │          │
│  │ /research   │   │              │          │
│  └─────────────┘   └──────────────┘          │
│                                               │
└──────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Registry-Refactored Local Pipeline (This Week)

**Goal:** Make adding new tools painless. One file per tool. No touching 4 files.

**Files to create/modify:**

```typescript
// services/ai/pipeline/registry.ts
const TOOL_REGISTRY: ToolDefinition[] = [];

export function registerTool(tool: ToolDefinition) {
  TOOL_REGISTRY.push(tool);
}

export function getTools() {
  return TOOL_REGISTRY;
}

export function findToolByIntent(query: string): ToolDefinition | null {
  // smart matching: keywords, embeddings, or simple scoring
  return TOOL_REGISTRY.find(tool => 
    tool.intents.some(intent => query.toLowerCase().includes(intent))
  ) || null;
}
```

```typescript
// services/ai/pipeline/tools/tickets.ts
import { registerTool } from '../registry';

registerTool({
  name: 'list_tickets',
  description: 'List open tickets for the property',
  intents: ['ticket', 'issue', 'problem', 'maintenance', 'repair'],
  parameters: { property_id: 'string' },
  handler: listTicketsTool,
  retrieval: fetchTicketContext,
});
```

```typescript
// services/ai/pipeline/tools/diesel.ts
import { registerTool } from '../registry';

registerTool({
  name: 'get_diesel_level',
  description: 'Get current diesel level and generator status',
  intents: ['diesel', 'fuel', 'generator', 'tank', 'dg'],
  parameters: { property_id: 'string' },
  handler: getDieselLogTool,
  retrieval: fetchDieselContext,
});
```

Each new feature = **one new file** in `services/ai/pipeline/tools/`. That's it.

### Phase 2: Facilities Tools (This Week)

Add one tool per day:

| Day | Tool | Data Source |
|-----|------|-------------|
| 1 | Tickets (already exists) | `tickets` table |
| 2 | Diesel | `diesel_logs`, `dg_generators` |
| 3 | Electricity | `electricity_readings` |
| 4 | Stock/Inventory | `stock_items` |
| 5 | SOPs/Checklists | `sop_templates`, `sop_completions` |
| 6 | PPM Schedules | `ppm_schedules` |
| 7 | Vendors | `vendors` |
| 8 | Escalation | `escalation_hierarchies` |
| 9 | Staff/On-call | `users`, `property_memberships` |
| 10 | Visitors | `visitor_logs` |

### Phase 3: Chat UI Polish (This Week)

Improve `CassandraSessionModal` for text-first experience:

- **Typing indicator** — show "Cassandra is thinking..." with animated dots
- **Skill chips** — quick-tap questions: "Check diesel", "Today's SOPs", "SLA risks"
- **Message history persistence** — save to AsyncStorage, survive app restarts
- **Error states** — graceful "I'm having trouble connecting" instead of crashes
- **Markdown support** — bold, lists, links in responses
- **Copy message** — long-press to copy

### Phase 4: Backend Contract Document (For Web Team)

Since we can't build the backend here, document exactly what the web team should build:

```
POST /api/v1/cassandra/chat
Request:
  {
    "message": "How much diesel is left?",
    "property_id": "...",
    "org_id": "...",
    "conversation_id": "...",
    "history": [...]
  }

Response (streaming or full):
  {
    "response": "Tank 2 is at 68% (340L). Last filled 3 days ago.",
    "tools_used": ["get_diesel_level"],
    "data": { "tank_2_percent": 68, "tank_2_liters": 340 }
  }
```

This becomes the spec for when the web team builds the backend `/chat` endpoint.

## Voice as "Creamy Layer" (Phase 5, Future)

Once chat is solid:
1. Reuse the same chat brain (local pipeline + backend)
2. Add `react-native-voice` or `expo-av` for recording
3. Send audio to backend STT (or use native speech recognition)
4. Feed transcribed text into the same chat pipeline
5. Speak the response back with TTS

**Voice is literally:** `Speech-to-Text → Chat Pipeline → Text-to-Speech`

No separate voice brain needed.

## Success Metrics

**Chat must handle these perfectly before voice touches it:**

- [ ] "How many open tickets do we have?" → exact number from Supabase
- [ ] "What's the diesel level in Generator 2?" → percentage + liters
- [ ] "Did the security team finish last night's checklist?" → SOP completion status
- [ ] "When is the next elevator PPM?" → date from `ppm_schedules`
- [ ] "Who do I call for a plumbing emergency?" → name + phone from escalation hierarchy
- [ ] "Which stock items are below reorder level?" → list from `stock_items`
- [ ] "Show me visitors checked in today" → list from `visitor_logs`
- [ ] "Why was electricity usage 20% higher yesterday?" → comparison + trend

## What We Build vs. What We Document

| Item | Build in Mobile | Document for Backend Team |
|------|-----------------|---------------------------|
| Chat UI | ✅ | ❌ |
| Tool registry pattern | ✅ | ✅ (they should copy it) |
| Tool handlers (Supabase queries) | ✅ | ✅ (they reuse these) |
| Intent matching (local) | ✅ | ❌ (backend uses LLM tool calling) |
| `/chat` endpoint | ❌ | ✅ spec |
| LLM tool calling | ❌ | ✅ spec |
| Streaming response | ❌ | ✅ spec |

## File Structure

```
saas_mobile/
services/ai/
  pipeline/
    registry.ts          ← new: tool registry
    router.ts            ← new: online/offline routing
    contextBuilder.ts    ← new: assembles Supabase context
    tools/               ← new: one file per tool
      index.ts           ← barrel export, auto-registers all
      tickets.ts
      diesel.ts
      electricity.ts
      stock.ts
      sops.ts
      ppm.ts
      vendors.ts
      escalation.ts
      staff.ts
      visitors.ts
    intents.ts           ← modified: thin wrapper around registry
    planner.ts           ← modified: thin wrapper around registry
    retrieval.ts         ← modified: uses registry
    tools.ts             ← deprecated: split into tools/ folder
stores/
  cassandraStore.ts      ← modified: chat mode flags, history persistence
components/cassandra/
  CassandraSessionModal.tsx  ← modified: text-first UI
  ChatBubble.tsx         ← new: message bubble component
  SkillChip.tsx          ← new: quick action chip
  TypingIndicator.tsx    ← new: "thinking..." animation
```

## Estimated Effort

| Phase | Days | Complexity |
|-------|------|------------|
| Registry refactor | 1 | Low |
| 10 facilities tools | 5 | Low (copy-paste pattern) |
| Chat UI polish | 2 | Medium |
| Backend contract doc | 0.5 | Low |
| **Total** | **~8 days** | **Mostly low complexity** |
