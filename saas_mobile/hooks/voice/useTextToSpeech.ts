'use client';
import { useCallback, useRef, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { generateSpeech } from '@/services/ai/openaiService';

// ---------------------------------------------------------------------------
// Text-to-Speech Hook
// Primary: OpenAI tts-1 via fetch + Audio playback
// Fallback: Web SpeechSynthesis API
// ---------------------------------------------------------------------------

interface UseTextToSpeechReturn {
  isSpeaking: boolean;
  speak: (text: string) => Promise<void>;
  stop: () => void;
  error: string | null;
}

export function useTextToSpeech(): UseTextToSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTextRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (Platform.OS === 'web') {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      // Also stop SpeechSynthesis
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string): Promise<void> => {
    if (!text || text.trim().length === 0) return;

    setError(null);
    currentTextRef.current = text;

    // Stop any currently playing audio
    stop();

    if (Platform.OS === 'web') {
      try {
        // Try OpenAI TTS first
        const audioUrl = await generateSpeech(text);

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        setIsSpeaking(true);

        audio.onended = () => {
          setIsSpeaking(false);
          // Revoke the blob URL to free memory
          if (audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioUrl);
          }
        };

        audio.onerror = () => {
          setIsSpeaking(false);
          // Fallback to Web SpeechSynthesis
          fallbackSpeak(text);
        };

        await audio.play();
      } catch (err) {
        // Fallback to Web SpeechSynthesis API
        fallbackSpeak(text);
      }
    } else {
      // On native, just use Web SpeechSynthesis for now
      fallbackSpeak(text);
    }
  }, [stop]);

  // Fallback using Web SpeechSynthesis API
  const fallbackSpeak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setError('Speech synthesis not available');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-IN';

    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Microsoft'))
    );
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      setIsSpeaking(false);
      setError(e.error);
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  return { isSpeaking, speak, stop, error };
}

// ---------------------------------------------------------------------------
// Type declarations for Web Speech API
// ---------------------------------------------------------------------------
// Web Speech API types are available globally in browsers
// No additional global declarations needed
