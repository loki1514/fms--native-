# Cassandra: The Lightweight Client Architecture

> Principle: **Never build intelligence on the Expo end. Always the FastAPI end.**
> The mobile app is a dumb terminal. The backend is the brain.

---

## What "Intelligence on the Expo End" Looks Like (WRONG)

```
User: "How much diesel is left?"
  ↓
Phone runs intent.ts → sees "diesel" keyword
  ↓
Phone runs planner.ts → decides to call diesel tool
  ↓
Phone runs tools.ts → queries Supabase directly
  ↓
Phone formats response → shows to user
```

**Why this is wrong:**
- The phone has a mini-ChatGPT built into it
- Every new feature = app store update
- Keyword matching breaks on "Is the generator fuel low?" (no "diesel" keyword)
- The app bundle grows with every tool
- Debugging happens on user's phones, not your server

---

## The Correct Architecture: Phone is a Terminal

```
User: "How much diesel is left?"
  ↓
Phone: { message: "How much diesel is left?", property_id: "..." }
  ↓
         HTTP POST /api/v1/cassandra/chat
  ↓
FastAPI Backend:
  - Receives message
  - LLM reads: user wants diesel info
  - LLM calls tool: get_diesel_level(property_id)
  - Tool queries Supabase
  - LLM formats: "Tank 2 is at 68% (340L)"
  - Returns JSON response
  ↓
Phone displays: "Tank 2 is at 68% (340L)"
```

**The phone does three things:**
1. Capture input (text)
2. Send to backend
3. Render output (text bubbles)

**The backend does everything else:**
- Intent understanding (LLM)
- Tool selection (LLM)
- Database queries (Supabase)
- Response formatting (LLM)
- Memory/conversation history

---

## But What About When the Backend is Down?

The user asked: "Under what scenario does local fallback happen?"

**Answer: It doesn't.**

Chat requires internet. Period. If the backend is down:
- Show: "Cassandra is unavailable. Please check your connection."
- Or queue the message and retry
- Or show cached data with a stale timestamp

**You do NOT run a mini-LLM on the phone.**

| Scenario | Correct Behavior |
|----------|-----------------|
| Backend up | Normal chat flow |
| Backend down | Error state + retry queue |
| No internet | Offline banner + queued messages |
| Slow connection | Loading state + timeout |

---

## The Mobile App's Job (And Only Job)

```typescript
// This is ALL the intelligence in the mobile app
async function sendMessage(text: string) {
  const response = await fetch(`${API_URL}/cassandra/chat`, {
    method: 'POST',
    body: JSON.stringify({
      message: text,
      property_id: currentPropertyId,
      org_id: currentOrgId,
      conversation_id: currentConversationId,
    }),
  });
  
  const data = await response.json();
  return data.response; // Just display this
}
```

That's it. No tools. No intent matching. No Supabase queries. No LLM.

---

## What the Backend Needs to Build

### 1. Tool Registry (FastAPI)

```python
# backend/cassandra/tools/registry.py
TOOL_REGISTRY = []

def register_tool(name, description, parameters, handler):
    TOOL_REGISTRY.append({
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": parameters
        },
        "handler": handler
    })
```

### 2. One File Per Tool

```python
# backend/cassandra/tools/diesel.py
from .registry import register_tool
from supabase import Client

async def get_diesel_level(property_id: str, db: Client):
    result = db.table("diesel_logs")
        .select("*")
        .eq("property_id", property_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    return result.data[0]

register_tool(
    name="get_diesel_level",
    description="Get current diesel level and generator status for a property",
    parameters={
        "type": "object",
        "properties": {
            "property_id": {"type": "string"}
        },
        "required": ["property_id"]
    },
    handler=get_diesel_level
)
```

### 3. Chat Endpoint

```python
# backend/routers/cassandra.py
@app.post("/cassandra/chat")
async def chat(req: ChatRequest):
    # Get all registered tools
    tools = [{"type": t["type"], "function": t["function"]} 
             for t in TOOL_REGISTRY]
    
    # Send to LLM with tools
    response = await openai.chat.completions.create(
        model="gpt-4o",
        messages=build_messages(req),
        tools=tools,
        tool_choice="auto"
    )
    
    # If LLM wants to use a tool
    if response.choices[0].message.tool_calls:
        for tool_call in response.choices[0].message.tool_calls:
            tool = find_tool(tool_call.function.name)
            result = await tool["handler"](
                **json.loads(tool_call.function.arguments),
                db=supabase_client
            )
            # Feed result back to LLM for final answer
    
    return {"response": final_answer}
```

