/**
 * OpenAI Native Realtime Service
 *
 * REST-based proxy for React Native (iOS/Android).
 * Routes all OpenAI calls through the backend proxy at /api/voice
 * to keep the API key server-side.
 *
 * Pipeline: expo-av recording → proxy (Whisper → GPT-4o + tools → response)
 * TTS: expo-speech
 */

import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import { supabase } from '@/utils/supabase/client';
import { VoiceContext } from './openaiService';
import { retrieveMemories, storeMemories, MemoryRetrieveInput, MemoryContext } from './supermemoryService';

export type NativeRealtimeState =
  | 'idle'
  | 'recording'
  | 'processing'
  | 'speaking'
  | 'error';

export interface NativeRealtimeEventHandlers {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAudioPlaybackStart?: () => void;
  onAudioPlaybackEnd?: () => void;
  onError?: (error: string) => void;
  onStateChange?: (state: NativeRealtimeState) => void;
  // Pipeline state events
  onThinking?: () => void;
  onSpeaking?: () => void;
}

const WEB_API_URL = process.env.EXPO_PUBLIC_WEB_API_URL ?? '';

export class OpenAINativeRealtimeService {
  private ctx: VoiceContext;
  private handlers: Required<NativeRealtimeEventHandlers>;
  private state: NativeRealtimeState = 'idle';
  private conversationHistory: { role: string; content: string }[] = [];
  private readonly maxHistory = 20;
  private pendingUri: string | null = null;
  private sessionId: string;

  constructor(ctx: VoiceContext, handlers: NativeRealtimeEventHandlers) {
    this.ctx = ctx;
    this.sessionId = ctx.sessionId ?? crypto.randomUUID();
    this.handlers = {
      onTranscript: handlers.onTranscript ?? (() => {}),
      onAudioPlaybackStart: handlers.onAudioPlaybackStart ?? (() => {}),
      onAudioPlaybackEnd: handlers.onAudioPlaybackEnd ?? (() => {}),
      onError: handlers.onError ?? (() => {}),
      onStateChange: handlers.onStateChange ?? (() => {}),
      onThinking: handlers.onThinking ?? (() => {}),
      onSpeaking: handlers.onSpeaking ?? (() => {}),
    };
  }

  private setState(state: NativeRealtimeState) {
    this.state = state;
    this.handlers.onStateChange(state);
  }

  // -------------------------------------------------------------------------
  // Connect — validate auth token
  // -------------------------------------------------------------------------
  async connect(): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        this.handlers.onError('Not authenticated. Please log in again.');
        this.setState('error');
        return;
      }
      this.setState('idle');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize voice';
      this.handlers.onError(msg);
      this.setState('error');
    }
  }

  // -------------------------------------------------------------------------
  // Start recording (handled externally by useVoiceRecording hook)
  // -------------------------------------------------------------------------
  async startRecording(): Promise<void> {
    this.pendingUri = null;
    this.setState('recording');
  }

  // -------------------------------------------------------------------------
  // Stop recording — will process after URI is provided
  // -------------------------------------------------------------------------
  async stopRecording(): Promise<void> {
    this.setState('idle');
  }

  // -------------------------------------------------------------------------
  // Provide the recorded audio URI for processing
  // -------------------------------------------------------------------------
  async setRecordingUri(uri: string): Promise<void> {
    this.pendingUri = uri;
    await this.processAudio(uri);
  }

  /**
   * Process a recorded audio file through the voice proxy.
   * Called by useVoiceAgent after stopRecording() gets the URI.
   */
  async processAudio(uri: string): Promise<void> {
    this.setState('processing');
    this.handlers.onThinking(); // → THINKING state

    try {
      // 1. Read audio file and base64-encode it
      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      // 2. Get Supabase auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        this.handlers.onError('Not authenticated. Please log in again.');
        this.setState('idle');
        return;
      }

      // 3. Determine mime type from file extension
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'm4a';
      const mimeType = ext === 'wav' ? 'audio/wav'
        : ext === 'mp3' ? 'audio/mp3'
        : ext === 'webm' ? 'audio/webm'
        : 'audio/mp4'; // m4a defaults to mp4

      // 4. Fetch memories from Supermemory directly (lowest latency — no backend hop)
      let prefetchedMemories: MemoryContext | undefined;
      const memoryInput: MemoryRetrieveInput = {
        userId: this.ctx.userId,
        organizationId: this.ctx.organizationId,
        propertyId: this.ctx.propertyId,
        sessionId: this.sessionId,
        query: '', // query will be updated with transcript if available
      };
      try {
        prefetchedMemories = await retrieveMemories(memoryInput);
      } catch (memErr) {
        // Non-fatal — backend will fall back to its own Supermemory call
        console.warn('[voice] Memory fetch failed, using backend fallback:', memErr);
      }

      // 5. Call the voice proxy with pre-fetched memories
      const response = await fetch(`${WEB_API_URL}/api/voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          audio: audioBase64,
          format: mimeType,
          context: { ...this.ctx, sessionId: this.sessionId },
          history: this.conversationHistory,
          prefetchedMemories,
        }),
      });

      if (!response.ok) {
        let errorMsg = `Voice proxy error: ${response.status}`;
        try {
          const errBody = await response.json();
          if (errBody.error) errorMsg = errBody.error;
        } catch {}
        this.handlers.onError(errorMsg);
        this.setState('idle');
        return;
      }

      const result = await response.json();

      // Handle error from proxy
      if (result.error) {
        this.handlers.onError(result.error);
        this.setState('idle');
        return;
      }

      const { transcript, response: aiResponse } = result;

      if (!transcript?.trim()) {
        this.handlers.onError('Could not understand audio. Please try again.');
        this.setState('idle');
        return;
      }

      // Add user message to history
      this.conversationHistory.push({ role: 'user', content: transcript });
      this.trimHistory();

      // Notify UI of transcript
      this.handlers.onTranscript(transcript, true);

      if (!aiResponse?.trim()) {
        this.setState('idle');
        return;
      }

      // Add assistant response to history
      this.conversationHistory.push({ role: 'assistant', content: aiResponse });
      this.trimHistory();

      // 5. Speak the response
      this.setState('speaking');
      this.handlers.onSpeaking(); // → SPEAKING state
      this.handlers.onAudioPlaybackStart();

      try {
        await Speech.speak(aiResponse, {
          language: 'en-US',
          pitch: 1.0,
          rate: 1.0,
          onDone: () => {
            this.handlers.onAudioPlaybackEnd();
            this.setState('idle');
          },
          onError: (e) => {
            this.handlers.onError(e ? String(e) : 'Speech failed');
            this.handlers.onAudioPlaybackEnd();
            this.setState('idle');
          },
        });
      } catch {
        this.handlers.onAudioPlaybackEnd();
        this.setState('idle');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Processing failed';
      this.handlers.onError(msg);
      this.setState('error');
    }
  }

  // -------------------------------------------------------------------------
  // Disconnect
  // -------------------------------------------------------------------------
  disconnect(): void {
    Speech.stop();
    this.conversationHistory = [];
    this.sessionId = crypto.randomUUID();
    this.setState('idle');
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  private trimHistory() {
    if (this.conversationHistory.length > this.maxHistory) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistory);
    }
  }
}
