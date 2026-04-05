'use client';
/**
 * FibonacciSphereOrb — Mesmerizing 3D particle sphere.
 * Fully on the UI thread: useFrameCallback drives rotation via shared values,
 * useDerivedValue computes circle positions, Animated.createAnimatedComponent
 * renders via useAnimatedProps. Zero JS re-renders during animation.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useAnimatedProps,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  useFrameCallback,
  Easing,
  SharedValue,
} from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  state: 'idle' | 'listening' | 'processing' | 'speaking';
  size?: number;
}

// ---------------------------------------------------------------------------
// Pre-compute Fibonacci sphere data once at module level
// ---------------------------------------------------------------------------
const N = 250;
const GA = Math.PI * (3 - Math.sqrt(5));

const fibRaw: { bx: number; by: number; bz: number; a: number; ph: number; pr: number }[] = [];
for (let i = 0; i < N; i++) {
  const t = i / N;
  const y = t * 2 - 1;
  const rad = Math.sqrt(Math.max(0, 1 - y * y));
  const th = t * N * GA;
  fibRaw.push({
    bx: Math.cos(th) * rad,
    by: y,
    bz: Math.sin(th) * rad,
    a: 0.4 + (Math.sin(th) + 1) * 0.3,
    ph: (i % 10) * 0.3,
    pr: 0.6 + ((i * 7) % 6) * 0.1,
  });
}

// ---------------------------------------------------------------------------
// Animated SVG Circle — rendered on UI thread via useAnimatedProps
// ---------------------------------------------------------------------------
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ---------------------------------------------------------------------------
// Individual particle rendered on UI thread
// ---------------------------------------------------------------------------
function SphereParticle({
  index,
  cx,
  cy,
  rad,
  rotX,
  rotY,
  time,
}: {
  index: number;
  cx: number;
  cy: number;
  rad: number;
  rotX: SharedValue<number>;
  rotY: SharedValue<number>;
  time: SharedValue<number>;
}) {
  const d = fibRaw[index];
  const { bx, by, bz, a, ph, pr } = d;

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const rx = rotX.value;
    const ry = rotY.value;
    const t = time.value;

    const cY = Math.cos(rx);
    const sY = Math.sin(rx);
    const cX = Math.cos(ry);
    const sX = Math.sin(ry);

    const rx_y = bx * cY - bz * sY;
    const rz_y = bx * sY + bz * cY;
    const fz = by * sX + rz_y * cX;
    const persp = 3.5 / (3.5 + fz);

    const x = cx + rx_y * rad * persp;
    const yc = cy + by * rad * persp;
    const r = Math.max(0.5, pr * persp);

    const wave = Math.sin(t * 1.8 + ph) * 0.2 + 1.0;
    const o = Math.max(0.1, Math.min(1.0, a * wave * (0.55 + persp * 0.45)));
    const hue = (35 - ((t * 18 + fz * 25) % 120) + 360) % 360;
    const lit = 50 + persp * 18;

    return {
      cx: x,
      cy: yc,
      r: r,
      opacity: o,
      fill: `hsla(${hue},88%,${lit}%,${o.toFixed(2)})`,
    };
  });

  return <AnimatedCircle animatedProps={animatedProps} />;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function FibonacciSphereOrb({ state, size = 110 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const rad = size * 0.36;

  // UI-thread rotation shared values
  const rotX = useSharedValue(0.5);
  const rotY = useSharedValue(0);
  const time = useSharedValue(0);

  // Speed multiplier per state
  const sm =
    state === 'idle' ? 0.25 :
    state === 'processing' ? 2.5 :
    state === 'speaking' ? 1.0 : 0.6;

  // Drive rotation + time on the UI thread
  useFrameCallback((info) => {
    'worklet';
    const dt = (info.timeSincePreviousFrame ?? 16) / 1000;
    rotY.value += dt * sm * 0.5;
    rotX.value += dt * sm * 0.2;
    time.value += dt * sm;
  });

  // Scale pulse — pure Reanimated, no JS
  const scale = useSharedValue(1.0);
  const targetScale =
    state === 'idle' ? 1.03 :
    state === 'processing' ? 1.08 :
    state === 'speaking' ? 1.05 : 1.0;
  const pulseAmp =
    state === 'idle' ? 0.03 :
    state === 'processing' ? 0.06 : 0.02;

  React.useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(targetScale + pulseAmp, { duration: 1000 / sm, easing: Easing.inOut(Easing.sin) }),
        withTiming(targetScale - pulseAmp, { duration: 1000 / sm, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [state, sm, targetScale, pulseAmp, scale]);

  // Tap: random rotation
  const tap = Gesture.Tap().onEnd((e) => {
    'worklet';
    if (e.x > size / 2) {
      rotX.value = withSpring(0.2 + Math.random(), { damping: 12, stiffness: 80 });
      rotY.value = withSpring(Math.random() * Math.PI * 2, { damping: 12, stiffness: 80 });
    } else {
      rotX.value = withSpring(0.5, { damping: 12, stiffness: 80 });
      rotY.value = withSpring(0, { damping: 12, stiffness: 80 });
    }
  });

  // Pinch: zoom
  const pinch = Gesture.Pinch()
    .onUpdate((e) => { 'worklet'; scale.value = Math.max(0.5, Math.min(1.8, 1 / e.scale)); })
    .onEnd(() => { 'worklet'; scale.value = withSpring(1.0, { damping: 15, stiffness: 120 }); });

  // Ring opacity driven by state
  const ringOpacity = useSharedValue(
    state === 'idle' ? 0.4 :
    state === 'processing' ? 0.85 :
    state === 'speaking' ? 0.7 : 0.55
  );

  React.useEffect(() => {
    const target =
      state === 'idle' ? 0.4 :
      state === 'processing' ? 0.85 :
      state === 'speaking' ? 0.7 : 0.55;
    ringOpacity.value = withTiming(target, { duration: 300 });
  }, [state, ringOpacity]);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringAnimatedStyle = useAnimatedStyle(() => ({ opacity: ringOpacity.value }));

  const ringColor =
    state === 'speaking' ? 'rgba(190,74,29,0.8)' :
    state === 'processing' ? 'rgba(255,220,100,0.9)' :
    'rgba(255,191,72,0.6)';

  return (
    <GestureHandlerRootView style={{ width: size, height: size }}>
      <GestureDetector gesture={Gesture.Race(tap, pinch)}>
        <View style={[styles.container, { width: size, height: size }]}>
          {/* Glow */}
          <View style={[styles.glow, { width: size, height: size, borderRadius: size / 2 }]} />
          {/* Ring */}
          <Animated.View style={[
            styles.ring,
            { width: size, height: size, borderRadius: size / 2, borderColor: ringColor },
            ringAnimatedStyle
          ]} />
          {/* Particles — all UI thread */}
          <Animated.View style={[styles.svgLayer, scaleStyle]}>
            <Svg width={size} height={size}>
              {fibRaw.map((_, i) => (
                <SphereParticle
                  key={i}
                  index={i}
                  cx={cx}
                  cy={cy}
                  rad={rad}
                  rotX={rotX}
                  rotY={rotY}
                  time={time}
                />
              ))}
            </Svg>
          </Animated.View>
          {/* Inner glow */}
          <View style={[styles.innerDot, { width: size * 0.22, height: size * 0.22, borderRadius: size * 0.11 }]} />
          <View style={[styles.centerDot, { width: size * 0.1, height: size * 0.1, borderRadius: size * 0.05 }]} />
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center' as ViewStyle['justifyContent'], alignItems: 'center' as ViewStyle['alignItems'] },
  svgLayer: { position: 'absolute' as ViewStyle['position'] },
  glow: {
    position: 'absolute' as ViewStyle['position'],
    shadowColor: '#ffbf48',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 24,
  },
  ring: {
    position: 'absolute' as ViewStyle['position'],
    borderWidth: 1.5,
    borderTopColor: 'rgba(255,191,72,0.9)',
    borderBottomColor: 'rgba(190,74,29,0.8)',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  innerDot: { position: 'absolute' as ViewStyle['position'], backgroundColor: 'rgba(255,200,100,0.2)' },
  centerDot: {
    position: 'absolute' as ViewStyle['position'],
    backgroundColor: '#ffbf48',
    shadowColor: '#ffbf48',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 12,
    elevation: 10,
  },
});