---

## What the Mobile App Actually Builds

Since the backend isn't in this repo, the mobile team's job is:

### 1. Chat UI Components

```
components/cassandra/
  CassandraChatScreen.tsx      ← main chat screen
  ChatBubble.tsx               ← user/assistant message bubble
  ChatInput.tsx                ← text input + send button
  SkillChips.tsx               ← quick action buttons
  TypingIndicator.tsx          ← "Cassandra is thinking..."
```

### 2. Chat Service (Thin API Client)

```typescript
// services/cassandra/chatService.ts
export async function sendChatMessage(
  message: string,
  propertyId: string,
  orgId: string
): Promise<ChatResponse> {
  const response = await fetchWithAuth(
    `${CASSANDRA_API_URL}/cassandra/chat`,
    {
      method: 'POST',
      body: JSON.stringify({
        message,
        property_id: propertyId,
        org_id: orgId,
        timestamp: new Date().toISOString(),
      }),
    }
  );
  return response.json();
}
```

### 3. Chat Store (Zustand)

```typescript
// stores/chatStore.ts
interface ChatStore {
  messages: Message[];
  isLoading: boolean;
  conversationId: string | null;
  sendMessage: (text: string) => Promise<void>;
}
```

### 4. No Local Pipeline. No Tools. No Intent Matching.

Delete or ignore:
- `services/ai/pipeline/tools.ts`
- `services/ai/pipeline/intent.ts`
- `services/ai/pipeline/planner.ts`
- `services/ai/pipeline/retrieval.ts`
- `services/ai/pipeline/guardrails.ts`

Keep only:
- `services/cassandra/cassandraAuthService.ts` (token exchange)
- `services/cassandra/cassandraRoomService.ts` (rooms, if needed)
- `lib/cassandra.ts` (fetchWithAuth, offline queue)

---

## The Offline Queue (Only Queue, No Processing)

When backend is down:

```typescript
// lib/cassandra.ts — already exists
async function fetchWithAuth(url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    // Don't process locally. Just queue for retry.
    await queueRequest({ url, options, timestamp: Date.now() });
    throw new ChatUnavailableError("Cassandra is offline. Message queued.");
  }
}
```

When connection returns:
```typescript
// Retry queued messages
async function flushQueue() {
  const queue = await getQueuedRequests();
  for (const req of queue) {
    await fetchWithAuth(req.url, req.options);
  }
  await clearQueue();
}
```

**No local processing. No local Supabase queries for chat.** Just queue and retry.

---

## Migration Path from Current Code

### Step 1: Stop Using Local Pipeline for Chat

In `CassandraSessionModal.tsx`, replace:
```typescript
// OLD: local pipeline
const response = await runLocalPipeline(message);
```

With:
```typescript
// NEW: backend only
const response = await sendChatMessage(message, propertyId, orgId);
```

### Step 2: Remove Local Pipeline from Chat Path

Keep the files for now (voice might use them later), but don't call them from chat.

### Step 3: Build Backend Contract

Document exactly what the FastAPI `/cassandra/chat` endpoint should do, what tools it needs, and what the request/response format is.

### Step 4: When Backend is Ready, Swap URL

Change `CASSANDRA_API_URL` from the old proxy to the new `/cassandra/chat` endpoint. Zero mobile code changes.

---

## Why This Architecture Wins

| Concern | Hybrid (Local + Backend) | Lightweight Client (This) |
|---------|-------------------------|---------------------------|
| **App bundle size** | Grows with every tool | Fixed, tiny |
| **New feature** | App store update required | Backend deploy only |
| **Intent quality** | Keyword matching (bad) | LLM tool calling (good) |
| "Is the generator fuel low?" | Fails (no "diesel" keyword) | Works (LLM understands) |
| **Debugging** | On user's phones | On your server logs |
| **Offline chat** | Broken mini-LLM gives bad answers | Honest error message |
| **Team分工** | Mobile team builds everything | Mobile = UI, Backend = brain |

---

## Summary

**The mobile app is a chat app. That's it.**

It sends text to `/cassandra/chat`.
It displays the response.
It handles loading, error, and offline states.

**The backend is Cassandra.**

It has the LLM.
It has the tool registry.
It queries Supabase.
It formats answers.
It remembers conversations.

**This is how ChatGPT works.** The iPhone app doesn't run GPT-4. It sends text to OpenAI's API and displays the response. Cassandra should work the same way.
