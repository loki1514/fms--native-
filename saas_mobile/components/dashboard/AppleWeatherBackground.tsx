'use client';

/**
 * AppleWeatherBackground — Clean atmospheric backdrop
 * Layers:
 * 1. Sky gradient (period-aware: morning/afternoon/evening/night)
 * 2. Vignette overlay for depth
 * 3. Optional property photo as base
 * All touch events pass through (pointerEvents="none").
 * Design: Apple Weather app aesthetic — color as atmosphere.
 */

import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
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

      {/* Layer 2: Vignette for depth */}
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

  // Vignette
  vignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
  },
});
