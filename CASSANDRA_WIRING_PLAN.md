# Cassandra ↔ SidekickFace Integration Plan
**Status:** Frontend Architecture — Ready for Implementation
**Backend:** Deferred (protocol contract defined, stubs in place)

---

## Executive Summary

The app has **three separate Cassandra UIs** that don't share state:

1. `SidekickFace` in `BottomNav` — always `state="idle"`, cosmetic only
2. `SidekickChat` modal — cosmetic only, `handleSend` does nothing real
3. `CassandraSessionModal` — the only one with real wiring, uses `useCassandraVoice` but uses `ParticleOrb` not `SidekickFace`

The plan unifies these into a single shared voice state, so the nav orb and the chat modal are the same system.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Shared State (Zustand store)                    │
│                                                                     │
│  {                                                              }  │
│  {  voiceState: 'idle' | 'listening' | 'speaking' | 'error'   }  │
│  {  transcript: string[]                                          }  │
│  {  lastResponse: string                                         }  │
│  {  isConnected: boolean                                         }  │
│  {  connectionError: string | null                               }  │
│  {  messageHistory: Message[]                                     }  │
│  {                                                              }  │
│  └───────────────────────────────────────────────────────────────┘  │
│         ↑                                    ↑                      │
│         │                                    │                      │
│  ┌──────┴──────┐                   ┌────────┴────────┐          │
│  │ BottomNav    │                   │ SidekickChat    │          │
│  │ SidekickFace │ ←reads voiceState │ Modal           │          │
│  │ (compact=44) │                   │ (full=140)     │          │
│  │ onPress=start │                   │ useCassandraVoice        │
│  └───────────────┘                   └────────┬────────┘          │
│                                                 │                   │
│                                           ┌─────┴──────┐            │
│                                           │ CassandraSessionModal    │
│                                           │ (ParticleOrb, TTS)     │
│                                           │ (used by /cassandra)   │
│                                           └────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Part 1 — Shared State Layer (Zustand Store)

Create a dedicated store that all three UIs read from.

**File:** `saas_mobile/stores/cassandraStore.ts` (new)

```typescript
import { create } from 'zustand';
import type { CassandraVoiceState } from '@/hooks/voice/useCassandraVoice';

export interface ChatMessage {
  id: string;
  role: 'user' | 'cassandra';
  text: string;
  timestamp: number;
}

interface CassandraStore {
  // Voice state (from useCassandraVoice)
  voiceState: CassandraVoiceState;
  setVoiceState: (s: CassandraVoiceState) => void;

  // Transcript
  transcript: string[];
  addTranscriptSegment: (text: string) => void;
  clearTranscript: () => void;

  // Last AI response text
  lastResponse: string;
  setLastResponse: (text: string) => void;

  // Chat messages
  messageHistory: ChatMessage[];
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;

  // Connection
  isConnected: boolean;
  setConnected: (v: boolean) => void;
  connectionError: string | null;
  setConnectionError: (e: string | null) => void;

  // Modal visibility
  isChatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;

  // Actions
  reset: () => void;
}

const initialState = {
  voiceState: 'idle' as CassandraVoiceState,
  transcript: [],
  lastResponse: '',
  messageHistory: [],
  isConnected: false,
  connectionError: null,
  isChatOpen: false,
};

export const useCassandraStore = create<CassandraStore>((set) => ({
  ...initialState,

  setVoiceState: (s) => set({ voiceState: s }),

  addTranscriptSegment: (text) =>
    set((st) => ({ transcript: [...st.transcript, text] })),

  clearTranscript: () => set({ transcript: [] }),

  setLastResponse: (text) => set({ lastResponse: text }),

  addMessage: (msg) =>
    set((st) => ({
      messageHistory: [
        ...st.messageHistory,
        {
          ...msg,
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
        },
      ],
    })),

  clearMessages: () => set({ messageHistory: [] }),

  setConnected: (v) => set({ isConnected: v }),

  setConnectionError: (e) => set({ connectionError: e }),

  openChat: () => set({ isChatOpen: true }),
  closeChat: () => set({ isChatOpen: false }),

  reset: () => set(initialState),
}));
```

---

## Part 2 — Fix `useCassandraVoice` Audio Streaming

**Critical bug:** Line 337 in `useCassandraVoice.ts`:
```typescript
data: '', // PCM16 base64 — filled by native file read
```
Audio is never sent. This is the single biggest blocker for the voice pipeline.

### Fix for Native (iOS/Android)

The expo-av PCM recording on iOS produces a `.pcm` file. We read it using `FileSystem.readAsStringAsync` with base64 encoding.

