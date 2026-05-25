'use client';
/**
 * cassandraStore — Shared Zustand store for all Cassandra UI components
 *
 * Single source of truth for:
 *  - Voice session state (idle → connecting → recording → processing → speaking → idle)
 *  - Transcript + message history
 *  - Connection status
 *  - Modal visibility
 *
 * All three Cassandra UIs read from this:
 *  1. SidekickFace in BottomNav   (compact=44, reads voiceState)
 *  2. SidekickChat modal          (full=140, text+voice interaction)
 *  3. CassandraSessionModal      (full=140, skills+voice interaction)
 */

import { create } from 'zustand';
import type { CassandraVoiceState } from '@/hooks/voice/useCassandraVoice';

export interface ChatMessage {
  id: string;
  role: 'user' | 'cassandra';
  text: string;
  timestamp: number;
  variant?: 'default' | 'tool_call' | 'blocked';
  toolData?: { ticketId?: string; ticketNumber?: string; description?: string; status?: string };
  blockedReason?: string;
}

export interface SuggestedPrompt {
  id: string;
  text: string;
  context?: string; // e.g., "critical_tickets", "energy", "checklist"
}

interface CassandraStore {
  // ── Voice state (driven by useCassandraVoice) ────────────────────────────
  voiceState: CassandraVoiceState;
  setVoiceState: (s: CassandraVoiceState) => void;

  // ── Transcript (streaming) ─────────────────────────────────────────────
  transcript: string[];
  addTranscriptSegment: (text: string, speakerId?: string) => void;
  clearTranscript: () => void;

  // ── Message history (persistent chat) ─────────────────────────────────
  messageHistory: ChatMessage[];
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;

  // ── Last AI response (for TTS) ────────────────────────────────────────
  lastResponse: string;
  setLastResponse: (text: string) => void;

  // ── Connection ────────────────────────────────────────────────────────
  isConnected: boolean;
  setConnected: (v: boolean) => void;
  connectionError: string | null;
  setConnectionError: (e: string | null) => void;

  // ── Modal visibility ──────────────────────────────────────────────────
  isChatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;

  // ── Pending query (user typed but not yet sent) ────────────────────────
  pendingQuery: string;
  setPendingQuery: (q: string) => void;

  // ── Suggested prompts (dynamic from property context) ─────────────────
  suggestedPrompts: SuggestedPrompt[];
  setSuggestedPrompts: (prompts: SuggestedPrompt[]) => void;

  // ── Property scope (multi-property users) ─────────────────────────────
  // Encodes which property Cassandra should scope replies to:
  //   null      → query across ALL accessible properties
  //   string    → scope to that property uuid
  //   undefined → use JWT property_id fallback (no toggle / first render)
  // Maps 1:1 to StreamChatOptions.propertyId.
  selectedPropertyId: string | null | undefined;
  setSelectedPropertyId: (id: string | null | undefined) => void;

  // ── Thinking status (backend reasoning states) ──────────────────────────
  // Shows "Cassandra is thinking…" messages before tokens arrive.
  // Set when SSE emits [THINKING]..., cleared when first token yields.
  thinkingStatus: string | null;
  setThinkingStatus: (text: string | null) => void;

  // ── Reset (on sign-out or component unmount) ──────────────────────────
  reset: () => void;
}

const initialState = {
  voiceState: 'idle' as CassandraVoiceState,
  transcript: [],
  messageHistory: [] as ChatMessage[],
  lastResponse: '',
  isConnected: false,
  connectionError: null as string | null,
  isChatOpen: false,
  pendingQuery: '',
  suggestedPrompts: [
    { id: '1', text: 'Show critical tickets at this property' },
    { id: '2', text: 'Energy spike yesterday — why?' },
    { id: '3', text: 'Open checklist items for today' },
    { id: '4', text: "Who's on call right now?" },
    { id: '5', text: 'Compare health across properties' },
  ] as SuggestedPrompt[],
  selectedPropertyId: undefined as string | null | undefined,
  thinkingStatus: null as string | null,
};

export const useCassandraStore = create<CassandraStore>((set, _get) => ({
  ...initialState,

  // ── Voice ────────────────────────────────────────────────────────────
  setVoiceState: (s) => set({ voiceState: s }),

  // ── Transcript ──────────────────────────────────────────────────────
  addTranscriptSegment: (text, speakerId) =>
    set((st) => ({
      transcript: [...st.transcript, speakerId ? `[${speakerId}] ${text}` : text],
    })),

  clearTranscript: () => set({ transcript: [] }),

  // ── Message history ──────────────────────────────────────────────────
  addMessage: (msg) =>
    set((st) => ({
      messageHistory: [
        ...st.messageHistory,
        { ...msg, id: `${Date.now()}-${Math.random()}`, timestamp: Date.now() },
      ],
    })),

  clearMessages: () => set({ messageHistory: [] }),

  // ── Last response ───────────────────────────────────────────────────
  setLastResponse: (text) => set({ lastResponse: text }),

  // ── Connection ───────────────────────────────────────────────────────
  setConnected: (v) => set({ isConnected: v }),
  setConnectionError: (e) => set({ connectionError: e }),

  // ── Modal ───────────────────────────────────────────────────────────
  openChat: () => set({ isChatOpen: true }),
  closeChat: () => set({ isChatOpen: false }),

  // ── Pending query ────────────────────────────────────────────────────
  setPendingQuery: (q) => set({ pendingQuery: q }),

  // ── Suggested prompts ─────────────────────────────────────────────────
  setSuggestedPrompts: (prompts) => set({ suggestedPrompts: prompts }),

  // ── Property scope ────────────────────────────────────────────────────
  setSelectedPropertyId: (id) => set({ selectedPropertyId: id }),

  // ── Thinking status ───────────────────────────────────────────────────
  setThinkingStatus: (text) => set({ thinkingStatus: text }),

  // ── Reset ───────────────────────────────────────────────────────────
  reset: () => {
    set(initialState);
  },
}));
