import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  GestureResponderEvent,
} from 'react-native';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'solid'
  | 'outline'
  | 'outline-secondary'
  | 'ghost'
  | 'success'
  | 'warning'
  | 'danger'
  | 'link';

type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'icon';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  title?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

// ---- Design System Color Palette ----
const COLORS = {
  primary: '#7C3AED',
  primaryDark: '#6D28D9',
  primaryLight: 'rgba(124,58,237,0.10)',
  secondary: '#8B5CF6',
  secondaryDark: '#7C3AED',
  secondaryLight: 'rgba(139,92,246,0.10)',
  success: '#10B981',
  successLight: 'rgba(16,185,129,0.10)',
  warning: '#F59E0B',
  warningLight: 'rgba(245,158,11,0.10)',
  error: '#EF4444',
  errorLight: 'rgba(239,68,68,0.10)',
  surface: '#FFFFFF',
  surfaceLight: 'rgba(255,255,255,0.85)',
  border: '#E2E8F0',
  textPrimary: '#1A2332',
  textSecondary: '#64748B',
  textInverse: '#FFFFFF',
  glassBg: 'rgba(255,255,255,0.75)',
  glassBorder: 'rgba(255,255,255,0.55)',
  shadowColor: 'rgba(124,58,237,0.08)',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
  title,
  leftIcon,
  rightIcon,
}) => {
  const containerStyle = getContainerStyle(variant, size);
  const labelStyle = getLabelStyle(variant, size);

  const label = children ?? (title ? <Text style={[styles.label, labelStyle, textStyle]}>{title}</Text> : null);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.72}
      style={[
        styles.base,
        containerStyle,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={labelStyle.color as string}
        />
      ) : (
        <>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          {label}
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </>
      )}
    </TouchableOpacity>
  );
};

function getContainerStyle(variant: ButtonVariant, size: ButtonSize): ViewStyle {
  const sizeStyle = SIZE_MAP[size];
  const variantStyle = VARIANT_MAP[variant];
  return { ...sizeStyle, ...variantStyle };
}

function getLabelStyle(variant: ButtonVariant, size: ButtonSize): TextStyle {
  const textColor = VARIANT_TEXT_MAP[variant];
  const fontSize = SIZE_FONT_MAP[size];
  return { color: textColor, fontSize };
}

const SIZE_MAP: Record<ButtonSize, ViewStyle> = {
  sm: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 8,
    minHeight: 36,
  },
  md: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    minHeight: 44,
  },
  lg: {
    height: 52,
    paddingHorizontal: 28,
    borderRadius: 14,
    minHeight: 52,
  },
  xl: {
    height: 56,
    paddingHorizontal: 36,
    borderRadius: 16,
    minHeight: 56,
  },
  icon: {
    height: 44,
    width: 44,
    borderRadius: 12,
    paddingHorizontal: 0,
    minHeight: 44,
  },
};

const SIZE_FONT_MAP: Record<ButtonSize, number> = {
  sm: 13,
  md: 14,
  lg: 15,
  xl: 16,
  icon: 14,
};

const VARIANT_MAP: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  secondary: {
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.secondaryDark,
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  solid: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: 'rgba(0,0,0,0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  'outline-secondary': {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  success: {
    backgroundColor: COLORS.success,
    borderWidth: 1,
    borderColor: COLORS.success,
    shadowColor: 'rgba(16,185,129,0.10)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  warning: {
    backgroundColor: COLORS.warning,
    borderWidth: 1,
    borderColor: COLORS.warning,
    shadowColor: 'rgba(245,158,11,0.10)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  danger: {
    backgroundColor: COLORS.error,
    borderWidth: 1,
    borderColor: COLORS.error,
    shadowColor: 'rgba(239,68,68,0.10)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  link: {
    backgroundColor: 'transparent',
  },
};

const VARIANT_TEXT_MAP: Record<ButtonVariant, string> = {
  primary: COLORS.textInverse,
  secondary: COLORS.textInverse,
  solid: COLORS.textPrimary,
  outline: COLORS.primary,
  'outline-secondary': COLORS.secondary,
  ghost: COLORS.textSecondary,
  success: COLORS.textInverse,
  warning: COLORS.textInverse,
  danger: COLORS.textInverse,
  link: COLORS.primary,
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  disabled: {
    opacity: 0.5,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});

export default Button;