```typescript
// In sendChunks() — replace the empty data line:
// Read the .pcm file and base64 encode it
const uri = recordingRef.current?.getURI();
if (uri) {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    // PCM16 requires stripping the WAV header (first 44 bytes) if present
    // Most expo-av PCM recordings are raw PCM, no header
    const frame: AudioChunkFrame = {
      type: 'audio_chunk',
      data: base64,
      timestamp_ms: Date.now(),
      seq: chunkSeqRef.current++,
    };
    wsRef.current.send(JSON.stringify(frame));
  } catch {
    // Silent fail — don't block the recording
  }
}
```

**Add dependency:** `import { FileSystem } from 'expo-file-system';`

### Fix for Web

Web uses `MediaRecorder` with `audio/webm` codec. Convert chunks to base64:

```typescript
// In sendChunks() for web:
const chunks: Blob[] = [];
mediaRecorderRef.current?.ondataavailable = (e) => {
  if (e.data.size > 0) chunks.push(e.data);
};
// On stop, convert chunks to base64
const blob = new Blob(chunks, { type: 'audio/webm' });
const reader = new FileReader();
reader.onloadend = () => {
  const base64 = (reader.result as string).split(',')[1];
  wsRef.current?.send(JSON.stringify({
    type: 'audio_chunk',
    data: base64,
    timestamp_ms: Date.now(),
    seq: chunkSeqRef.current++,
  }));
};
reader.readAsDataURL(blob);
```

### Also fix `cassandraAuthService.ts` sync bug

**Bug:** `storageGet()` uses async `SecureStore.getItemAsync` synchronously.

```typescript
// Line ~15 — storageGet is sync but returns null immediately
// Fix: Use a sync cache. Write to module-level variable on set, read from it.
let tokenCache: { token: string; expiresAt: number } | null = null;

const storageSet = async (key: string, value: string) => {
  await SecureStore.setItemAsync(key, value);
  // Sync cache update
  if (key === 'cassandra_token') {
    tokenCache = JSON.parse(value);
  }
};

const storageGet = (key: string): string | null => {
  if (key === 'cassandra_token' && tokenCache) {
    return JSON.stringify(tokenCache);
  }
  // Fallback to localStorage (sync on web)
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return null; // Only happens on native if cache miss
};
```

---

## Part 3 — Wire `SidekickFace` in BottomNav to Store

In `LovableSuperAdminDashboard.tsx`, replace the static `SidekickFace`:

```tsx
// Before (cosmetic only):
<SidekickFace size={44} state="idle" compact />

// After (reads shared store):
import { useCassandraStore } from '@/stores/cassandraStore';
import { type FaceState } from '@/components/dashboard/SidekickFace';

// Inside BottomNav:
const voiceState = useCassandraStore(s => s.voiceState);
const openChat = useCassandraStore(s => s.openChat);

// Map CassandraVoiceState → FaceState
const faceState: FaceState =
  voiceState === 'recording' || voiceState === 'processing' ? 'listening' :
  voiceState === 'speaking' ? 'speaking' : 'idle';

// Nav item:
<TouchableOpacity onPress={openChat}>
  <View style={styles.orbNavContainer}>
    <SidekickFace size={44} state={faceState} compact />
  </View>
  <Text style={styles.navText}>Cassandra</Text>
</TouchableOpacity>
```

**Effect:** The nav orb now animates (pulse/scale) when Cassandra is listening or speaking, exactly matching the real voice state.

---

## Part 4 — Wire `SidekickChat` to `useCassandraVoice` + Store

`SidekickChat` currently has no real logic. Replace the stateful internals with the shared store + real API.

### Changes to `SidekickChat`

```tsx
import { useCassandraStore } from '@/stores/cassandraStore';
import { useCassandraVoice } from '@/hooks/voice/useCassandraVoice';
import { smartQuery } from '@/lib/cassandra'; // Text fallback
import { useTextToSpeech } from '@/hooks/voice/useTextToSpeech';

// Inside SidekickChat component:
const {
  voiceState,
  transcript,
  messageHistory,
  lastResponse,
  isConnected,
  connectionError,
  addMessage,
  setVoiceState,
  setLastResponse,
  setConnected,
  setConnectionError,
  closeChat,
} = useCassandraStore();

const { speak, stop: stopSpeaking } = useTextToSpeech();
const orgId = useAuth().user?.org_id ?? '';

// Wire useCassandraVoice
useCassandraVoice(orgId, {
  onStateChange: setVoiceState,
  onTranscript: (text) => {
    // User speech transcript
    if (text.trim()) addMessage({ role: 'user', text });
  },
  onAudioPlaybackStart: () => {},
  onAudioPlaybackEnd: () => {
    // After Cassandra finishes speaking, stop TTS
    stopSpeaking();
  },
  onTicketCreated: (ticketId, description) => {
    addMessage({ role: 'cassandra', text: `Ticket #${ticketId} created: ${description}` });
  },
  onError: (err) => setConnectionError(err),
});

