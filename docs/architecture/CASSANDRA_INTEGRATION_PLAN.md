# Cassandra AI ↔ Expo Integration Plan

> **Date:** 2026-04-18  
> **Scope:** Wire the Expo mobile app to the Cassandra FastAPI backend  
> **Status:** Planning — backend assumed external (not in this repo)

---

## 1. Current State Assessment

### What Exists in `saas_mobile/`

| Component | Status | Notes |
|-----------|--------|-------|
| `lib/cassandra.ts` | 🟡 Stubbed | 15 REST functions defined but **not used by any screen** |
| `app/cassandra/index.tsx` | 🟡 UI Only | Orb screen, health-check on mount, no functional endpoints |
| `CassandraSessionModal.tsx` | 🔴 Disconnected | Beautiful modal but **zero API calls** — just state changes |
| `services/ai/voiceAgentPipeline.ts` | 🟡 Different Backend | Calls `EXPO_PUBLIC_VOICE_API_URL/api/voice` (Next.js proxy), **not Cassandra** |
| `hooks/voice/useVoiceAgent.ts` | 🟡 Different Backend | Web → OpenAI Realtime WS; Native → REST proxy (not Cassandra) |
| Room management | 🔴 Missing | None of the `/api/v1/properties/*/rooms/*` endpoints exist in mobile code |
| Auth token exchange | 🔴 Missing | No `/auth/session` call to get `cassandra_token` |
| WebSocket audio | 🔴 Missing | All audio is REST base64; no `ws://.../ws/audio/{org_id}` client |

### What Exists in `saas_development/` (Web)

| Component | Status |
|-----------|--------|
| `/api/voice` proxy | 🟡 Exists — routes to Whisper → LLM → TTS |
| `/api/v1/features/*` | 🔴 **Not implemented** |
| `/api/v1/rooms/*` | 🔴 **Not implemented** |
| Cassandra WebSocket | 🔴 **Not implemented** |

### Environment Variables Gap

```diff
  # saas_mobile/.env.example — CURRENT
  EXPO_PUBLIC_SUPABASE_URL=...
  EXPO_PUBLIC_SUPABASE_ANON_KEY=...
  EXPO_PUBLIC_VOICE_API_URL=...        # ← Old proxy (Next.js)
  EXPO_PUBLIC_CASSANDRA_ECAPA_URL=...

  # MISSING — needed for Cassandra backend
+ EXPO_PUBLIC_CASSANDRA_API_URL=https://cassandra-api.yourapp.com
+ EXPO_PUBLIC_CASSANDRA_WS_URL=wss://cassandra-api.yourapp.com
```

---

