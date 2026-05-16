import React, { useMemo } from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';

export type WeatherCondition = 'clear-day' | 'clear-night' | 'cloudy-day' | 'cloudy-night' | 'rainy' | 'dawn' | 'dusk';

interface WeatherBackgroundProps {
  condition: WeatherCondition;
}

const ASSETS = {
  SUN: require('@/assets/images/premium-sun.png'),
  MOON: { uri: 'https://pngimg.com/uploads/moon/moon_PNG52.png' },
  CLOUD: { uri: 'https://pngimg.com/uploads/cloud/cloud_PNG4.png' },
};

const THEMES: Record<WeatherCondition, { colors: string[]; celestial: 'SUN' | 'MOON' | null; overlayCloud: boolean; showStars: boolean }> = {
  'clear-day': {
    colors: ['#00B4DB', '#0083B0', '#74ebd5'], 
    celestial: 'SUN',
    overlayCloud: false,
    showStars: false,
  },
  'clear-night': {
    colors: ['#0A0D14', '#181C2A', '#2D3B54'], 
    celestial: 'MOON',
    overlayCloud: false,
    showStars: true,
  },
  'cloudy-day': {
    colors: ['#4b6584', '#778ca3', '#a5b1c2'], 
    celestial: null,
    overlayCloud: true,
    showStars: false,
  },
  'cloudy-night': {
    colors: ['#0d111a', '#212738', '#404a5e'], 
    celestial: 'MOON',
    overlayCloud: true,
    showStars: true,
  },
  'rainy': {
    colors: ['#070A11', '#141E33', '#2B3F56'], 
    celestial: null,
    overlayCloud: true,
    showStars: false,
  },
  'dawn': {
    colors: ['#2c3e50', '#8e44ad', '#fd9644'], 
    celestial: 'SUN',
    overlayCloud: false,
    showStars: false,
  },
  'dusk': {
    colors: ['#f39c12', '#e67e22', '#d35400'], 
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

        {theme.celestial && (
          <Image
            source={ASSETS[theme.celestial]}
            style={[
              styles.celestialObject,
              theme.celestial === 'MOON' ? styles.moonPosition : styles.sunPosition
            ]}
            resizeMode="contain"
          />
        )}

        {theme.overlayCloud && (
          <Image
            source={ASSETS.CLOUD}
            style={styles.cloudOverlay}
            resizeMode="contain"
            opacity={0.2}
          />
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
