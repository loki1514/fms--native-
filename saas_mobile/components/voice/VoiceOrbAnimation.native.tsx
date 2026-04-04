'use client';
import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  cancelAnimation,
  useDerivedValue,
} from 'react-native-reanimated';
import { Canvas, Circle, Blur, ColorMatrix } from '@shopify/react-native-skia';

interface VoiceOrbAnimationProps {
  state: 'idle' | 'listening' | 'processing' | 'speaking';
  size?: number;
}

export function VoiceOrbAnimation({ state, size = 110 }: VoiceOrbAnimationProps) {
  const isWeb = Platform.OS === 'web';
  const time = useSharedValue(0);
  const glowOpacity = useSharedValue(0.3);
  const glowScale = useSharedValue(1);

  // Web fallback state
  const [webTime, setWebTime] = useState(0);

  useEffect(() => {
    cancelAnimation(time);
    cancelAnimation(glowOpacity);
    cancelAnimation(glowScale);

    let speed = 1;
    if (state === 'idle') speed = 0.5;
    else if (state === 'listening') speed = 2.5;
    else if (state === 'processing') speed = 4;
    else if (state === 'speaking') speed = 1.5;

    const dur = 4000 / speed;

    if (isWeb) {
      // Safe requestAnimationFrame loop for Web to prevent Skia PictureRecorder crash
      let frame: number;
      let t = webTime;
      const loop = () => {
        t += 0.05 * speed;
        setWebTime(t);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
      
      // We still animate the container style via Reanimated as that targets a standard React Native View and is completely safe
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(state === 'speaking' ? 0.8 : 0.6, { duration: dur / 2 }),
          withTiming(state === 'speaking' ? 0.4 : 0.2, { duration: dur / 2 })
        ),
        -1,
        true
      );
      glowScale.value = state === 'speaking' ? withSpring(1.1) : withRepeat(
          withSequence(
            withTiming(1.08, { duration: dur }),
            withTiming(1.0, { duration: dur })
          ),
          -1,
          true
      );

      return () => cancelAnimationFrame(frame);
    } else {
      // High-performance Native Reanimated loop
      time.value = withRepeat(
        withTiming(Math.PI * 2, { duration: dur, easing: Easing.linear }),
        -1,
        false
      );

      if (state === 'idle') {
        glowOpacity.value = withRepeat(withSequence(withTiming(0.4, { duration: dur }), withTiming(0.2, { duration: dur })), -1, true);
        glowScale.value = withRepeat(withSequence(withTiming(1.05, { duration: dur }), withTiming(1.0, { duration: dur })), -1, true);
      } else if (state === 'speaking') {
        glowOpacity.value = withRepeat(withSequence(withTiming(0.8, { duration: dur / 2 }), withTiming(0.4, { duration: dur / 2 })), -1, true);
        glowScale.value = withSpring(1.1);
      } else {
        glowOpacity.value = withRepeat(withSequence(withTiming(0.6, { duration: dur / 2 }), withTiming(0.3, { duration: dur / 2 })), -1, true);
        glowScale.value = withRepeat(withSequence(withTiming(1.08, { duration: dur }), withTiming(1.0, { duration: dur })), -1, true);
      }
    }
  }, [state]);

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size * 0.35;

  // Orbit derived values for Native
  const cx1 = useDerivedValue(() => centerX + Math.cos(time.value) * (radius * 0.5));
  const cy1 = useDerivedValue(() => centerY + Math.sin(time.value) * (radius * 0.5));
  const cx2 = useDerivedValue(() => centerX + Math.cos(time.value + Math.PI * 0.7) * (radius * 0.6));
  const cy2 = useDerivedValue(() => centerY + Math.sin(time.value + Math.PI * 0.7) * (radius * 0.6));
  const cx3 = useDerivedValue(() => centerX + Math.cos(time.value + Math.PI * 1.4) * (radius * 0.4));
  const cy3 = useDerivedValue(() => centerY + Math.sin(time.value + Math.PI * 1.4) * (radius * 0.4));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
    shadowColor: '#ff4d6d',
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value * 0.95 }],
  }));

  // Safe resolved values based on platform
  const c1x = isWeb ? centerX + Math.cos(webTime) * (radius * 0.5) : cx1;
  const c1y = isWeb ? centerY + Math.sin(webTime) * (radius * 0.5) : cy1;
  const c2x = isWeb ? centerX + Math.cos(webTime + Math.PI * 0.7) * (radius * 0.6) : cx2;
  const c2y = isWeb ? centerY + Math.sin(webTime + Math.PI * 0.7) * (radius * 0.6) : cy2;
  const c3x = isWeb ? centerX + Math.cos(webTime + Math.PI * 1.4) * (radius * 0.4) : cx3;
  const c3y = isWeb ? centerY + Math.sin(webTime + Math.PI * 1.4) * (radius * 0.4) : cy3;

  return (
    <Animated.View style={[styles.container, { width: size, height: size }, containerStyle]}>
      {/* Outer pulsing glow */}
      <Animated.View
        style={[
          styles.glowRing,
          { width: size * 0.8, height: size * 0.8, borderRadius: (size * 0.8) / 2 },
          glowStyle,
        ]}
      />

      {/* Skia Fluid Canvas */}
      <Canvas style={{ width: size, height: size }}>
        <Blur blur={12}>
          <ColorMatrix
            matrix={[
              1, 0, 0, 0, 0,
              0, 1, 0, 0, 0,
              0, 0, 1, 0, 0,
              0, 0, 0, 18, -7,
            ]}
          />
          <Circle cx={c1x} cy={c1y} r={radius} color="#ff4d6d" />
          <Circle cx={c2x} cy={c2y} r={radius * 0.85} color="#ff758f" />
          <Circle cx={c3x} cy={c3y} r={radius * 1.15} color="#ff4d6d" />
        </Blur>
      </Canvas>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowRing: {
    position: 'absolute',
    backgroundColor: '#ff4d6d',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
    elevation: 20,
    opacity: 0.4,
  },
});