## 2. Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXPO MOBILE APP                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Cassandra      │  │  Voice Agent    │  │  Existing Modules           │  │
│  │  Home Screen    │  │  (useVoiceAgent)│  │  (Tickets, Visitors, etc.)  │  │
│  │  (app/cassandra)│  │  (hooks/voice)  │  │                             │  │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────────────────┘  │
│           │                    │                                            │
│  ┌────────▼────────────────────▼─────────────────────────────────────────┐  │
│  │                     cassandraService.ts                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │  Auth       │  │  Rooms      │  │  Features   │  │  Voice WS   │  │  │
│  │  │  (/auth/*)  │  │  (/rooms/*) │  │  (/features)│  │  (/ws/audio)│  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Auth Layer (NEW)                                                    │    │
│  │  • Supabase JWT → cassandra_token exchange                           │    │
│  │  • Token refresh + caching in SecureStore                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CASSANDRA FASTAPI BACKEND                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  /auth      │  │  /api/v1    │  │  /voice     │  │  /ws/audio/{org_id} │ │
│  │  /api/keys  │  │  /rooms     │  │  /query     │  │  (WebSocket)        │ │
│  │  /health    │  │  /features  │  │  /stream    │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Phases

### Phase 1: Foundation — Auth & Config (Day 1)

**Goal:** The mobile app can authenticate with Cassandra and make authenticated REST calls.

#### 3.1.1 Environment Variables
```diff
# saas_mobile/.env.example
+ EXPO_PUBLIC_CASSANDRA_API_URL=https://cassandra-api.yourapp.com
+ EXPO_PUBLIC_CASSANDRA_WS_URL=wss://cassandra-api.yourapp.com
```

#### 3.1.2 Auth Token Exchange Service
**New file:** `saas_mobile/services/cassandraAuthService.ts`

```typescript
// Flow:
// 1. Get Supabase access_token
// 2. POST /auth/session { api_key, user_jwt }
// 3. Receive cassandra_token (HS256)
// 4. Cache in SecureStore under key `cassandra_token`

export async function getCassandraToken(): Promise<string | null>
export async function exchangeSession(apiKey: string): Promise<string>
export async function refreshCassandraToken(): Promise<string>
export async function clearCassandraSession(): Promise<void>
```

#### 3.1.3 Update `lib/cassandra.ts`
- Replace `getToken()` (reads generic `jwt`) with `getCassandraToken()`
- Add auto-refresh on 401: if token expired, re-exchange and retry request
- Add `apiKey` parameter to all functions (org-level API key for `/auth/session`)

---

### Phase 2: Wire Existing Endpoints to UI (Day 1–2)

**Goal:** The Cassandra home screen and modal actually call the backend.

#### 3.2.1 Update `app/cassandra/index.tsx`
| Current | Change |
|---------|--------|
| `healthCheck()` on mount only | Also fetch `getDashboard(orgId, '7d')` — show summary cards |
| Dock buttons set `activeModal` only | Actually call endpoints: Dashboard → `getDashboard()`, Chat → open research, Team → `getOnboardingState()` |
| Connection pill shows boolean | Show latency + last health-check timestamp |

#### 3.2.2 Update `CassandraSessionModal.tsx` — CRITICAL
**This is currently a shell.** Add real integration:

```typescript
// In handleSend():
async function handleSend() {
  if (!inputText.trim()) return;
  setOrbState('processing');
  appendTranscript('🧑 ' + inputText.trim());

  try {
    const res = await smartQuery(inputText.trim(), orgId);
    setOrbState('speaking');
    appendTranscript('🔮 ' + res.response);
    // TTS playback
    await speakResponse(res.response);
  } catch (err) {
    setOrbState('error');
  }
}
```

Add **microphone integration**:
- On orb tap in listening state → capture audio via `expo-av`
- Send to `POST /voice/query/audio` (text → MP3 response)
- Or stream via WebSocket (Phase 4)

#### 3.2.3 Quick-Actions Mapping
| Dock Button | Endpoint | Screen/Modal |
|-------------|----------|--------------|
| Dashboard | `GET /analytics/dashboard` | Show KPI cards + charts |
| Chat | `POST /api/v1/features/chat/research` | Research modal with history |
| Team | `GET /onboarding/state/{orgId}` | Team list + invite flow |
| Files | `POST /export/request` + `GET /export/{id}/status` | Export history + request new |

---

### Phase 3: Room Management — New Screen Stack (Day 2–3)

**Goal:** Full room CRUD + the star `/full` endpoint.

These endpoints **do not exist** in the mobile client yet.

#### 3.3.1 New Service File: `saas_mobile/services/cassandraRoomService.ts`

```typescript
// Properties Router
export async function listRooms(propertyId: string, status?: 'waiting'|'active'|'ended')
export async function getRoomFull(propertyId: string, roomId: string) // ⭐ THE STAR ENDPOINT

// Rooms Router
export async function createRoom(propertyId: string, body: CreateRoomBody)
export async function getRoom(propertyId: string, roomId: string)
export async function patchParticipants(propertyId: string, roomId: string, body: PatchParticipantsBody)
export async function endRoom(propertyId: string, roomId: string)
export async function getAnalysis(propertyId: string, roomId: string)
export async function updateActionItem(roomId: string, itemId: string, body: UpdateActionItemBody)
export async function correctTranscript(roomId: string, transcriptId: string, body: CorrectTranscriptBody)

// Memory Router
export async function searchMemory(body: SearchMemoryBody)
```

#### 3.3.2 New Screens

```
saas_mobile/app/cassandra/rooms/
├── index.tsx              # Room list (uses listRooms)
├── [roomId].tsx           # Room detail (uses getRoomFull ⭐)
├── create.tsx             # Create room (uses createRoom)
└── _layout.tsx            # Stack navigator
```

#### 3.3.3 `/full` Response UI Mapping

The `/full` endpoint returns everything. The room detail screen should render:

```
┌─────────────────────────────────────┐
│  Room Name          [status badge]  │
│  Created: ...   Ended: ...          │
├─────────────────────────────────────┤
│  👥 Participants (count)            │
│  [avatars]                          │
├─────────────────────────────────────┤
│  📊 Analysis Status                 │
│  • Speaker map quality: 74%         │
│  • Unmatched speakers: 1            │
│  [Review Required badge]            │
├─────────────────────────────────────┤
│  📝 Enriched Transcript             │
│  [Speaker A]: Fix the HVAC...       │
│  [Speaker B]: I'll check it...      │
├─────────────────────────────────────┤
│  ✅ Action Items (3)                │
│  ☐ Fix HVAC — Open — User 123       │
│  ☐ Review budget — Open             │
│  [+ Add / Edit / Assign]            │
└─────────────────────────────────────┘
```

---

### Phase 4: Real-Time Voice via WebSocket (Day 3–5)

**Goal:** Replace REST base64 audio with WebSocket PCM16 streaming.

#### 3.4.1 Current Architecture (to be replaced)
```
Expo → record m4a → base64 → POST /api/voice → wait → JSON + MP3 → play
```

#### 3.4.2 Target Architecture
```
Expo → PCM16 chunks → WS /ws/audio/{org_id}?token=<cassandra_token>
     ← binary MP3 + JSON metadata ←
```

#### 3.4.3 New Hook: `hooks/voice/useCassandraWebSocket.ts`

```typescript
interface CassandraWebSocketOptions {
  orgId: string;
  cassandraToken: string;
  onTranscript: (segment: TranscriptSegment) => void;
  onAudioChunk: (mp3Chunk: ArrayBuffer) => void;  // stream to expo-av
  onSpeakerIdentified: (speakerId: string, userId: string) => void;
  onTicketCreated: (ticket: Ticket) => void;
  onError: (error: string) => void;
  onStateChange: (state: 'connecting'|'connected'|'recording'|'processing'|'error'|'closed') => void;
}

export function useCassandraWebSocket(options: CassandraWebSocketOptions) {
  // Manages WebSocket lifecycle
  // Handles PCM16 audio capture via expo-av (or expo-audio in SDK 54)
  // Streams chunks in 100-200ms intervals
  // Buffers incoming MP3 for playback
}
```

#### 3.4.4 Audio Pipeline on Mobile

**Challenge:** Expo SDK 54 doesn't have a built-in PCM16 recorder. Options:

| Approach | Complexity | Quality | Recommendation |
|----------|-----------|---------|----------------|
| A. `expo-av` → record m4a → decode to PCM16 in JS | Medium | Good | **Recommended for MVP** |
| B. `expo-audio` (new in SDK 54) → raw PCM | Low | Best | **Ideal if available** |
| C. Native module (Swift/Kotlin) → PCM16 buffer | High | Best | Phase 2 |

**Recommended MVP (Option A):**
1. Record with `expo-av` in high-quality AAC
2. Use `ffmpeg` (via `ffmpeg-kit-react-native`) or decode via Web Audio API on web
3. Convert to PCM16 @ 16kHz (AssemblyAI optimal)
4. Chunk into 100ms frames
5. Send via WebSocket

#### 3.4.5 Update `CassandraSessionModal.tsx`

Replace the orb press handler:
```typescript
const handleOrbPress = async () => {
  if (orbState === 'idle') {
    await ws.startRecording();
    setOrbState('listening');
  } else if (orbState === 'listening') {
    await ws.stopRecording();
    setOrbState('processing');
  }
};
```

Incoming audio: buffer MP3 chunks and play via `expo-av` `Audio.Sound` with `uri` from blob.

---

### Phase 5: Feature Router — 18 Endpoints (Day 4–5)

**Goal:** All feature endpoints callable from the mobile app.

#### 3.5.1 Extend `lib/cassandra.ts`

Add missing endpoints not yet in the mobile client:

```typescript
// ─── Checklists ────────────────────────────────────────────────────────────
export async function arProcess(imageBase64: string, checklistId: string, orgId: string)
export async function getComplianceTemplates(orgId: string)
export async function driftCheck(imageBase64: string, referenceId: string, orgId: string)
export async function photoCapture(imageBase64: string, orgId: string)
export async function voiceProcessChecklist(audioBase64: string, checklistId: string, orgId: string)

// ─── Integrations ──────────────────────────────────────────────────────────
export async function notionIntegration(pageData: any, orgId: string)

// ─── Operations ────────────────────────────────────────────────────────────
export async function queueCommand(command: string, orgId: string)

// ─── Quality ───────────────────────────────────────────────────────────────
export async function logQualityIssue(issue: any, orgId: string)
export async function getWeeklyQualityAnalysis(orgId: string)

// ─── Voice (batch commands) ────────────────────────────────────────────────
export async function batchVoiceCommand(audioText: string, orgId: string)
```

#### 3.5.2 Feature Discovery UI

Add a "Skills" or "Capabilities" screen accessible from the Cassandra home:

```
┌─────────────────────────────────────┐
│  🔮 Cassandra Skills                │
├─────────────────────────────────────┤
│  Voice Commands                     │
│  ├─ Smart Query                     │
│  ├─ Create Ticket                   │
│  ├─ Escalate                        │
│  └─ Batch Commands                  │
│                                     │
│  Checklists & Inspection            │
│  ├─ AR Process                      │
│  ├─ Drift Detection                 │
│  └─ Photo Evidence                  │
│                                     │
│  Intelligence                       │
│  ├─ Predictive Tickets              │
│  ├─ Feasibility Report              │
│  └─ OPEX Estimate                   │
│                                     │
│  Integrations                       │
│  └─ Notion Push                     │
└─────────────────────────────────────┘
```

---

### Phase 6: Polish & Edge Cases (Day 5–6)

| Task | File | Details |
|------|------|---------|
| Offline queue | `lib/cassandra.ts` | Queue requests when offline, retry with exponential backoff |
| Connection resilience | `useCassandraWebSocket.ts` | Auto-reconnect WS with jitter; heartbeat ping/pong |
| Speaker enrollment link | `app/(auth)/voice-enrollment.tsx` | Ensure enrollment embeddings sync to Cassandra backend |
| Error boundaries | `app/cassandra/` | Add `ErrorBoundary` around room screens |
| Loading skeletons | `components/cassandra/` | Skeleton for room list, transcript, action items |
| Empty states | `app/cassandra/rooms/` | "No rooms yet" with CTA to create |
| Push notifications | `services/notificationService.ts` | Notify when room analysis complete, action item assigned |
| Deep linking | `app/_layout.tsx` | `autopilot://cassandra/rooms/{roomId}` for shared room links |

---

## 4. File Change Summary

### New Files (≈ 12)
```
saas_mobile/
├── services/
│   ├── cassandraAuthService.ts      # Token exchange + cache
│   └── cassandraRoomService.ts      # All room endpoints
├── hooks/voice/
│   └── useCassandraWebSocket.ts     # WebSocket audio streaming
├── app/cassandra/
│   ├── rooms/
│   │   ├── index.tsx                # Room list
│   │   ├── [roomId].tsx             # Room detail (/full)
│   │   ├── create.tsx               # Create room
│   │   └── _layout.tsx              # Stack nav
│   └── skills.tsx                   # Feature discovery
└── components/cassandra/
    ├── RoomCard.tsx                 # Room list item
    ├── TranscriptViewer.tsx         # Enriched transcript display
    ├── ActionItemList.tsx           # Action items with edit
    ├── SpeakerMap.tsx               # Speaker identification quality
    └── RoomSkeleton.tsx             # Loading state
```

### Modified Files (≈ 8)
```
saas_mobile/
├── .env.example                     # Add CASSANDRA_API_URL, CASSANDRA_WS_URL
├── lib/cassandra.ts                 # Add missing endpoints, fix auth token source
├── app/cassandra/index.tsx          # Wire dock buttons, dashboard fetch
├── components/cassandra/
│   └── CassandraSessionModal.tsx    # Wire text + voice to real endpoints
├── hooks/voice/useVoiceAgent.ts     # Add Cassandra WS as 3rd option
├── services/ai/voiceAgentPipeline.ts# Route to Cassandra when configured
└── stores/appStore.ts               # Add room-related state
```

---

## 5. Auth Flow Detail

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐
│  Expo User  │────▶│  Supabase   │────▶│  access_token (JWT) │
└─────────────┘     └─────────────┘     └─────────────────────┘
                                                   │
                                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  POST /auth/session                                                      │
│  Headers: Authorization: Bearer <supabase_access_token>                  │
│  Body: { api_key: "org_xxx_api_key" }                                    │
│                                                                          │
│  Response: { cassandra_token: "eyJhbG...", expires_at: 1713400000 }     │
└──────────────────────────────────────────────────────────────────────────┘
                                                   │
                                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Store in SecureStore as `cassandra_token`                               │
│  Use for ALL subsequent REST + WS calls                                  │
│  Auto-refresh when 401 or expires_at < now + 5min                        │
└──────────────────────────────────────────────────────────────────────────┘
```

**Note:** The mobile app currently stores a generic `jwt` in SecureStore (the Supabase token). We should **keep both**:
- `jwt` → Supabase token (for Supabase direct queries)
- `cassandra_token` → Cassandra token (for Cassandra backend)

---

## 6. WebSocket Protocol Detail

### Connection
```
GET wss://cassandra-api.yourapp.com/ws/audio/{org_id}?token=<cassandra_token>
```

### Client → Server (audio chunk)
```json
{
  "type": "audio_chunk",
  "data": "<base64_pcm16>",
  "timestamp_ms": 1713400000000,
  "seq": 42
}
```

### Server → Client (transcript)
```json
{
  "type": "transcript",
  "speaker": "SPEAKER_0",
  "text": "The HVAC is broken in building A",
  "start_ms": 5000,
  "end_ms": 8500,
  "is_final": true
}
```

### Server → Client (ticket created)
```json
{
  "type": "ticket_created",
  "ticket": {
    "id": "tk_123",
    "title": "HVAC broken in building A",
    "status": "open",
    "confidence": 0.94
  }
}
```

### Server → Client (audio response)
```
Binary frame: MP3 chunk
```

---

## 7. Testing Checklist

### REST Endpoints
- [ ] `GET /health` returns 200 (no auth)
- [ ] `POST /auth/session` exchanges Supabase JWT for cassandra_token
- [ ] `GET /api/v1/properties/{id}/rooms` lists rooms with pagination
- [ ] `GET /api/v1/properties/{id}/rooms/{room_id}/full` returns complete room data
- [ ] `POST /api/v1/{property_id}/rooms` creates room with participants
- [ ] `POST /api/v1/{property_id}/rooms/{room_id}/end` triggers analysis
- [ ] `GET /api/v1/{property_id}/rooms/{room_id}/analysis` returns analysis results
- [ ] `POST /api/v1/memory/search` returns relevant memories
- [ ] All 18 feature endpoints return 200 with valid payloads

### WebSocket
- [ ] Connects with valid `cassandra_token`
- [ ] Rejects connection with invalid/expired token
- [ ] Sends PCM16 audio chunks without error
- [ ] Receives transcript segments in real-time
- [ ] Receives binary MP3 and plays audio
- [ ] Gracefully handles disconnect/reconnect
- [ ] End-of-room signal triggers `POST /end` equivalent

### UI
- [ ] Cassandra home shows connection status
- [ ] Orb tap starts listening, second tap stops
- [ ] Text input sends to `smartQuery` and displays response
- [ ] Room list loads with pull-to-refresh
- [ ] Room detail renders `/full` response without layout shift
- [ ] Action items are tappable to update status
- [ ] Speaker map shows confidence indicators

---

## 8. Deployment Considerations

| Concern | Recommendation |
|---------|----------------|
| **Backend URL** | Deploy Cassandra FastAPI to a public URL before mobile integration testing |
| **SSL** | WebSocket requires `wss://` in production — ensure cert is valid |
| **CORS** | FastAPI must allow `Origin` from Expo dev (`localhost:8081`) and production app |
| **Rate limiting** | Add client-side debounce (500ms) for voice queries; respect 429s |
| **Audio permissions** | Add `NSMicrophoneUsageDescription` (iOS) and `RECORD_AUDIO` (Android) |
| **Background audio** | Enable `UIBackgroundModes` audio for iOS if recording while backgrounded |
| **Bundle size** | `ffmpeg-kit-react-native` adds ~20MB — consider optional dynamic module |

---

## 9. Open Questions

1. **Where does the Cassandra backend live?** The report describes it under `cassandra/` but it doesn't exist in this repo. Is it a separate repository or should it be created here?

2. **API key source:** Where does the org-level API key come from? Is it stored in Supabase `organizations` table? Does each user get a personal key?

3. **PCM16 source:** Should we use `expo-audio` (new in SDK 54 for raw PCM) or decode AAC → PCM in JS? This affects the WebSocket timeline significantly.

4. **Meeting rooms vs Cassandra rooms:** The app already has meeting rooms (`meeting_rooms` table). Are Cassandra "rooms" the same concept or different? If different, how do we avoid user confusion?

5. **Supabase RLS:** Will Cassandra write directly to Supabase tables (tickets, visitor_logs)? If so, RLS policies must allow the service role.

---

## 10. Recommended Execution Order

```
Week 1
├── Day 1: Phase 1 (Auth + Config) + Phase 2 (Wire existing endpoints)
├── Day 2: Phase 3 (Room management screens + service)
├── Day 3: Phase 3 continued — /full endpoint UI polish
├── Day 4: Phase 4 (WebSocket scaffolding + connect/disconnect)
├── Day 5: Phase 4 continued — PCM16 audio streaming + MP3 playback
└── Day 6: Phase 5 (Feature endpoints) + Phase 6 (Polish)
```

---

*End of Plan*
