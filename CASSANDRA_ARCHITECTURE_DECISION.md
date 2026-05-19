# Cassandra Architecture Decision: Claude's Proposal vs. What We Have

## Claude's Proposal (Backend Tool Registry)

**The idea:** Move all the smarts to the backend. The mobile app becomes a "dumb phone" — it just sends your voice/text to a FastAPI server and plays back the answer. The backend has a `register_tool()` system where every new feature (diesel, stock, PPM) just calls `register_tool()` once. The LLM automatically sees all tools and decides which one to use.

**The mobile app does almost nothing:**
- Record audio → send to server
- Display text replies
- Show the animated orb

**The backend does everything:**
- Understands what you meant
- Picks the right tool
- Queries Supabase
- Formats the answer
- Speaks it back

---

## What We Actually Have Right Now

**The mobile app is "smart":**
- It has a local pipeline: `intent.ts` → `planner.ts` → `tools.ts`
- When you say "How many open tickets?", the phone itself figures out you meant `listTicketsTool`
- When the backend is down, the phone still works — it queries Supabase directly

**The backend is a "thin proxy":**
- `/api/voice` just forwards audio to OpenAI and streams back the response
- It doesn't do tool picking or Supabase queries itself

---

## The Honest Trade-Off

| Question | Claude's Way (Backend Registry) | Our Current Way (Local Pipeline) |
|----------|--------------------------------|----------------------------------|
| **Add a new feature (e.g. diesel)?** | Create 1 file on backend. Mobile app knows nothing. | Edit 4 files on mobile. App store update required. |
| **Works without internet?** | No. Dead without backend. | Yes. Falls back to local Supabase queries. |
| **Intent understanding quality** | Excellent. LLM figures it out. | Okay. Keyword matching ("diesel" → diesel tool). |
| **Build effort to get there** | High. Need to build FastAPI chat endpoint, move all tools to server, test end-to-end. | Low. Tools already exist. Just add more. |
| **Can we do it from this repo?** | Partially. The backend source is in `saas_development/` which only has build artifacts here. We'd need to work on the web app server code separately. | Yes. All the code is right here in `saas_mobile/`. |

---

## My Recommendation: Do Both, But Smartly

### Short Term (This Week): Make the Local Pipeline Work

The local pipeline already exists. Expand it. Yes, it's 4 files per feature, but:
- The patterns are copy-paste
- The phone works offline
- Zero backend dependency
- You get value **today**

**BUT** — refactor the local pipeline to use a **registry pattern** so it's not painful:

```typescript
// Instead of editing 4 files, you do this once:
registerTool({
  name: 'get_diesel_level',
  intent: ['diesel', 'fuel', 'tank', 'generator'],
  handler: getDieselLogTool,
  retrieval: fetchDieselContext,
});
```

This removes the manual wiring pain while keeping everything on the phone.

### Medium Term (Next Sprint): Backend Chat Endpoint

Build Claude's `/chat` endpoint on the **web app backend**. Then:
- Online users get LLM-powered tool picking (much smarter)
- Offline users still fall back to the local pipeline
- New features only need backend changes — mobile app auto-updates

This is the "best of both worlds" setup:
```
User asks question
    ↓
Phone tries backend /chat first (LLM picks tools intelligently)
    ↓
If backend fails → fall back to local pipeline (keyword matching)
    ↓
Either way, user gets an answer
```

---

## The Real Question

**Do you want Cassandra working for facilities ops THIS WEEK, or do you want the perfect architecture NEXT MONTH?**

- **This week** → Expand local pipeline with registry refactor
- **Next month** → Build backend `/chat` with tool registry, then migrate

My suggestion: **Do this week first.** The backend migration is cleaner when you already know which tools you need. Building the backend endpoint without knowing your tool surface is putting the cart before the horse.
