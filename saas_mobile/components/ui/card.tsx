import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, TouchableOpacity, StyleProp } from 'react-native';

interface CardProps {
  glass?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pressable?: boolean;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({ glass = false, children, style, pressable, onPress }) => {
  const cardStyle = [glass ? styles.glassCard : styles.modernCard, style];
  const content = <View style={cardStyle}>{children}</View>;

  if (pressable && onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.72}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

export const CardHeader: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({ children, style }) => (
  <View style={[styles.header, style]}>{children}</View>
);

export const CardTitle: React.FC<{ children: React.ReactNode; style?: TextStyle }> = ({ children, style }) => (
  <Text style={[styles.title, style]}>{children}</Text>
);

export const CardDescription: React.FC<{ children: React.ReactNode; style?: TextStyle }> = ({ children, style }) => (
  <Text style={[styles.description, style]}>{children}</Text>
);

export const CardContent: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({ children, style }) => (
  <View style={[styles.content, style]}>{children}</View>
);

export const CardFooter: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({ children, style }) => (
  <View style={[styles.footer, style]}>{children}</View>
);

// Design tokens — matches web dashboard design system
const CARD_PADDING = 20;
const CARD_RADIUS = 16;
const CARD_SHADOW = {
  shadowColor: 'rgba(0,0,0,0.04)',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 1,
  shadowRadius: 4,
  elevation: 1,
};
const GLASS_SHADOW = {
  shadowColor: 'rgba(124,58,237,0.08)',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 1,
  shadowRadius: 8,
  elevation: 2,
};

const styles = StyleSheet.create({
  modernCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: CARD_PADDING,
    ...CARD_SHADOW,
    overflow: 'hidden',
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: CARD_PADDING,
    ...GLASS_SHADOW,
    overflow: 'hidden',
  },
  header: {
    paddingBottom: 12,
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2332',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  description: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  content: {
    paddingTop: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
});

export default Card;
