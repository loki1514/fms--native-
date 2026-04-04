import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';

interface LabelProps {
  children: React.ReactNode;
  style?: TextStyle;
  disabled?: boolean;
}

export const Label: React.FC<LabelProps> = ({ children, style, disabled }) => (
  <Text style={[styles.label, disabled && styles.disabled, style]}>{children}</Text>
);

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A2332',
    marginBottom: 6,
  },
  disabled: {
    opacity: 0.7,
  },
});

export default Label;
