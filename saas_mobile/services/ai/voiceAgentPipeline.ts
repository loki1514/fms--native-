'use client';
import { useVoiceAgentStore } from '@/store/voiceAgentStore';
import { transcribeAudio, chatWithVoice, VoiceContext } from '@/services/ai/openaiService';
import { useVoiceRecording } from '@/hooks/voice/useVoiceRecording';
import { useTextToSpeech } from '@/hooks/voice/useTextToSpeech';

export interface VoicePipelineConfig {
  userId: string;
  propertyId: string;
  organizationId: string;
  userRole: string;
  userName: string;
  propertyName: string;
}

export async function runVoiceSession(config: VoicePipelineConfig): Promise<void> {
  const store = useVoiceAgentStore.getState();
  const recording = useVoiceRecording();
  const tts = useTextToSpeech();

  try {
    // 1. Request microphone permission
    const granted = await recording.requestPermission();
    if (!granted) {
      store.setError('Microphone permission denied');
      return;
    }

    // 2. Start recording
    store.setListening(true);
    store.setError(null);
    await recording.startRecording();

    // 3. Wait for user to tap again (tap-to-talk)
    // In a real implementation, we'd track this via the orb press
    // For now, the caller manages the recording lifecycle

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Recording failed';
    store.setError(msg);
    store.setListening(false);
  }
}

export async function processRecording(
  recordingUri: string | null,
  config: VoicePipelineConfig
): Promise<string | null> {
  if (!recordingUri) return null;

  const store = useVoiceAgentStore.getState();
  const tts = useTextToSpeech();

  try {
    store.setListening(false);
    store.setProcessing(true);

    // 4. Transcribe via Whisper
    const transcript = await transcribeAudio(recordingUri);
    store.setTranscript(transcript);

    if (!transcript.trim()) {
      store.setAiResponse("I didn't catch that. Could you please repeat?");
      store.setProcessing(false);
      return null;
    }

    // 5. Get AI response via gpt-4o with tool calling
    const { response, pendingToolCall: _pendingToolCall } = await chatWithVoice(
      transcript,
      config,
      store.conversationHistory
    );

    store.setAiResponse(response);

    // Add to conversation history
    store.addToHistory({ role: 'user', content: transcript });
    store.addToHistory({ role: 'assistant', content: response });

    // 6. Speak the response
    store.setProcessing(false);
    store.setSpeaking(true);

    await tts.speak(response);

    store.setSpeaking(false);
    store.clearSession();

    return response;

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI processing failed';
    store.setError(msg);
    store.setProcessing(false);
    store.setListening(false);
    store.setSpeaking(false);
    return null;
  }
}
