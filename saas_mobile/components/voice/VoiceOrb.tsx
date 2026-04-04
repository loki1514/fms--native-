'use client';
import React, { useCallback } from 'react';
import { StyleSheet, Pressable, View, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { VoiceOrbAnimation } from './VoiceOrbAnimation.web';
import { useVoiceAgentStore } from '@/store/voiceAgentStore';
import { FibonacciSphereOrb } from './FibonacciSphereOrb';

interface VoiceOrbProps {
  onPress: () => void;
  disabled?: boolean;
}

export function VoiceOrb({ onPress, disabled }: VoiceOrbProps) {
  const { isListening, isProcessing, isSpeaking } = useVoiceAgentStore();

  const state = isProcessing
    ? 'processing'
    : isListening
    ? 'listening'
    : isSpeaking
    ? 'speaking'
    : 'idle';

  const handlePress = useCallback(async () => {
    if (disabled) return;
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    onPress();
  }, [disabled, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.touchArea,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      accessibilityLabel="Voice assistant"
      accessibilityRole="button"
      accessibilityHint={isListening ? 'Tap to stop recording' : 'Tap to start voice assistant'}
    >
      <View style={styles.orbWrapper}>
        {FibonacciSphereOrb ? (
          <FibonacciSphereOrb state={state} size={110} />
        ) : (
          <VoiceOrbAnimation state={state} size={110} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchArea: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  orbWrapper: {
    width: 126,
    height: 126,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
