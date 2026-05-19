import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import WeatherBackground from '@/components/dashboard/WeatherBackground';
import SafeBlurView from '@/components/ui/SafeBlurView';
import {
  SPACING,
} from '@/constants/designSystem';
import {
  GlassTile,
  StatColumns,
  ComplianceGauge,
  ScheduleItem,
} from '../DashboardComponents';
import { Property } from './types';
import { fontDisplay, fontSans } from './constants';

interface PropertyDetailScreenProps {
  property: Property;
  onBack: () => void;
  onShowChat: () => void;
  onShowTileDetail: (detail: any) => void;
}

export default function PropertyDetailScreen({
  property,
  onBack,
}: PropertyDetailScreenProps) {
  const { membership } = useAuth();
  const insets = useSafeAreaInsets();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await new Promise(r => setTimeout(r, 1000));
    setIsRefreshing(false);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <WeatherBackground condition="clear-night" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
      >
        {/* ─── Header ─────────────────────────────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerHero}>
            <View style={styles.heroLeft}>
              <Text style={styles.welcomeText}>FACILITY OVERVIEW</Text>
              <Text style={styles.propertyName}>{property.name}</Text>
              <Text style={styles.propertyCode}>{property.code} · April 18, 2026</Text>
            </View>
            <View style={styles.heroRight}>
              <View style={styles.tempContainer}>
                <Image
                  source={{ uri: 'https://pngimg.com/uploads/moon/moon_PNG52.png' }}
                  style={styles.moonImage}
                />
                <Text style={styles.tempText}>22°</Text>
              </View>
              <View style={styles.weatherStatusRow}>
                <Text style={styles.weatherStatusText}>CLEAR NIGHT</Text>
                <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.4)" />
              </View>
            </View>
          </View>
        </View>

        {/* ─── Dashboard Cards ─────────────────────────────────────────────────── */}
        <View style={styles.dashboardGrid}>
          <GlassTile label="Tickets" icon="ticket-outline" delay={100}>
            <StatColumns
              data={[
                { label: 'Open', value: property.openTickets, color: '#EF4444' },
                { label: 'Progress', value: Math.max(0, property.totalTickets - property.openTickets - property.resolvedTickets), color: '#F5A000' },
                { label: 'Resolved', value: property.resolvedTickets, color: '#1FC26E' },
              ]}
            />
          </GlassTile>

          <GlassTile label="Checklist" icon="checkbox-outline" delay={200}>
            <ComplianceGauge value={property.checklist.percent} total={100} />
          </GlassTile>

          <GlassTile label="PPM Schedule" icon="calendar-outline" delay={300}>
            <ScheduleItem date="17" month="Apr" title="VRF AHU" type="Preventive Maintenance" status="PENDING" />
          </GlassTile>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { flex: 1 },
  header: { paddingHorizontal: SPACING.xl, paddingBottom: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  headerHero: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLeft: { flex: 1, paddingTop: 4 },
  welcomeText: { fontFamily: fontSans, fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5 },
  propertyName: { fontFamily: fontDisplay, fontSize: 48, fontWeight: '800', color: '#FFFFFF', marginTop: 0, letterSpacing: -1.5 },
  propertyCode: { fontFamily: fontSans, fontSize: 15, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: '500' },
  heroRight: { alignItems: 'flex-end' },
  tempContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, position: 'relative' },
  tempText: { fontFamily: fontDisplay, fontSize: 72, fontWeight: '800', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10, zIndex: 10 },
  moonImage: { width: 140, height: 140, position: 'absolute', right: -30, top: -20, opacity: 0.8 },
  weatherStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -12, marginRight: 40 },
  weatherStatusText: { fontFamily: fontSans, fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  dashboardGrid: { paddingVertical: 10, gap: 4 },
});
