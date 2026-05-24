'use client';

import React from 'react';
import { View, StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context';

export default function PropertyDetailLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: isDark ? '#0f1628' : '#F8FAFC' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: isDark ? '#0f1628' : '#F8FAFC' },
        }}
      />
    </View>
  );
}
