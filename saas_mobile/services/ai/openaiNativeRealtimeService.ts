/**
 * OpenAI Native Realtime Service
 *
 * Fully local pipeline on mobile — no backend hop needed.
 * Everything runs on the device: Whisper STT → GPT-4o pipeline → expo-speech TTS.
 *
 * Pipeline: expo-av recording → Whisper (direct) → voice pipeline (local) → expo-speech
 */

import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import { supabase } from '@/utils/supabase/client';
import { VoiceContext } from './openaiService';
import { runVoicePipeline } from './pipeline/voicePipeline';
import { HistoryEntry } from './pipeline/types';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';
const OPENAI_BASE = 'https://api.openai.com/v1';

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
  onThinking?: () => void;
  onSpeaking?: () => void;
}

export class OpenAINativeRealtimeService {
  private ctx: VoiceContext;
  private handlers: Required<NativeRealtimeEventHandlers>;
  private state: NativeRealtimeState = 'idle';
  private conversationHistory: HistoryEntry[] = [];
  private readonly maxHistory = 20;
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
  // Connect — validate auth
  // -------------------------------------------------------------------------
  async connect(): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        this.handlers.onError('Not authenticated. Please log in again.');
        this.setState('error');
        return;
      }
      if (!OPENAI_API_KEY) {
        this.handlers.onError('OpenAI API key not configured.');
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
    this.setState('recording');
  }

  // -------------------------------------------------------------------------
  // Stop recording
  // -------------------------------------------------------------------------
  async stopRecording(): Promise<void> {
    this.setState('idle');
  }

  // -------------------------------------------------------------------------
  // Provide the recorded audio URI for processing
  // -------------------------------------------------------------------------
  async setRecordingUri(uri: string): Promise<void> {
    await this.processAudio(uri);
  }

  // -------------------------------------------------------------------------
  // Process audio — fully local pipeline
  // -------------------------------------------------------------------------
  async processAudio(uri: string): Promise<void> {
    this.setState('processing');
    this.handlers.onThinking();

    try {
      // 1. Transcribe with Whisper (direct API call)
      const transcript = await this.transcribe(uri);
      if (!transcript.trim()) {
        this.handlers.onError('Could not understand audio. Please try again.');
        this.setState('idle');
        return;
      }

      // Add user message to history
      this.conversationHistory.push({ role: 'user', content: transcript });
      this.trimHistory();

      // Notify UI
      this.handlers.onTranscript(transcript, true);

      // 2. Run the local voice pipeline
      const result = await runVoicePipeline(
        transcript,
        { ...this.ctx, sessionId: this.sessionId },
        this.conversationHistory,
        this.sessionId
      );

      if (!result.response.trim()) {
        this.setState('idle');
        return;
      }

      // Add assistant response to history
      this.conversationHistory.push({ role: 'assistant', content: result.response });
      this.trimHistory();

      // 3. Speak the response
      this.setState('speaking');
      this.handlers.onSpeaking();
      this.handlers.onAudioPlaybackStart();

      try {
        await Speech.speak(result.response, {
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
  // Transcribe audio with Whisper (direct OpenAI API, no backend)
  // -------------------------------------------------------------------------
  private async transcribe(uri: string): Promise<string> {
    const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const audioBuffer = this.base64ToArrayBuffer(audioBase64);

    const ext = uri.split('.').pop()?.toLowerCase() ?? 'm4a';
    const mimeType = ext === 'wav' ? 'audio/wav'
      : ext === 'mp3' ? 'audio/mpeg'
      : ext === 'webm' ? 'audio/webm'
      : 'audio/mp4';

    const formData = new FormData();
    formData.append('file', {
      uri,
      name: `recording.${ext}`,
      type: mimeType,
    } as any);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const response = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Whisper error ${response.status}: ${text}`);
    }

    const data = await response.json() as { text?: string };
    return data.text ?? '';
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
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
