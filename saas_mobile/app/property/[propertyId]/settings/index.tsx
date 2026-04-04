import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context';
import { Colors } from '@/constants/Colors';

export default function SettingsScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { theme } = useTheme();
  const colors = Colors[theme];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Property ID: {propertyId}
        </Text>
        <View style={[styles.placeholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
            Screen: Settings — Full implementation coming soon
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 20, paddingBottom: 100 },
  title: { fontSize: 28, fontFamily: 'Poppins-Bold', marginBottom: 4 },
  subtitle: { fontSize: 14, fontFamily: 'Urbanist-Regular', marginBottom: 20 },
  placeholder: { flex: 1, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { fontSize: 16, fontFamily: 'Urbanist-Medium' },
});
