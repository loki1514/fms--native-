import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: 'low' | 'medium' | 'high';
}

const INTENSITY_MAP = {
  low: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  medium: {
    backgroundColor: 'rgba(2,6,23,0.4)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  high: {
    backgroundColor: 'rgba(2,6,23,0.6)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
};

export function GlassCard({ children, style, intensity = 'medium' }: GlassCardProps) {
  const intensityStyle = INTENSITY_MAP[intensity];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: intensityStyle.backgroundColor,
          borderColor: intensityStyle.borderColor,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 4,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
});

export default GlassCard;
