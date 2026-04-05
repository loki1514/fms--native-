/**
 * AuroraBackground — Animated ambient gradient orbs
 *
 * Renders a full-screen decorative layer behind all dashboard content.
 * Large blurred gradient orbs animate continuously based on time-of-day period.
 * Does not block touch events (pointerEvents="none").
 *
 * Theme-aware: base background respects app dark/light mode.
 * Weather-driven: orb colors use time-of-day period for atmosphere.
 *
 * Inspired by: Apple weather app, Nothing OS ambient design
 */
import React from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { AuroraColors } from '@/hooks/useWeather';
import { useTheme } from '@/context';
import { Colors } from '@/constants/Colors';

const { width: W, height: H } = Dimensions.get('window');

interface AuroraBackgroundProps {
  colors: AuroraColors;
}

interface Orb {
  size: number;
  top: number;
  left: number;
  color: string;
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
  scaleRange: [number, number];
}

const ORBS_CONFIG: Orb[] = [
  // Large primary orb — bottom-left area
  { size: W * 0.9, top: H * 0.15, left: -W * 0.15, color: 'orb1', duration: 18000, delay: 0, driftX: W * 0.08, driftY: H * 0.03, scaleRange: [1, 1.08] },
  // Secondary orb — top-right
  { size: W * 0.7, top: -H * 0.1, left: W * 0.3, color: 'orb2', duration: 22000, delay: 4000, driftX: -W * 0.06, driftY: H * 0.05, scaleRange: [1, 1.05] },
  // Small accent orb — bottom-right
  { size: W * 0.5, top: H * 0.5, left: W * 0.55, color: 'orb3', duration: 26000, delay: 8000, driftX: -W * 0.04, driftY: H * 0.04, scaleRange: [1, 1.1] },
  // Extra ambient orb — center-left
  { size: W * 0.4, top: H * 0.3, left: -W * 0.05, color: 'orb1', duration: 30000, delay: 12000, driftX: W * 0.05, driftY: -H * 0.02, scaleRange: [1, 1.06] },
];

interface AnimatedOrbProps {
  config: Orb;
  colors: AuroraColors;
  isDark?: boolean;
}

function AnimatedOrb({ config, colors, isDark = false }: AnimatedOrbProps) {
  const orbColor = colors[config.color as keyof AuroraColors] ?? config.color;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(config.scaleRange[0]);

  React.useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(config.driftX, { duration: config.duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: config.duration, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    translateY.value = withRepeat(
      withSequence(
        withTiming(config.driftY, { duration: config.duration * 0.8, easing: Easing.inOut(Easing.ease) }),
        withTiming(-config.driftY * 0.5, { duration: config.duration * 0.8, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    scale.value = withRepeat(
      withSequence(
        withTiming(config.scaleRange[1], { duration: config.duration * 0.6, easing: Easing.inOut(Easing.ease) }),
        withTiming(config.scaleRange[0], { duration: config.duration * 0.6, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.orb,
        {
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          backgroundColor: orbColor,
          top: config.top,
          left: config.left,
          // Subtle orbs in dark mode, vibrant in light mode
          opacity: isDark ? 0.35 : 0.85,
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    />
  );
}

export function AuroraBackground({ colors }: AuroraBackgroundProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const themeColors = Colors[theme];

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Base gradient layer — theme-aware */}
      <View
        style={[
          styles.baseGradient,
          {
            // In dark mode, use the theme background; in light mode, use the weather aurora top color
            backgroundColor: isDark ? themeColors.background : colors.primaryTop,
          },
        ]}
      />

      {/* Animated gradient overlay (mid color) — theme-aware */}
      <View
        style={[
          styles.midGradient,
          {
            // In dark mode, use a subtle theme surface; in light mode, use weather mid
            backgroundColor: isDark ? themeColors.surface : colors.primaryMid,
            opacity: isDark ? 0.6 : 0.7,
          },
        ]}
      />

      {/* Animated orbs — weather-driven, theme-dimmed */}
      {ORBS_CONFIG.map((orb, i) => (
        <AnimatedOrb key={i} config={orb} colors={colors} isDark={isDark} />
      ))}

      {/* Bottom blend — theme-aware */}
      <View
        style={[
          styles.bottomBlend,
          {
            // In dark mode, blend into theme background; in light mode, use weather bottom
            backgroundColor: isDark ? themeColors.background : colors.primaryBottom,
          },
        ]}
      />

      {/* Vignette overlay */}
      <View style={styles.vignette} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  baseGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  midGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '70%',
    opacity: 0.7,
  },
  orb: {
    position: 'absolute',
    opacity: 0.85,
  },
  bottomBlend: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
    opacity: 0.6,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    // Subtle dark vignette for depth
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
});
