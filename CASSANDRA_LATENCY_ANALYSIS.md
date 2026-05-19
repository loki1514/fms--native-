# Cassandra Latency Analysis: Local vs. Backend-Every-Query

## The Real Question

If the Expo app passes **every** query to the backend, do users feel lag? Or is it fast enough?

## Breakdown by Query Type

### Type 1: Simple Data Lookup (e.g., "How many open tickets?")

| Path | Steps | Typical Latency |
|------|-------|-----------------|
| **Local** (phone → Supabase) | Phone → Supabase edge | 150-300ms |
| **Backend** (phone → API → Supabase) | Phone → Vercel → Supabase → Vercel → Phone | 400-800ms |

**Verdict:** Backend adds ~300-500ms. Noticeable but not painful for chat. For voice, 500ms before speaking starts feels sluggish.

### Type 2: LLM-Powered Answer (e.g., "Why are so many tickets overdue?")

| Path | Steps | Typical Latency |
|------|-------|-----------------|
| **Backend** (phone → API → OpenAI → API → phone) | Phone → Vercel → OpenAI → Vercel → Phone | 1.5-3.5 seconds |
| **Local** (not possible — phone has no LLM) | N/A | N/A |

**Verdict:** You NEED the backend for LLM responses. No way around it. The OpenAI call dominates — backend vs. local is irrelevant because only the backend (or a proxy) can call OpenAI without exposing API keys.

### Type 3: Voice Streaming (WebSocket)

| Path | Behavior | Perceived Latency |
|------|----------|-------------------|
| **WebSocket** (phone ↔ backend ↔ OpenAI) | Audio streams continuously | ~200-500ms to first audio chunk, then real-time |

**Verdict:** Streaming hides latency well. User starts speaking, audio flows back as it's generated. This is the most forgiving architecture.

---

## The Hidden Cost: Vercel Cold Starts

Your web backend runs on Vercel (from `AGENTS.md`). Serverless functions have **cold starts**:

- Warm: 50-150ms
- Cold: 1-3 seconds (function wakes up, connects to DB)

If your backend `/chat` endpoint is a Vercel serverless function, the **first query after idle** feels like a 2-second hang. That's annoying for chat, acceptable for voice (user expects some setup time).

**Mitigation:** Vercel's cron jobs keep some functions warm. But ad-hoc `/chat` calls can still hit cold starts.

---

## The Honest Assessment

### "Is passing every query to the backend bearable?"

**Yes — IF you use streaming.**

- Text chat: 400-800ms for data, 1.5-3s for LLM answers. Fine for async chat. Slack/Teams feel similar.
- Voice: WebSocket streaming makes it feel real-time. The 200-500ms to first response is acceptable.

**No — IF you need offline support or instant answers.**

- Elevator breaks. No cell signal in basement. User asks Cassandra: "Who's the on-call technician?"
- With backend-only: dead. Spinner forever.
- With local fallback: instant answer from Supabase cache.

---

## The Architecture That Actually Makes Sense

Given your latency constraints and offline needs:

```
┌─────────────────────────────────────────────────────────────┐
│                    EXPO APP (Lightweight)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Voice UI   │  │  Chat UI    │  │  Local Tool Registry │  │
│  │  (orb, mic) │  │  (bubbles)  │  │  (Supabase queries)  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                    │             │
│         └────────────────┴────────────────────┘             │
│                          │                                  │
│                    ┌─────┴─────┐                           │
│                    │  Router   │  ← decides where to go    │
│                    └─────┬─────┘                           │
│              ┌───────────┼───────────┐                     │
│         Online│      Offline│     Streaming│                │
│              ↓            ↓           ↓                     │
│         ┌────────┐   ┌────────┐   ┌────────────┐           │
│         │Backend │   │Local   │   │WebSocket   │           │
│         │/chat   │   │Pipeline│   │/ws/audio   │           │
│         └────────┘   └────────┘   └────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### The Router Logic (Simple)

```typescript
async function askCassandra(question: string) {
  // Try backend first (smarter answers)
  if (navigator.onLine) {
    try {
      return await fetchBackendChat(question);  // 400ms-3s, but smarter
    } catch (e) {
      // Backend failed — fall through
    }
  }
  
  // Fallback to local pipeline (instant, offline-capable)
  return await runLocalPipeline(question);  // 50-200ms, keyword-based
}
```

---

## My Recommendation

**Don't go backend-only. Don't go local-only. Go hybrid with a smart router.**

1. **Keep the local tool registry** (what you have now, refactored to be less painful)
2. **Add a backend `/chat` endpoint** (Claude's proposal, but as an enhancement, not a replacement)
3. **Route based on question complexity:**
   - "How many open tickets?" → local (instant)
   - "Why are tickets piling up this week?" → backend (needs LLM reasoning)
   - "Who's on call?" → local (critical, must work offline)
   - Voice conversation → WebSocket streaming (feels real-time regardless)

**This gives you:**
- Fast answers for simple lookups (local)
- Smart answers for complex questions (backend)
- Offline resilience (local fallback)
- Streaming voice that feels instant (WebSocket)

**And it avoids:**
- 2-second cold starts for every question
- Dead app in basements/parking garages
- App store updates for every new tool
