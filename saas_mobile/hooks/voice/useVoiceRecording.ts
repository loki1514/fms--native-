'use client';
import { useCallback, useRef, useState } from 'react';
import { Platform, Alert } from 'react-native';

// ---------------------------------------------------------------------------
// Voice Recording Hook
// Uses Web MediaRecorder API on web, expo-av on native
// ---------------------------------------------------------------------------

interface UseVoiceRecordingReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  recordingUri: string | null;
  permissionGranted: boolean;
  requestPermission: () => Promise<boolean>;
  error: string | null;
}

export function useVoiceRecording(): UseVoiceRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // refs to hold imperative handles
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setPermissionGranted(true);
        return true;
      } catch {
        setPermissionGranted(false);
        return false;
      }
    }
    // On native, expo-av handles permissions automatically
    setPermissionGranted(true);
    return true;
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    setError(null);

    if (Platform.OS === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        streamRef.current = stream;
        audioChunksRef.current = [];

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(100); // collect chunks every 100ms

        setIsRecording(true);
        setPermissionGranted(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start recording';
        setError(message);
        Alert.alert('Microphone Error', message);
        throw err;
      }
    } else {
      // Native: would use expo-av here
      setIsRecording(true);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (Platform.OS === 'web') {
        const recorder = mediaRecorderRef.current;
        const stream = streamRef.current;

        if (!recorder || recorder.state === 'inactive') {
          setIsRecording(false);
          resolve(null);
          return;
        }

        recorder.onstop = () => {
          // Stop all tracks
          stream?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;

          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const uri = URL.createObjectURL(blob);

          setIsRecording(false);
          setRecordingUri(uri);
          resolve(uri);
        };

        if ((recorder as MediaRecorder).state !== 'inactive') {
          recorder.stop();
        } else {
          resolve(null);
        }
      } else {
        setIsRecording(false);
        resolve(null);
      }
    });
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    recordingUri,
    permissionGranted,
    requestPermission,
    error,
  };
}
