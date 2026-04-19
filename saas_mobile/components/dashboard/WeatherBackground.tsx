import React, { useMemo } from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';

export type WeatherCondition = 'clear-day' | 'clear-night' | 'cloudy-day' | 'cloudy-night' | 'rainy' | 'dawn' | 'dusk';

interface WeatherBackgroundProps {
  condition: WeatherCondition;
}

const ASSETS = {
  SUN: 'https://pngimg.com/uploads/sun/sun_PNG13426.png',
  MOON: 'https://pngimg.com/uploads/moon/moon_PNG52.png',
  CLOUD: 'https://pngimg.com/uploads/cloud/cloud_PNG4.png',
};

const THEMES: Record<WeatherCondition, { colors: string[]; celestial: 'SUN' | 'MOON' | null; overlayCloud: boolean; showStars: boolean }> = {
  'clear-day': {
    colors: ['#3e5c7a', '#7492a8', '#b5a198'], 
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
    colors: ['#1e272e', '#485460', '#808e9b'], 
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
      y: Math.random() * (SCREEN_H * 0.7), // Concentrate in upper part
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

export default function WeatherBackground({ condition }: WeatherBackgroundProps) {
  const theme = THEMES[condition] || THEMES['clear-day'];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Animated.View key={condition} entering={FadeIn.duration(1200)} style={StyleSheet.absoluteFillObject}>
        <LinearGradient
          colors={theme.colors}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.9 }}
        />
        
        {theme.showStars && <StarField />}

        {theme.celestial && (
          <Image
            source={{ uri: ASSETS[theme.celestial] }}
            style={[
              styles.celestialObject,
              theme.celestial === 'MOON' ? styles.moonPosition : styles.sunPosition
            ]}
            resizeMode="contain"
          />
        )}

        {theme.overlayCloud && (
          <Image
            source={{ uri: ASSETS.CLOUD }}
            style={styles.cloudOverlay}
            resizeMode="contain"
            opacity={0.3}
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
    width: width * 1.2,
    height: 300,
    top: 60,
    left: -width * 0.1,
  },
});
