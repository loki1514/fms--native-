'use client';

/**
 * AppleWeatherBackground — Atmospheric weather backdrop for Super Admin dashboard
 *
 * Layers:
 * 1. Sky gradient (period-aware: morning/afternoon/evening/night)
 * 2. Animated cloud layer (parallax, subtle drift)
 * 3. Vignette overlay for depth
 * 4. Optional property photo as base
 *
 * All touch events pass through (pointerEvents="none").
 * Design: Apple Weather app aesthetic — color as atmosphere.
 * Glass: minimal opacity, no blur — glass at 6% bg / 12% border max.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Image, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useWeather, WeatherPeriod } from '@/hooks/useWeather';

// ---- Period → Sky Gradients ----
interface SkyPalette {
  top: string;
  mid: string;
  bottom: string;
}

const SKY_PALETTES: Record<WeatherPeriod, SkyPalette> = {
  morning: { top: '#1a1a3e', mid: '#2d1b4e', bottom: '#f4845f' },
  afternoon: { top: '#0f1628', mid: '#1e3a5f', bottom: '#4a90c4' },
  evening: { top: '#0a0a1a', mid: '#1a0a2e', bottom: '#6b2d5b' },
  night: { top: '#03030a', mid: '#060618', bottom: '#0a0a25' },
};

// ---- Cloud Config ----
interface CloudConfig {
  id: number;
  yPct: number;
  width: number;
  height: number;
  speedSec: number;
  startDelayMs: number;
  opacity: number;
  startX: number;
  endX: number;
}

const CLOUD_CONFIGS: CloudConfig[] = [
  { id: 0, yPct: 8,  width: 220, height: 80,  speedSec: 28, startDelayMs: 0,    opacity: 0.55, startX: -220,  endX: 430 },
  { id: 1, yPct: 18, width: 150, height: 60,  speedSec: 35, startDelayMs: 5000,  opacity: 0.40, startX: 430,   endX: -150 },
  { id: 2, yPct: 5,  width: 190, height: 70,  speedSec: 40, startDelayMs: 12000, opacity: 0.30, startX: -190,  endX: 430 },
  { id: 3, yPct: 25, width: 130, height: 50,  speedSec: 22, startDelayMs: 8000,  opacity: 0.50, startX: 430,   endX: -130 },
  { id: 4, yPct: 12, width: 170, height: 65,  speedSec: 32, startDelayMs: 2000,  opacity: 0.45, startX: -170,  endX: 430 },
];

const { width: SCREEN_W } = Dimensions.get('window');

// ---- Single Cloud ----
function CloudBlob({ config }: { config: CloudConfig }) {
  const translateX = useSharedValue(config.startX);

  useEffect(() => {
    const timeout = setTimeout(() => {
      translateX.value = withRepeat(
        withSequence(
          withTiming(config.endX, { duration: config.speedSec * 1000, easing: Easing.linear }),
          withTiming(config.startX, { duration: 0 })
        ),
        -1,
        false
      );
    }, config.startDelayMs);

    return () => clearTimeout(timeout);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <Animated.View
      style={[
        styles.cloud,
        { top: `${config.yPct}%`, width: config.width, height: config.height, opacity: config.opacity },
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      {/* Soft cloud made of overlapping ellipses */}
      <View style={[styles.blob, { width: config.width * 0.30, height: config.height * 0.65, top: config.height * 0.20, left: config.width * 0.05 }]} />
      <View style={[styles.blob, { width: config.width * 0.38, height: config.height * 0.85, top: config.height * 0.05, left: config.width * 0.22 }]} />
      <View style={[styles.blob, { width: config.width * 0.32, height: config.height * 0.70, top: config.height * 0.15, left: config.width * 0.52 }]} />
      <View style={[styles.blob, { width: config.width * 0.25, height: config.height * 0.55, top: config.height * 0.25, left: config.width * 0.72 }]} />
    </Animated.View>
  );
}

// ---- Main Component ----
interface AppleWeatherBackgroundProps {
  /** Property photo URL as base layer */
  photoUrl?: string | null;
  /** Override the period (e.g. for property detail view) */
  periodOverride?: WeatherPeriod;
  /** Dark overlay opacity over photo */
  photoOverlayOpacity?: number;
}

export default function AppleWeatherBackground({
  photoUrl,
  periodOverride,
  photoOverlayOpacity = 0.40,
}: AppleWeatherBackgroundProps) {
  const { weather } = useWeather();
  const period = periodOverride ?? weather?.period ?? 'afternoon';
  const sky = SKY_PALETTES[period];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Layer 1: Photo OR sky gradient */}
      {photoUrl ? (
        <View style={styles.photoLayer}>
          <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
          <View style={[styles.photoOverlay, { opacity: photoOverlayOpacity }]} />
        </View>
      ) : (
        <View style={styles.skyLayer}>
          <View style={[styles.skyTop, { backgroundColor: sky.top }]} />
          <View style={[styles.skyMid, { backgroundColor: sky.mid }]} />
          <View style={[styles.skyBottom, { backgroundColor: sky.bottom }]} />
        </View>
      )}

      {/* Layer 2: Animated clouds */}
      {CLOUD_CONFIGS.map((cfg) => (
        <CloudBlob key={cfg.id} config={cfg} />
      ))}

      {/* Layer 3: Vignette for depth */}
      <View style={styles.vignette} />
    </View>
  );
}

// ---- Styles ----
const styles = StyleSheet.create({
  // Sky gradient
  skyLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  skyTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%' },
  skyMid: { position: 'absolute', top: '28%', left: 0, right: 0, height: '42%', opacity: 0.65 },
  skyBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '48%', opacity: 0.55 },

  // Photo base
  photoLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  photo: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  photoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },

  // Clouds
  cloud: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
  blob: { position: 'absolute', borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.88)' },

  // Vignette
  vignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
  },
});
