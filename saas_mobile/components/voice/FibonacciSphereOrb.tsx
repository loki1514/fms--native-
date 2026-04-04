'use client';
/**
 * FibonacciSphereOrb — Mesmerizing 3D particle sphere.
 * Works on web + native via react-native-svg + requestAnimationFrame loop.
 * Rotation driven by shared values (updated in rAF) — readable in worklets.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, withSpring } from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  state: 'idle' | 'listening' | 'processing' | 'speaking';
  size?: number;
}

// ---------------------------------------------------------------------------
// Pre-compute Fibonacci sphere (module-level, once)
// ---------------------------------------------------------------------------
const N = 250;
const GA = Math.PI * (3 - Math.sqrt(5));

const fib: { bx: number; by: number; bz: number; a: number; ph: number; pr: number }[] = [];
for (let i = 0; i < N; i++) {
  const t = i / N;
  const y = t * 2 - 1;
  const rad = Math.sqrt(Math.max(0, 1 - y * y));
  const th = t * N * GA;
  fib.push({
    bx: Math.cos(th) * rad,
    by: y,
    bz: Math.sin(th) * rad,
    a: 0.4 + (Math.sin(th) + 1) * 0.3,
    ph: (i % 10) * 0.3,
    pr: 0.6 + ((i * 7) % 6) * 0.1,
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function FibonacciSphereOrb({ state, size = 110 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const rad = size * 0.36;

  // Rotation shared values — updated in rAF loop, readable in worklets
  const rotX = useSharedValue(0.5);
  const rotY = useSharedValue(0);
  const scale = useSharedValue(1.0);

  // Derived animation state (for the render — drives useMemo)
  const [animState, setAnimState] = useState({ rotX: 0.5, rotY: 0, time: 0 });

  const sm =
    state === 'idle' ? 0.25 :
    state === 'processing' ? 2.5 :
    state === 'speaking' ? 1.0 : 0.6;

  // rAF loop: update shared values + trigger re-render
  useEffect(() => {
    let last = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;

      // Update shared values (for worklet access)
      rotY.value += dt * sm * 0.5;
      rotX.value += dt * sm * 0.2;

      // Trigger re-render with new state
      setAnimState(prev => ({
        rotX: prev.rotX + dt * sm * 0.2,
        rotY: prev.rotY + dt * sm * 0.5,
        time: prev.time + dt * sm,
      }));

      requestAnimationFrame(tick);
    };

    const rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [sm, rotX, rotY]);

  // Scale pulse
  useEffect(() => {
    let f = 0;
    const amp = state === 'idle' ? 0.05 : state === 'processing' ? 0.1 : 0.03;
    const id = setInterval(() => {
      f += 0.05 * (state === 'processing' ? 2 : 1);
      scale.value = 1.0 + Math.sin(f) * amp;
    }, 50);
    return () => clearInterval(id);
  }, [state, scale]);

  // Tap: random rotation (worklet writes to shared values directly)
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

  const ringOp =
    state === 'idle' ? 0.4 :
    state === 'processing' ? 0.85 :
    state === 'speaking' ? 0.7 : 0.55;

  // Compute circle positions from current animation state
  const circles = React.useMemo(() => {
    const { rotX: rx, rotY: ry, time } = animState;
    const cY = Math.cos(rx);
    const sY = Math.sin(rx);
    const cX = Math.cos(ry);
    const sX = Math.sin(ry);

    return fib.map(({ bx, by, bz, a, ph, pr }, i) => {
      const rx_y = bx * cY - bz * sY;
      const rz_y = bx * sY + bz * cY;
      const fz = by * sX + rz_y * cX;
      const persp = 3.5 / (3.5 + fz);
      const x = cx + rx_y * rad * persp;
      const yc = cy + by * rad * persp;
      const r = Math.max(0.5, pr * persp);
      const wave = Math.sin(time * 1.8 + ph) * 0.2 + 1.0;
      const o = Math.max(0.1, Math.min(1.0, a * wave * (0.55 + persp * 0.45)));
      const hue = (35 - ((time * 18 + fz * 25) % 120) + 360) % 360;
      const lit = 50 + persp * 18;
      return { key: i, x, y: yc, r, o, hue, lit };
    });
  }, [animState, cx, cy, rad]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GestureHandlerRootView style={{ width: size, height: size }}>
      <GestureDetector gesture={Gesture.Race(tap, pinch)}>
        <View style={[s.c, { width: size, height: size }]}>
          {/* Glow */}
          <View style={[s.glow, { width: size, height: size, borderRadius: size / 2 }]} />
          {/* Ring */}
          <View style={[s.ring, { width: size, height: size, borderRadius: size / 2, opacity: ringOp }]} />
          {/* Particles */}
          <Animated.View style={[s.svgLayer, { transform: [{ scale: scale.value }] }]}>
            <Svg width={size} height={size}>
              {circles.map(({ key, x, y: yc, r, o, hue, lit }) => (
                <Circle
                  key={key}
                  cx={x}
                  cy={yc}
                  r={r}
                  opacity={o}
                  fill={`hsla(${hue},88%,${lit}%,${o.toFixed(2)})`}
                />
              ))}
            </Svg>
          </Animated.View>
          {/* Inner glow */}
          <View style={[s.innerDot, { width: size * 0.22, height: size * 0.22, borderRadius: size * 0.11 }]} />
          <View style={[s.centerDot, { width: size * 0.1, height: size * 0.1, borderRadius: size * 0.05 }]} />
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  c: { justifyContent: 'center', alignItems: 'center' },
  svgLayer: { position: 'absolute' },
  glow: { position: 'absolute', shadowColor: '#ffbf48', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 24 },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(255,191,72,0.6)', borderTopColor: 'rgba(255,191,72,0.9)', borderBottomColor: 'rgba(190,74,29,0.8)' },
  innerDot: { position: 'absolute', backgroundColor: 'rgba(255,200,100,0.2)' },
  centerDot: { position: 'absolute', backgroundColor: '#ffbf48', shadowColor: '#ffbf48', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.95, shadowRadius: 12, elevation: 10 },
});