// ─── Mic Toggle ─────────────────────────────────────────────────────────
const handleMicToggle = async () => {
  if (voiceState === 'idle' || voiceState === 'error') {
    // Start voice session
    await startSession();
  } else if (voiceState === 'recording') {
    await stopSession();
    setVoiceState('processing');
  }
};

// ─── Text Send ──────────────────────────────────────────────────────────
const handleSend = async () => {
  if (!input.trim()) return;
  const text = input.trim();
  setInput('');
  addMessage({ role: 'user', text });
  setVoiceState('processing');

  try {
    const result = await smartQuery(text, orgId);
    const response = result.response ?? result.text ?? "I'm not sure how to help with that.";
    addMessage({ role: 'cassandra', text: response });
    setLastResponse(response);
    setVoiceState('speaking');
    await speak(response);
    setVoiceState('idle');
  } catch (err) {
    const fallback = "I'm having trouble connecting right now. Try again?";
    addMessage({ role: 'cassandra', text: fallback });
    setLastResponse(fallback);
    setVoiceState('speaking');
    await speak(fallback);
    setVoiceState('idle');
  }
};

// ─── Face state derived from voice state ────────────────────────────────
const faceState: FaceState =
  voiceState === 'recording' || voiceState === 'processing' ? 'listening' :
  voiceState === 'speaking' ? 'speaking' : 'idle';
```

### Map `voiceState` → UI status

```tsx
const statusLabel =
  connectionError
    ? `Error: ${connectionError}`
    : voiceState === 'connecting'
    ? 'Connecting...'
    : voiceState === 'recording'
    ? 'Listening...'
    : voiceState === 'processing'
    ? 'Thinking...'
    : voiceState === 'speaking'
    ? 'Speaking...'
    : voiceState === 'error'
    ? 'Connection failed'
    : 'Tap face or mic to speak';

const statusDotColor =
  connectionError || voiceState === 'error' ? '#D9261C' :
  voiceState === 'idle' ? '#1FC26E' :
  '#C4A000';
```

### Status dot color

```tsx
<StatusPulseDot color={statusDotColor} />
```

---

## Part 5 — Remove `CassandraSessionModal` Duplication

`CassandraSessionModal` and `SidekickChat` both provide chat + voice. Consolidate:

- **`CassandraSessionModal`** → Keep for the full-screen experience in `app/cassandra/`
- **`SidekickChat`** → Used in dashboard modals

Both should read from the same `useCassandraStore`. Extract shared logic:

**File:** `saas_mobile/components/cassandra/CassandraInterface.tsx` (new — shared component)

```tsx
// Shared chat interface used by BOTH SidekickChat and CassandraSessionModal
// Reads from useCassandraStore, uses useCassandraVoice internally
// Props: size (compact=44 for nav, full=140 for modal), showTranscript (bool)
```

This component handles:
1. SidekickFace orb (size prop)
2. Voice session lifecycle (start/stop)
3. Text input + send
4. Message history display
5. Transcript streaming
6. TTS playback
7. Skill chips

Both `SidekickChat` and `CassandraSessionModal` become thin wrappers around `CassandraInterface`.

---

## Part 6 — Fix `SUGGESTED` Prompts (Dynamic)

Hardcoded prompts in `SidekickChat` are stale. Make them context-aware:

```tsx
// Fetch recent activity to generate relevant prompts
const RECENT_PROMPTS = [
  'Show critical tickets at {currentProperty}',
  'Open checklist items for today',
  'SLA compliance this week',
  "Who's on duty now?",
  'Energy usage yesterday',
];

// Load property-specific context
const propertyContext = usePropertyContext(propertyId);
const suggestions = RECENT_PROMPTS.map(q =>
  q.replace('{currentProperty}', propertyContext?.name ?? 'this property')
);
```

---

## Part 7 — Connect to Backend (Stub Contract)

The backend endpoints are not implemented yet. Wire the stubs so the frontend is ready:

### `lib/cassandra.ts` — Ensure all stubs return sensible errors

```typescript
// Make all API calls degrade gracefully when backend is offline
export async function smartQuery(query: string, orgId: string) {
  try {
    const res = await fetchWithAuth(`${API_URL}/api/v1/features/voice/smart-query`, {
      method: 'POST',
      body: JSON.stringify({ query, org_id: orgId }),
    });
    return await res.json();
  } catch {
    // Return a mock response when backend is offline — frontend still works
    return {
      response: "I'm running in offline mode. Connect the backend to unlock full AI capabilities.",
      source: 'fallback',
      _stub: true,
    };
  }
}
```

### WebSocket URL Configuration

```typescript
// lib/cassandra.ts
export const CASSANDRA_WS_URL =
  process.env.EXPO_PUBLIC_CASSANDRA_WS_URL ?? 'ws://localhost:8000';
