/**
 * OpenAI Realtime API Service
 *
 * Uses Web Audio API (AudioWorklet) for native PCM capture at 24kHz,
 * streams directly to the Realtime API WebSocket.
 * Single connection handles STT + LLM + TTS — no separate REST calls.
 *
 * Docs: https://platform.openai.com/docs/guides/realtime
 */

import { createClient } from '@/utils/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type RealtimeConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'recording'
  | 'disconnected'
  | 'error';

export interface RealtimeMessage {
  type: string;
  [key: string]: unknown;
}

export interface RealtimeEventHandlers {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAudioPlaybackStart?: () => void;
  onAudioPlaybackEnd?: () => void;
  onError?: (error: string) => void;
  onStateChange?: (state: RealtimeConnectionState) => void;
}

export interface VoiceContext {
  userId: string;
  propertyId: string;
  organizationId: string;
  userRole: string;
  userName: string;
  propertyName: string;
}

// ---------------------------------------------------------------------------
// AudioWorklet processor — captures raw PCM s16le at 24kHz
// ---------------------------------------------------------------------------
const AUDIO_WORKLET_CODE = `
class MicCapture extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      if (channelData) {
        // Convert Float32 to Int16 PCM
        const pcm = new Int16Array(channelData.length);
        for (let i = 0; i < channelData.length; i++) {
          const s = Math.max(-1, Math.min(1, channelData[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        // Send raw PCM bytes to the main thread
        const buffer = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength);
        this.port.postMessage({ pcm: buffer }, [buffer]);
      }
    }
    return true;
  }
}
registerProcessor('mic-capture', MicCapture);
`;

// ---------------------------------------------------------------------------
// Session config
// ---------------------------------------------------------------------------
function buildSessionConfig(ctx: VoiceContext): object {
  return {
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      model: 'gpt-4o-realtime-preview-2025-06-03',
      instructions: buildSystemPrompt(ctx),
      voice: 'alloy',
      input_audio_transcription: {
        model: 'whisper-1',
      },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      },
      tools: buildTools(),
    },
  };
}

function buildSystemPrompt(ctx: VoiceContext): string {
  return `You are Autopilot, a friendly voice assistant for a property management mobile app.
You are speaking to ${ctx.userName}, a ${ctx.userRole} at ${ctx.propertyName}.

RULES:
- Be concise and friendly. Keep responses to 1-2 sentences max.
- When a ticket is created, say the ticket number aloud.
- Never make up data. If you don't know, say so.
- Give short, conversational answers.`;

}

