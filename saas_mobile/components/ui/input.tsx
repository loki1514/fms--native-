import React, { useState } from 'react';
import { TextInput, StyleSheet, TextInputProps, View, ViewStyle, Text } from 'react-native';

interface InputProps extends TextInputProps {
  containerStyle?: ViewStyle;
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  containerStyle,
  style,
  editable = true,
  label,
  error,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={containerStyle}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          isFocused && styles.focused,
          !editable && styles.disabled,
          error && styles.inputError,
          style,
        ]}
        placeholderTextColor="#94A3B8"
        editable={editable}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    fontFamily: 'Urbanist-Medium',
  },
  input: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1A2332',
  },
  focused: {
    borderColor: '#7C3AED',
    borderWidth: 2,
  },
  disabled: {
    opacity: 0.5,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    fontFamily: 'Urbanist-Regular',
  },
});

export default Input;
