'use client';
import { useCallback, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { useVoiceAgentStore } from '@/store/voiceAgentStore';
import { OpenAIRealtimeService, VoiceContext, RealtimeConnectionState } from '@/services/ai/openaiRealtimeService';

export function useVoiceAgent(config: VoiceContext) {
  const store = useVoiceAgentStore();
  const serviceRef = useRef<OpenAIRealtimeService | null>(null);

  // ---------------------------------------------------------------------------
  // Initialize Realtime service
  // ---------------------------------------------------------------------------
  const initService = useCallback(() => {
    if (serviceRef.current) return; // already initialized

    const service = new OpenAIRealtimeService(config, {
      onTranscript: (text, isFinal) => {
        if (text) {
          store.setTranscript(text);
        }
      },
      onAudioPlaybackStart: () => {
        store.setSpeaking(true);
        store.setProcessing(false);
      },
      onAudioPlaybackEnd: () => {
        store.setSpeaking(false);
        store.setProcessing(false);
        store.clearSession();
      },
      onError: (errorMsg) => {
        console.error('[useVoiceAgent] Realtime error:', errorMsg);
        store.setError(errorMsg);
        store.setProcessing(false);
        store.setListening(false);
        store.setSpeaking(false);

        // Only show alert on native (on web, the error is shown in the session sheet)
        if (Platform.OS !== 'web') {
          Alert.alert('Voice Assistant', errorMsg);
        }
      },
      onStateChange: (state: RealtimeConnectionState) => {
        console.log('[useVoiceAgent] State:', state);
        store.setSessionActive(state === 'connected' || state === 'recording');
        if (state === 'error' || state === 'idle') {
          store.setListening(false);
          store.setProcessing(false);
        }
      },
    });

    serviceRef.current = service;
  }, [config, store]);

  // ---------------------------------------------------------------------------
  // Connect — call once when user first taps the orb
  // ---------------------------------------------------------------------------
  const startSession = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Coming Soon',
        'Voice assistant is currently available on web. Native support is in development.'
      );
      return;
    }

    initService();

    const service = serviceRef.current;
    if (!service) return;

    try {
      store.setError(null);
      store.setSessionActive(true);
      await service.connect();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start session';
      store.setError(msg);
    }
  }, [initService, store]);

  // ---------------------------------------------------------------------------
  // Toggle recording
  // ---------------------------------------------------------------------------
  const toggleSession = useCallback(async () => {
    if (Platform.OS !== 'web') return;

    const service = serviceRef.current;
    if (!service) {
      await startSession();
      return;
    }

    try {
      // Get current state via store
      const currentState = store.isListening;

      if (currentState) {
        // Stop recording and process
        service.stopRecording();
        store.setListening(false);
        store.setProcessing(true);
        // The service handles sending the audio via WebSocket — no manual processing needed.
        // The transcript + audio will come back via the event handlers.
        store.setProcessing(false);
      } else {
        // Start recording
        await service.startRecording();
        store.setListening(true);
        store.setError(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Recording failed';
      store.setError(msg);
      store.setListening(false);
    }
  }, [startSession, store]);

  // ---------------------------------------------------------------------------
  // End session
  // ---------------------------------------------------------------------------
  const endSession = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
      serviceRef.current = null;
    }
    store.reset();
  }, [store]);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (serviceRef.current) {
        serviceRef.current.disconnect();
        serviceRef.current = null;
      }
    };
  }, []);

  return {
    isListening: store.isListening,
    isProcessing: store.isProcessing,
    isSpeaking: store.isSpeaking,
    sessionActive: store.sessionActive,
    transcript: store.transcript,
    aiResponse: store.aiResponse,
    error: store.error,
    startSession,
    toggleSession,
    endSession,
  };
}
