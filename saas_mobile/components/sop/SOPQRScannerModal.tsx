import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScanLine } from 'lucide-react-native';
import { GlassCard } from '@/constants/designSystem';
import { useTheme } from '@/context';

interface SOPQRScannerModalProps {
  visible?: boolean;
  onClose?: () => void;
  onScan?: (data: string) => void;
}

export default function SOPQRScannerModal({ visible }: SOPQRScannerModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <GlassCard style={styles.card}>
        <View style={styles.iconCircle}>
          <ScanLine size={28} color="#708F96" strokeWidth={1.5} />
        </View>
        <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#1A2332' }]}>
          QR Scanner
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? 'rgba(230,235,238,0.5)' : 'rgba(26,35,50,0.5)' }]}>
          Scan QR codes to quickly open checklists. Coming soon.
        </Text>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', padding: 28, alignItems: 'center', gap: 14 },
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(112,143,150,0.12)', justifyContent: 'center', alignItems: 'center' },
  title: {  fontSize: 18, fontWeight: '700', textAlign: 'center' },
  subtitle: {  fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
