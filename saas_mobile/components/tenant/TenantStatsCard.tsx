'use client';
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

interface TenantStatsCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  color: string;
  icon?: 'ticket' | 'check' | 'alert' | 'clock' | 'trending';
  trend?: 'up' | 'down' | 'neutral';
}

function StatIcon({ type, color }: { type: TenantStatsCardProps['icon']; color: string }) {
  const iconColor = color;
  switch (type) {
    case 'ticket':
      return (
        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round">
          <Path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
          <Path d="M13 5v14" />
        </Svg>
      );
    case 'check':
      return (
        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 6L9 17l-5-5" />
        </Svg>
      );
    case 'alert':
      return (
        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round">
          <Circle cx="12" cy="12" r="10" />
          <Path d="M12 8v4M12 16h.01" />
        </Svg>
      );
    case 'clock':
      return (
        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round">
          <Circle cx="12" cy="12" r="10" />
          <Path d="M12 6v6l4 2" />
        </Svg>
      );
    case 'trending':
      return (
        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M22 7L13.5 15.5l-4-4L2 20" />
          <Path d="M22 7h-5M22 7v-5" />
        </Svg>
      );
    default:
      return (
        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2">
          <Circle cx="12" cy="12" r="10" />
        </Svg>
      );
  }
}

function TrendArrow({ trend, color }: { trend: 'up' | 'down' | 'neutral'; color: string }) {
  if (trend === 'up') {
    return (
      <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
        <Path d="M18 15l-6-6-6 6" />
      </Svg>
    );
  }
  if (trend === 'down') {
    return (
      <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
        <Path d="M6 9l6 6 6-6" />
      </Svg>
    );
  }
  return null;
}

function getGradientColors(color: string): [string, string] {
  switch (color) {
    case '#D4A017':
      return ['rgba(212,160,23,0.15)', 'rgba(212,160,23,0.05)'];
    case '#4CAF50':
      return ['rgba(76,175,80,0.15)', 'rgba(76,175,80,0.05)'];
    case '#E53935':
      return ['rgba(229,57,53,0.15)', 'rgba(229,57,53,0.05)'];
    case '#3B82F6':
      return ['rgba(59,130,246,0.15)', 'rgba(59,130,246,0.05)'];
    case '#8B5CF6':
      return ['rgba(139,92,246,0.15)', 'rgba(139,92,246,0.05)'];
    default:
      return ['rgba(102,126,234,0.15)', 'rgba(102,126,234,0.05)'];
  }
}

function AnimatedCountUp({ value, color }: { value: string | number; color: string }) {
  const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) || 0 : value;
  const suffix = typeof value === 'string' ? value.replace(/[0-9.]/g, '') : '';
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 150 });
    opacity.value = withTiming(1, { duration: 400 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Text style={[styles.value, { color }]}>
        {numericValue}{suffix}
      </Text>
    </Animated.View>
  );
}

export function TenantStatsCard({
  value,
  label,
  sublabel,
  color,
  icon = 'ticket',
  trend = 'neutral',
}: TenantStatsCardProps) {
  const [gradTop, gradBottom] = getGradientColors(color);
  const accentColor = color;

  return (
    <View style={styles.cardWrapper}>
      {/* Gradient background */}
      <View style={[styles.card, { overflow: 'hidden' }]}>
        {/* Background gradient */}
        <View
          style={[
            styles.gradientBg,
            {
              backgroundColor: gradTop,
              borderColor: `${accentColor}30`,
            },
          ]}
        />

        {/* Decorative top-right circle */}
        <View
          style={[
            styles.decorCircle,
            { backgroundColor: `${accentColor}15` },
          ]}
        />

        {/* Icon + content */}
        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: `${accentColor}20` }]}>
            <StatIcon type={icon} color={accentColor} />
          </View>

          <AnimatedCountUp value={value} color={accentColor} />

          <Text style={styles.label}>{label}</Text>

          {sublabel && (
            <View style={styles.sublabelRow}>
              {trend !== 'neutral' && <TrendArrow trend={trend} color={accentColor} />}
              <Text style={[styles.sublabel, { color: `${accentColor}99` }]}>{sublabel}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    padding: 14,
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
    overflow: 'hidden',
  },
  gradientBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  decorCircle: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    color: '#333',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  sublabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  sublabel: {
    fontSize: 10,
    fontWeight: '500',
  },
});
