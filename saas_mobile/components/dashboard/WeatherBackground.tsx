import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import PremiumSun from './PremiumSun';

export type WeatherCondition = 'clear-day' | 'clear-night' | 'cloudy-day' | 'cloudy-night' | 'rainy' | 'dawn' | 'dusk';

interface WeatherBackgroundProps {
  condition: WeatherCondition;
}

const ASSETS = {
  MOON: { uri: 'https://pngimg.com/uploads/moon/moon_PNG52.png' },
  CLOUD: { uri: 'https://pngimg.com/uploads/cloud/cloud_PNG4.png' },
};

const THEMES: Record<WeatherCondition, { colors: [string, string, string]; celestial: 'SUN' | 'MOON' | null; overlayCloud: boolean; showStars: boolean }> = {
  'clear-day': {
    colors: ['#4A8FD4', '#6BAEE8', '#A8D4F5'],
    celestial: 'SUN',
    overlayCloud: false,
    showStars: false,
  },
  'clear-night': {
    colors: ['#0A1628', '#122440', '#1E3A5F'],
    celestial: 'MOON',
    overlayCloud: false,
    showStars: true,
  },
  'cloudy-day': {
    colors: ['#5A7A96', '#7A9AB6', '#9ABAD6'],
    celestial: null,
    overlayCloud: true,
    showStars: false,
  },
  'cloudy-night': {
    colors: ['#0D1A2A', '#1A2E42', '#2A4460'],
    celestial: 'MOON',
    overlayCloud: true,
    showStars: true,
  },
  'rainy': {
    colors: ['#0D1B2A', '#1A2E42', '#2A4A66'],
    celestial: null,
    overlayCloud: true,
    showStars: false,
  },
  'dawn': {
    colors: ['#3A6FA0', '#5A9AD0', '#8AC4F0'],
    celestial: 'SUN',
    overlayCloud: false,
    showStars: false,
  },
  'dusk': {
    colors: ['#2A5A8A', '#4A8AC0', '#7AB8E8'],
    celestial: 'SUN',
    overlayCloud: false,
    showStars: false,
  },
};

const { width, height: SCREEN_H } = Dimensions.get('window');

function StarField() {
  const stars = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * width,
      y: Math.random() * (SCREEN_H * 0.7),
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.6 + 0.2,
    }));
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((s) => (
        <View
          key={s.id}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: '#FFFFFF',
            opacity: s.opacity,
          }}
        />
      ))}
    </View>
  );
}

function SunBeams() {
  const beams = useMemo(() => {
    return Array.from({ length: 6 }).map((_, i) => ({
      id: i,
      rotation: i * 60 + 15,
      opacity: Math.random() * 0.1 + 0.05,
    }));
  }, []);

  return (
    <View style={[styles.celestialObject, styles.sunPosition, { transform: [{ scale: 2.5 }] }]} pointerEvents="none">
      {beams.map((b) => (
        <LinearGradient
          key={b.id}
          colors={['rgba(255,255,255,0.4)', 'transparent']}
          style={{
            position: 'absolute',
            width: 2,
            height: 1000,
            left: 125,
            top: 125,
            opacity: b.opacity,
            transform: [{ rotate: `${b.rotation}deg` }, { translateY: -500 }],
          }}
        />
      ))}
    </View>
  );
}

function DustMotes() {
  const motes = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      x: Math.random() * width,
      y: Math.random() * SCREEN_H,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.3 + 0.1,
    }));
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {motes.map((m) => (
        <View
          key={m.id}
          style={{
            position: 'absolute',
            left: m.x,
            top: m.y,
            width: m.size,
            height: m.size,
            borderRadius: m.size / 2,
            backgroundColor: '#FFF',
            opacity: m.opacity,
          }}
        />
      ))}
    </View>
  );
}

function RainEffect() {
  const streaks = useMemo(() => {
    return Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      x: Math.random() * width,
      y: Math.random() * SCREEN_H,
      length: Math.random() * 20 + 10,
      opacity: Math.random() * 0.2 + 0.05,
    }));
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {streaks.map((s) => (
        <View
          key={s.id}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: 1,
            height: s.length,
            backgroundColor: '#FFFFFF',
            opacity: s.opacity,
            transform: [{ rotate: '15deg' }],
          }}
        />
      ))}
    </View>
  );
}

export default function WeatherBackground({ condition }: WeatherBackgroundProps) {
  const theme = THEMES[condition] || THEMES['clear-day'];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Animated.View key={condition} entering={FadeIn.duration(1200)} style={StyleSheet.absoluteFillObject}>
        <LinearGradient
          colors={theme.colors}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
        />
        
        {/* Misty/Foggy overlay for rainy condition */}
        {condition === 'rainy' && (
          <LinearGradient
            colors={['rgba(255,255,255,0.03)', 'transparent', 'rgba(0,0,0,0.2)']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
          />
        )}

        {theme.showStars && <StarField />}
        {condition === 'clear-day' && <DustMotes />}
        {condition === 'clear-day' && <SunBeams />}
        {condition === 'rainy' && <RainEffect />}

        {theme.celestial === 'SUN' && (
          <View style={[styles.celestialObject, styles.sunPosition]} pointerEvents="none">
            <PremiumSun size={220} />
          </View>
        )}
        {theme.celestial === 'MOON' && (
          <Animated.Image
            source={ASSETS.MOON}
            style={[styles.celestialObject, styles.moonPosition]}
            resizeMode="contain"
            entering={FadeIn.duration(1000)}
          />
        )}

        {theme.overlayCloud && (
          <View style={[styles.cloudOverlay, { opacity: 0.2 }]}>
            <Image
              source={ASSETS.CLOUD}
              style={StyleSheet.absoluteFillObject}
              resizeMode="contain"
            />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  celestialObject: {
    position: 'absolute',
    width: 250,
    height: 250,
    opacity: 0.8,
  },
  moonPosition: {
    top: 40,
    right: -20,
  },
  sunPosition: {
    top: -20,
    right: -40,
  },
  cloudOverlay: {
    position: 'absolute',
    width: width * 1.5,
    height: 400,
    top: 0,
    left: -width * 0.25,
  },
});
