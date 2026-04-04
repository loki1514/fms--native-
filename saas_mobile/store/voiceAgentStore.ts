import { create } from 'zustand';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

interface VoiceAgentState {
  // Session state
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;

  // Content
  transcript: string;
  aiResponse: string;
  conversationHistory: ConversationMessage[];

  // Orb UI state
  orbExpanded: boolean;
  sessionActive: boolean;

  // Error
  error: string | null;

  // Actions
  setListening: (val: boolean) => void;
  setProcessing: (val: boolean) => void;
  setSpeaking: (val: boolean) => void;
  setTranscript: (text: string) => void;
  setAiResponse: (text: string) => void;
  setOrbExpanded: (val: boolean) => void;
  setSessionActive: (val: boolean) => void;
  setError: (msg: string | null) => void;
  addToHistory: (msg: ConversationMessage) => void;
  clearSession: () => void;
  reset: () => void;
}

const MAX_HISTORY = 20;

export const useVoiceAgentStore = create<VoiceAgentState>((set, get) => ({
  isListening: false,
  isProcessing: false,
  isSpeaking: false,
  transcript: '',
  aiResponse: '',
  conversationHistory: [],
  orbExpanded: false,
  sessionActive: false,
  error: null,

  setListening: (val) => set({ isListening: val }),
  setProcessing: (val) => set({ isProcessing: val }),
  setSpeaking: (val) => set({ isSpeaking: val }),
  setTranscript: (text) => set({ transcript: text }),
  setAiResponse: (text) => set({ aiResponse: text }),
  setOrbExpanded: (val) => set({ orbExpanded: val }),
  setSessionActive: (val) => set({ sessionActive: val }),
  setError: (msg) => set({ error: msg }),

  addToHistory: (msg) =>
    set((state) => ({
      conversationHistory: [
        ...state.conversationHistory.slice(-(MAX_HISTORY - 1)),
        msg,
      ],
    })),

  clearSession: () =>
    set({
      transcript: '',
      aiResponse: '',
      error: null,
    }),

  reset: () =>
    set({
      isListening: false,
      isProcessing: false,
      isSpeaking: false,
      transcript: '',
      aiResponse: '',
      orbExpanded: false,
      sessionActive: false,
      error: null,
    }),
}));