function buildTools() {
  return [
    {
      type: 'function',
      name: 'create_ticket',
      description: 'Create a new maintenance ticket',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Brief title of the issue' },
          description: { type: 'string', description: 'Detailed description' },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium',
          },
        },
        required: ['title', 'description'],
      },
    },
    {
      type: 'function',
      name: 'get_ticket_status',
      description: 'Get ticket status',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string' },
          status: { type: 'string' },
          limit: { type: 'number', default: 5 },
        },
      },
    },
    {
      type: 'function',
      name: 'get_property_info',
      description: 'Get property overview stats',
      parameters: { type: 'object', properties: {} },
    },
    {
      type: 'function',
      name: 'list_meeting_rooms',
      description: 'List available meeting rooms',
      parameters: {
        type: 'object',
        properties: {
          capacity: { type: 'number' },
        },
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Main Service
// ---------------------------------------------------------------------------
export class OpenAIRealtimeService {
  private ws: WebSocket | null = null;
  private ctx: VoiceContext;
  private handlers: Required<RealtimeEventHandlers>;
  private state: RealtimeConnectionState = 'idle';
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private streamRef: MediaStream | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 2;
  private apiKey: string = '';

  constructor(ctx: VoiceContext, handlers: RealtimeEventHandlers) {
    this.ctx = ctx;
    this.handlers = {
      onTranscript: handlers.onTranscript ?? (() => {}),
      onAudioPlaybackStart: handlers.onAudioPlaybackStart ?? (() => {}),
      onAudioPlaybackEnd: handlers.onAudioPlaybackEnd ?? (() => {}),
      onError: handlers.onError ?? (() => {}),
      onStateChange: handlers.onStateChange ?? (() => {}),
    };
  }

  // ---------------------------------------------------------------------------
  // Connect
  // ---------------------------------------------------------------------------
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.setState('connecting');

    const apiKey = await this.getApiKey();
    if (!apiKey) {
      this.handlers.onError('OpenAI API key not available. Please sign in again.');
      this.setState('error');
      return;
    }
    this.apiKey = apiKey;
    console.log('[Realtime] API key loaded:', apiKey.slice(0, 10) + '...');

    const url = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2025-06-03&api_key=${encodeURIComponent(this.apiKey)}`;
    console.log('[Realtime] Connecting to:', url.replace(apiKey, '***'));

    try {
      this.ws = new WebSocket(url);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('[Realtime] WebSocket open');
        this.reconnectAttempts = 0;
        this.send(buildSessionConfig(this.ctx));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as RealtimeMessage;
          this.handleMessage(msg);
        } catch (err) {
          console.error('[Realtime] Parse error:', err);
        }
      };

      this.ws.onerror = (event) => {
        console.error('[Realtime] WebSocket error:', event.type ?? 'unknown');
        if (this.ws?.readyState === WebSocket.CONNECTING) {
          this.handlers.onError('Cannot reach OpenAI servers. Check your internet connection.');
        } else {
          this.handlers.onError('OpenAI Realtime connection error. Please try again.');
        }
        this.setState('error');
      };

      this.ws.onclose = (event) => {
        console.log('[Realtime] WebSocket closed:', event.code);
        this.stopCapture();
        this.setState('disconnected');

        if (this.reconnectAttempts < this.maxReconnectAttempts && event.code !== 1000) {
          this.reconnectAttempts++;
          console.log(`[Realtime] Reconnecting... attempt ${this.reconnectAttempts}`);
          setTimeout(() => this.connect(), 1500 * this.reconnectAttempts);
        }
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      this.handlers.onError(msg);
      this.setState('error');
    }
  }

  disconnect(): void {
    this.stopCapture();
    this.cleanup();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }
    this.setState('idle');
  }

  // ---------------------------------------------------------------------------
  // Start recording (AudioWorklet PCM capture → WebSocket)
  // ---------------------------------------------------------------------------
  async startRecording(): Promise<void> {
    if (!this.ws?.readyState || this.ws.readyState !== WebSocket.OPEN) {
      this.handlers.onError('Not connected. Tap the orb again to reconnect.');
      return;
    }

    if (this.state === 'recording') return;

    try {
      // Get mic stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.streamRef = stream;

      // Create AudioContext at 24kHz
      this.audioContext = new AudioContext({ sampleRate: 24000 });

      // Register AudioWorklet
      const blob = new Blob([AUDIO_WORKLET_CODE], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await this.audioContext.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      // Create worklet node and connect mic stream
      this.workletNode = new AudioWorkletNode(this.audioContext, 'mic-capture');

      // Receive PCM chunks and stream to WebSocket
      this.workletNode.port.onmessage = (event) => {
        const { pcm } = event.data as { pcm: ArrayBuffer };
        if (this.ws?.readyState === WebSocket.OPEN && pcm.byteLength > 0) {
          // Send as binary ArrayBuffer (not base64 — Realtime accepts raw PCM)
          this.ws.send(pcm);
        }
      };

      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination); // hear yourself

      this.setState('recording');
      console.log('[Realtime] Recording started');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to access microphone';
      this.handlers.onError(msg);
      this.setState('error');
    }
  }

  stopRecording(): void {
    this.stopCapture();
    if (this.state === 'recording') {
      this.setState('connected');
    }
  }

  private stopCapture(): void {
    if (this.workletNode) {
      try { this.workletNode.disconnect(); } catch {}
      this.workletNode = null;
    }
    if (this.streamRef) {
      this.streamRef.getTracks().forEach((t) => t.stop());
      this.streamRef = null;
    }
    if (this.audioContext) {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Text input (fallback)
  // ---------------------------------------------------------------------------
  sendTextMessage(text: string): void {
    if (!this.ws?.readyState || this.ws.readyState !== WebSocket.OPEN) {
      this.handlers.onError('Not connected. Cannot send message.');
      return;
    }
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
    this.send({ type: 'response.create' });
  }

  // ---------------------------------------------------------------------------
  // Message handler
  // ---------------------------------------------------------------------------
  private handleMessage(msg: RealtimeMessage): void {
    switch (msg.type) {
      case 'session.created':
        this.setState('connected');
        break;

      case 'session.updated':
        this.setState('connected');
        break;

      case 'error': {
        const errObj = msg.error as { message?: string; code?: string };
        console.error('[Realtime] API error:', errObj);
        const msgText = errObj?.code === 'invalid_api_key'
          ? 'Invalid OpenAI API key. Please check your settings.'
          : (errObj?.message ?? 'Realtime API error');
        this.handlers.onError(msgText);
        break;
      }

      case 'input_audio_buffer.speech_started':
        break;

      case 'input_audio_buffer.speech_stopped':
        break;

      case 'conversation.item.input_audio_transcription.completed': {
        const text = msg.transcript as string;
        if (text) this.handlers.onTranscript(text, true);
        break;
      }

      case 'response.audio_transcript.done': {
        const text = msg.transcript as string;
        if (text) this.handlers.onTranscript(text, true);
        break;
      }

      case 'response.audio.delta': {
        // The Realtime API sends audio back via binary PCM in the websocket
        // For now we rely on the built-in audio playback via the browser
        break;
      }

      case 'response.done': {
        const response = msg.response as {
          output?: Array<{ type: string; name?: string; arguments?: string; call_id?: string }>;
        };
        const toolCalls = response?.output?.filter((o) => o.type === 'function_call');
        if (toolCalls?.length) {
          const tool = toolCalls[0];
          if (tool.name && tool.arguments && tool.call_id) {
            this.executeTool(tool.name, tool.arguments, tool.call_id);
          }
        }
        break;
      }

      default:
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Tool execution
  // ---------------------------------------------------------------------------
  private async executeTool(name: string, args: string, callId: string): Promise<void> {
    try {
      let result: { success: boolean; data?: unknown; error?: string };

      switch (name) {
        case 'get_ticket_status':
        case 'get_property_info':
        case 'list_meeting_rooms':
          result = await this.executeReadTool(name, args);
          break;
        case 'create_ticket':
          result = await this.executeCreateTicket(args);
          break;
        default:
          result = { success: false, error: `Unknown tool: ${name}` };
      }

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify(result),
          },
        });
        this.send({ type: 'response.create' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Tool failed';
      this.handlers.onError(msg);
    }
  }

  private async executeReadTool(name: string, args: string): Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
  }> {
    const supabase = createClient();
    const params = JSON.parse(args);

    switch (name) {
      case 'get_ticket_status': {
        let q = supabase
          .from('tickets')
          .select('id, ticket_number, title, status, priority, created_at')
          .eq('property_id', this.ctx.propertyId)
          .eq('internal', false)
          .order('created_at', { ascending: false });
        if (params.ticket_id) q = q.eq('id', params.ticket_id).limit(1);
        else if (params.status) q = q.eq('status', params.status);
        q = q.limit(params.limit ?? 10);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return { success: true, data };
      }

      case 'get_property_info': {
        const { data, error } = await supabase
          .from('properties')
          .select('name, address')
          .eq('id', this.ctx.propertyId)
          .single();
        if (error) throw new Error(error.message);
        const { count: open } = await supabase
          .from('tickets').select('*', { count: 'exact', head: true })
          .eq('property_id', this.ctx.propertyId).eq('internal', false)
          .not('status', 'in', '(resolved,closed)');
        const { count: total } = await supabase
          .from('tickets').select('*', { count: 'exact', head: true })
          .eq('property_id', this.ctx.propertyId).eq('internal', false);
        return { success: true, data: { ...(data as Record<string, unknown>), open, total } };
      }

      case 'list_meeting_rooms': {
        let q = supabase
          .from('meeting_rooms')
          .select('id, name, capacity, floor, credits_required')
          .eq('property_id', this.ctx.propertyId).eq('is_available', true);
        if (params.capacity) q = q.gte('capacity', params.capacity);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return { success: true, data };
      }
    }

    return { success: false, error: 'Unknown tool' };
  }

  private async executeCreateTicket(args: string): Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
  }> {
    const params = JSON.parse(args) as {
      title?: string;
      description: string;
      priority?: string;
    };

    try {
      const { createTicket } = await import('@/utils/api/mobileApi');
      const result = await createTicket({
        title: params.title,
        description: params.description,
        propertyId: this.ctx.propertyId,
        organizationId: this.ctx.organizationId,
        priority: params.priority as 'low' | 'medium' | 'high' | 'critical' | undefined,
        isInternal: false,
      });

      if (result.error) return { success: false, error: result.error };

      return {
        success: true,
        data: {
          ticket_id: result.ticket?.id,
          ticket_number: result.ticket?.ticket_number,
          status: result.ticket?.status,
          classification: result.classification,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create ticket';
      return { success: false, error: msg };
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  private send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private setState(state: RealtimeConnectionState): void {
    this.state = state;
    this.handlers.onStateChange(state);
  }

  private cleanup(): void {
    this.stopCapture();
    this.ws = null;
  }

  private async getApiKey(): Promise<string> {
    // Try env var first
    const envKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (envKey) return envKey;

    // Fall back to Supabase session (for web auth scenarios)
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? '';
    } catch {
      return '';
    }
  }
}
