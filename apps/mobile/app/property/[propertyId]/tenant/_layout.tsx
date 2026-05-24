import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { useTheme } from '@/context';

export default function TenantLayout() {
  const { colors } = useTheme();
  console.log('[TenantLayout] Rendering...');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
