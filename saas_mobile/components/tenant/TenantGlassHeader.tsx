'use client';
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeIn,
  withDelay,
} from 'react-native-reanimated';
import Svg, { Ellipse, Path, Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TenantGlassHeaderProps {
  propertyName?: string;
  userName?: string;
  isSuperTenant?: boolean;
}

// Animated cloud with parallax depth layers
function AnimatedCloud({
  top,
  scale,
  duration,
  delay = 0,
  opacity = 0.85,
  speed = 1,
}: {
  top: number;
  scale: number;
  duration: number;
  delay?: number;
  opacity?: number;
  speed?: number;
}) {
  const translateX = useSharedValue(-160);

  useEffect(() => {
    translateX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(SCREEN_WIDTH + 80, { duration, easing: Easing.linear }),
          withTiming(-160, { duration: 0 })
        ),
        -1,
        false
      )
    );
  }, [delay]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', top }, style]}>
      <Svg width="140" height="55" viewBox="0 0 140 55">
        <Ellipse cx="30" cy="40" rx="26" ry="14" fill={`rgba(255,255,255,${opacity})`} />
        <Ellipse cx="58" cy="32" rx="32" ry="20" fill={`rgba(255,255,255,${opacity + 0.05})`} />
        <Ellipse cx="92" cy="38" rx="28" ry="16" fill={`rgba(255,255,255,${opacity})`} />
        <Ellipse cx="46" cy="22" rx="20" ry="14" fill={`rgba(255,255,255,${opacity + 0.05})`} />
        <Ellipse cx="76" cy="20" rx="22" ry="15" fill={`rgba(255,255,255,${opacity + 0.05})`} />
        <Ellipse cx="64" cy="12" rx="16" ry="11" fill={`rgba(255,255,255,${opacity})`} />
      </Svg>
    </Animated.View>
  );
}

// Animated sun with rotating rays and pulsing glow
function AnimatedSun() {
  const pulseScale = useSharedValue(1);
  const rayRotation = useSharedValue(0);
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    rayRotation.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1,
      false
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const sunStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.sunWrapper}>
      {/* Outer glow ring */}
      <Animated.View style={[styles.sunGlow, glowStyle]} />
      {/* Sun body */}
      <Animated.View style={[styles.sun, sunStyle]}>
        <Svg width="50" height="50" viewBox="0 0 50 50">
          <Circle cx="25" cy="25" r="20" fill="#FFD700" />
          {/* Sun face */}
          <Circle cx="18" cy="22" r="2.5" fill="#FFA500" />
          <Circle cx="32" cy="22" r="2.5" fill="#FFA500" />
          <Circle cx="25" cy="30" r="1.5" fill="#FFA500" />
        </Svg>
      </Animated.View>
    </View>
  );
}

export function TenantGlassHeader({
  propertyName = 'Property',
  userName = 'Tenant',
  isSuperTenant,
}: TenantGlassHeaderProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <Animated.View entering={FadeIn.duration(500)} style={styles.container}>
      {/* Gradient sky background */}
      <View style={styles.skyGradient}>
        <View style={styles.skyTop} />
        <View style={styles.skyMid} />
        <View style={styles.skyBottom} />
      </View>

      {/* Deep background clouds (slower, smaller, more transparent) */}
      <AnimatedCloud top={20} scale={0.5} duration={40000} delay={0} opacity={0.4} />
      <AnimatedCloud top={80} scale={0.6} duration={50000} delay={20000} opacity={0.3} />

      {/* Main clouds (normal speed) */}
      <AnimatedCloud top={30} scale={0.85} duration={28000} delay={5000} opacity={0.8} />
      <AnimatedCloud top={70} scale={1} duration={35000} delay={12000} opacity={0.7} />
      <AnimatedCloud top={10} scale={0.65} duration={24000} delay={18000} opacity={0.75} />

      {/* Foreground cloud (faster, larger) */}
      <AnimatedCloud top={100} scale={1.2} duration={20000} delay={8000} opacity={0.9} />

      {/* Animated sun with rays */}
      <AnimatedSun />

      {/* Super tenant property picker */}
      {isSuperTenant && (
        <View style={styles.propertyPicker}>
          <View style={styles.propertyPickerDot} />
          <Text style={styles.propertyPickerText}>{propertyName}</Text>
          <Text style={styles.propertyPickerArrow}>▼</Text>
        </View>
      )}

      {/* Greeting content */}
      <View style={styles.greetingContainer}>
        <Text style={styles.greetingText}>
          {greeting}
        </Text>
        <Text style={styles.userName}>
          {userName}
        </Text>
        {!isSuperTenant && (
          <View style={styles.propertyBadge}>
            <View style={styles.propertyBadgeDot} />
            <Text style={styles.propertyBadgeText}>{propertyName}</Text>
          </View>
        )}
      </View>

      {/* Bottom wave divider */}
      <View style={styles.waveContainer}>
        <Svg width={SCREEN_WIDTH} height="30" viewBox={`0 0 ${SCREEN_WIDTH} 30`} preserveAspectRatio="none">
          <Path
            d={`M0,15 Q${SCREEN_WIDTH * 0.25},30 ${SCREEN_WIDTH * 0.5},15 Q${SCREEN_WIDTH * 0.75},0 ${SCREEN_WIDTH},15 L${SCREEN_WIDTH},30 L0,30 Z`}
            fill="rgba(240,244,248,0.4)"
          />
        </Svg>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 190,
    position: 'relative',
    overflow: 'hidden',
  },
  skyGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  skyTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: '#1a3a6e',
  },
  skyMid: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    height: '35%',
    backgroundColor: '#3b7dd8',
  },
  skyBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: '#87CEEB',
  },
  sunWrapper: {
    position: 'absolute',
    top: 15,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunGlow: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFD700',
  },
  sun: {
    width: 50,
    height: 50,
  },
  propertyPicker: {
    position: 'absolute',
    top: 55,
    left: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  propertyPickerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#4CAF50',
  },
  propertyPickerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  propertyPickerArrow: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
  },
  greetingContainer: {
    position: 'absolute',
    bottom: 38,
    left: 20,
    right: 20,
  },
  greetingText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  userName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginBottom: 4,
  },
  propertyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  propertyBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
  },
  propertyBadgeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  waveContainer: {
    position: 'absolute',
    bottom: -2,
    left: 0,
    right: 0,
  },
});