export const CASSANDRA_API_URL =
  process.env.EXPO_PUBLIC_CASSANDRA_API_URL ?? 'http://localhost:8000';
```

Add to `saas_mobile/.env`:
```
EXPO_PUBLIC_CASSANDRA_API_URL=http://localhost:8000
EXPO_PUBLIC_CASSANDRA_WS_URL=ws://localhost:8000
```

---

## Part 8 — File Changes Summary

| Action | File |
|---|---|
| **Create** | `saas_mobile/stores/cassandraStore.ts` |
| **Create** | `saas_mobile/components/cassandra/CassandraInterface.tsx` |
| **Modify** | `saas_mobile/hooks/voice/useCassandraVoice.ts` — fix audio chunk sending, fix recording loop |
| **Modify** | `saas_mobile/services/cassandra/cassandraAuthService.ts` — fix sync storage bug |
| **Modify** | `saas_mobile/components/dashboard/SidekickChat.tsx` — wire to store + useCassandraVoice |
| **Modify** | `saas_mobile/components/dashboard/LovableSuperAdminDashboard.tsx` — BottomNav reads store |
| **Modify** | `saas_mobile/components/cassandra/CassandraSessionModal.tsx` — read from store |
| **Modify** | `saas_mobile/lib/cassandra.ts` — add graceful fallback to all API calls |
| **Modify** | `saas_mobile/.env.example` — add `EXPO_PUBLIC_CASSANDRA_API_URL` + `EXPO_PUBLIC_CASSANDRA_WS_URL` |

---

## Part 9 — Implementation Order

### Step 1: Store + BottomNav (Same session, ~30min)
1. Create `stores/cassandraStore.ts`
2. Modify `LovableSuperAdminDashboard.tsx` — BottomNav `SidekickFace` reads `voiceState` from store, `onPress` calls `openChat()`
3. Verify: Nav orb reflects state when `voiceState` changes

### Step 2: Wire `SidekickChat` (Same session, ~1hr)
4. Create `components/cassandra/CassandraInterface.tsx` — shared component
5. Modify `SidekickChat.tsx` — delegate to `CassandraInterface`, wire `useCassandraVoice`
6. Add `EXPO_PUBLIC_CASSANDRA_API_URL` and `EXPO_PUBLIC_CASSANDRA_WS_URL` to `.env.example`
7. Verify: Mic button starts recording, tap face opens chat, messages appear

### Step 3: Audio Streaming Fix (Separate session, ~1hr)
8. Fix `useCassandraVoice.ts` — implement actual PCM base64 reading via `FileSystem`
9. Fix `cassandraAuthService.ts` sync bug
10. Add Web `MediaRecorder` chunk sending
11. Verify on device: audio actually streams to backend

### Step 4: Consolidate + Polish (Same session, ~30min)
12. Refactor `CassandraSessionModal` to use shared store
13. Add graceful offline fallback to all `lib/cassandra.ts` API calls
14. Add dynamic suggested prompts from property context

---

## Backend Contract (for when backend is built)

The `useCassandraVoice` hook implements V2 protocol. Backend must support:

### REST Auth
```
POST /auth/session
Body: { supabase_token: string }
Response: { cassandra_token: string, expires_at: ISO8601 }
```

### WebSocket
```
WSS /ws/audio/{orgId}

Client → Server:
{ type: 'session_start', cassandra_token: string, room_id?: string }
{ type: 'audio_chunk', data: base64_pcm16, timestamp_ms: number, seq: number }
{ type: 'ping' }

Server → Client:
{ type: 'session_acknowledged' }
{ type: 'segment', text: string, speaker_id: string }
{ type: 'pipeline_result', text: string }
{ type: 'voice_response', text: string }
{ type: 'ticket_created', ticket_id: string, description: string }
{ type: 'pong' }
{ type: 'error', message: string }
{ type: 'rate_limited', retry_after_ms: number }
```

### REST API
```
POST /api/v1/features/voice/smart-query
POST /api/v1/features/voice/ticket
POST /api/v1/features/chat/research
GET  /health
```

All return `{ response: string, source?: string }` or appropriate types.

---

## Testing Checklist

- [ ] Nav `SidekickFace` animates when voice session active (listening → orb pulse, speaking → orb breathe)
- [ ] Tapping nav orb opens `SidekickChat` modal
- [ ] Mic button in chat starts/stops recording (native)
- [ ] Audio chunks are sent via WebSocket (check WS frame inspector)
- [ ] AI transcript appears in chat
- [ ] TTS speaks AI response
- [ ] Message history persists across open/close
- [ ] Offline: text fallback works with mock response
- [ ] Multiple rapid taps: debounced (no double sessions)
- [ ] App backgrounded during recording: session preserved
