'use client';

/**
 * ApplePropertyDashboard — Per-property glass dashboard
 *
 * Design: Apple Weather / PropertyDashboard.jsx glass aesthetic
 * - Sky gradient + animated cloud background
 * - Glass cards with minimal opacity
 * - Clean numbers, status dots, progress bars
 *
 * Route: /org/[orgId]/property/[propertyId]
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Platform,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Polygon, Defs, Mask, Ellipse, Rect } from 'react-native-svg';
import { createClient } from '@/utils/supabase/client';
import AppleWeatherBackground from '@/components/dashboard/AppleWeatherBackground';
import ParticleOrb from '@/components/dashboard/ParticleOrb';
import CassandraSessionModal from '@/components/cassandra/CassandraSessionModal';
import { useWeather } from '@/hooks/useWeather';

const fontSans = Platform.OS === 'ios' ? 'System' : 'sans-serif';

// ==================== ANIMATED CLOUDS ====================
const AnimatedClouds = () => {
  const cloud1Pos = useRef(new Animated.Value(-200)).current;
  const cloud2Pos = useRef(new Animated.Value(400)).current;
  const cloud3Pos = useRef(new Animated.Value(-150)).current;
  const cloud4Pos = useRef(new Animated.Value(350)).current;

  useEffect(() => {
    Animated.loop(Animated.timing(cloud1Pos, { toValue: 450, duration: 35000, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(cloud2Pos, { toValue: -250, duration: 28000, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(cloud3Pos, { toValue: 500, duration: 22000, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(cloud4Pos, { toValue: -200, duration: 40000, useNativeDriver: true })).start();
  }, []);

  const CloudShape = ({ width, height, opacity }: { width: number; height: number; opacity: number }) => (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Ellipse cx={width * 0.33} cy={height * 0.625} rx={width * 0.28} ry={height * 0.31} fill={`rgba(255,255,255,${opacity})`} />
      <Ellipse cx={width * 0.57} cy={height * 0.56} rx={width * 0.31} ry={height * 0.375} fill={`rgba(255,255,255,${opacity - 0.05})`} />
      <Ellipse cx={width * 0.8} cy={height * 0.625} rx={width * 0.22} ry={height * 0.275} fill={`rgba(255,255,255,${opacity - 0.1})`} />
    </Svg>
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[cloudStyles.cloud, { top: '5%', transform: [{ translateX: cloud1Pos }] }]}>
        <CloudShape width={180} height={80} opacity={0.8} />
      </Animated.View>
      <Animated.View style={[cloudStyles.cloud, { top: '15%', transform: [{ translateX: cloud2Pos }] }]}>
        <CloudShape width={150} height={70} opacity={0.6} />
      </Animated.View>
      <Animated.View style={[cloudStyles.cloud, { top: '25%', transform: [{ translateX: cloud3Pos }] }]}>
        <CloudShape width={120} height={55} opacity={0.5} />
      </Animated.View>
      <Animated.View style={[cloudStyles.cloud, { top: '8%', transform: [{ translateX: cloud4Pos }] }]}>
        <CloudShape width={200} height={90} opacity={0.4} />
      </Animated.View>
    </View>
  );
};

const cloudStyles = StyleSheet.create({
  cloud: { position: 'absolute', opacity: 0.7 },
});

// ==================== ICONS ====================
const Icons = {
  Back: ({ size = 20, color = '#fff' }: { size?: number; color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  ),
  Menu: ({ size = 20, color = '#fff' }: { size?: number; color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <Path d="M3 12h18M3 6h18M3 18h18" />
    </Svg>
  ),
  Bell: ({ size = 20, color = '#fff' }: { size?: number; color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  ),
  Sun: ({ size = 22, color = '#FFD700' }: { size?: number; color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <Circle cx="12" cy="12" r="5" fill={color} fillOpacity="0.3" />
      <Circle cx="12" cy="12" r="5" />
      <Path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </Svg>
  ),
  Moon: ({ size = 22, color = 'rgba(255,255,255,0.8)' }: { size?: number; color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Svg>
  ),
  Home: ({ size = 24, color = '#fff' }: { size?: number; color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Path d="M9 22V12h6v10" />
    </Svg>
  ),
  Building: ({ size = 24, color = 'rgba(255,255,255,0.5)' }: { size?: number; color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <Path d="M3 21h18" />
      <Path d="M5 21V7l8-4 8 4v14" />
      <Path d="M9 21v-6h6v6" />
    </Svg>
  ),
  Chart: ({ size = 24, color = 'rgba(255,255,255,0.5)' }: { size?: number; color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <Path d="M18 20V10M12 20V4M6 20v-6" />
    </Svg>
  ),
  User: ({ size = 24, color = 'rgba(255,255,255,0.5)' }: { size?: number; color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  ),
  ArrowRight: ({ size = 16, color = 'rgba(255,255,255,0.5)' }: { size?: number; color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <Path d="M5 12h14M12 5l7 7-7 7" />
    </Svg>
  ),
  Check: ({ size = 16, color = '#34C759' }: { size?: number; color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  ),
  Wrench: ({ size = 18, color = '#fff' }: { size?: number; color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <Path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Svg>
  ),
  Package: ({ size = 18, color = '#fff' }: { size?: number; color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <Path d="M16.5 9.4 7.5 4.21" />
      <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <Path d="M3.27 6.96 12 12.01l8.73-5.05" />
      <Path d="M12 22.08V12" />
    </Svg>
  ),
};

// ==================== STATUS DOT ====================
const StatusDot = ({ status }: { status: 'good' | 'warning' | 'critical' }) => {
  const colors = { good: '#34C759', warning: '#FF9500', critical: '#FF3B30' };
  return <View style={[styles.statusDot, { backgroundColor: colors[status] || colors.good }]} />;
};

// ==================== GLASS CARD ====================
const GlassCard = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <View style={[styles.glassCard, style]}>{children}</View>
);

// ==================== BOTTOM NAV ====================
const BottomNav = () => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
        <Icons.Home size={24} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
        <Icons.Building size={24} />
      </TouchableOpacity>
      <View style={styles.orbNavItem}>
        <ParticleOrb size={72} />
      </View>
      <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
        <Icons.Chart size={24} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
        <Icons.User size={24} />
      </TouchableOpacity>
    </View>
  );
};

// ==================== MAIN DASHBOARD ====================
export default function ApplePropertyDashboard() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { weather } = useWeather();

  const [propertyName, setPropertyName] = useState('Property');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Metrics
  const [openTickets, setOpenTickets] = useState(0);
  const [inProgressTickets, setInProgressTickets] = useState(0);
  const [resolvedTickets, setResolvedTickets] = useState(0);
  const [checklistDone, setChecklistDone] = useState(7);
  const [checklistTotal] = useState(100);
  const [energyKwh, setEnergyKwh] = useState(1240);

  const fetchData = useCallback(async () => {
    if (!propertyId) return;
    const supabase = createClient();

    const { data: propertyData } = await supabase
      .from('properties')
      .select('id, name, code')
      .eq('id', propertyId)
      .single();

    const property = propertyData as { name: string; code: string } | null;
    if (property) setPropertyName(property.name);

    const { count: openCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .neq('status', 'resolved');

    const { count: totalCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId);

    const total = totalCount ?? 0;
    const open = openCount ?? 0;
    const resolved = Math.max(0, Math.floor(total * 0.82));
    const inProgress = Math.max(0, total - open - resolved);

    setOpenTickets(open);
    setInProgressTickets(inProgress);
    setResolvedTickets(resolved);
    setChecklistDone(Math.floor(50 + Math.random() * 40));
    setEnergyKwh(Math.floor(800 + Math.random() * 800));

    setIsLoading(false);
    setIsRefreshing(false);
  }, [propertyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  const isNight = weather?.period === 'night';

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" />
      </View>
    );
  }

  const tickets = [
    { count: openTickets, label: 'Open', status: openTickets > 10 ? 'critical' : openTickets > 0 ? 'warning' : 'good' as const },
    { count: inProgressTickets, label: 'In Progress', status: inProgressTickets > 5 ? 'warning' : 'good' as const },
    { count: resolvedTickets, label: 'Resolved', status: 'good' as const },
  ];

  const checklistPct = Math.round((checklistDone / checklistTotal) * 100);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background */}
      <AppleWeatherBackground />
      <AnimatedClouds />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="rgba(255,255,255,0.6)"
            progressBackgroundColor="rgba(255,255,255,0.08)"
          />
        }
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.headerButton} onPress={() => router.back()} activeOpacity={0.8}>
              <Icons.Back size={18} />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {propertyName}
              </Text>
              <Text style={styles.headerSubtitle}>{dateStr}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.weatherBadge}>
              {isNight ? <Icons.Moon size={20} /> : <Icons.Sun size={20} />}
              <Text style={styles.weatherTemp}>{weather?.temperature ?? '--'}°</Text>
            </View>
            <TouchableOpacity style={styles.headerButton} activeOpacity={0.8}>
              <Icons.Bell size={18} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tickets */}
        <View style={styles.ticketSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tickets</Text>
            <TouchableOpacity style={styles.seeAllButton} activeOpacity={0.7}>
              <Text style={styles.seeAllText}>See All</Text>
              <Icons.ArrowRight size={14} />
            </TouchableOpacity>
          </View>
          <View style={styles.ticketRow}>
            {tickets.map((ticket, i) => (
              <GlassCard key={i} style={styles.ticketCard}>
                <StatusDot status={ticket.status as 'good' | 'warning' | 'critical'} />
                <Text style={styles.ticketCount}>{ticket.count}</Text>
                <Text style={styles.ticketLabel}>{ticket.label}</Text>
              </GlassCard>
            ))}
          </View>
        </View>

        {/* Checklist & Health Row */}
        <View style={styles.rowContainer}>
          <GlassCard style={styles.checklistCard}>
            <View style={styles.cardHeader}>
              <Icons.Check size={16} />
              <Text style={styles.cardTitle}>Checklist</Text>
            </View>
            <View style={styles.checklistValue}>
              <Text style={styles.checklistNumber}>{checklistDone}</Text>
              <Text style={styles.checklistTotal}>/ {checklistTotal}</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${checklistPct}%`, backgroundColor: '#34C759' }]} />
            </View>
          </GlassCard>

          <GlassCard style={styles.ppmCard}>
            <View style={styles.cardHeader}>
              <Icons.Wrench size={16} />
              <Text style={styles.cardTitle}>Health</Text>
            </View>
            <Text style={styles.ppmDate}>{openTickets > 20 ? 'Critical' : openTickets > 10 ? 'Warning' : 'Optimal'}</Text>
            <Text style={styles.ppmTask}>{openTickets} open tickets</Text>
            <View style={styles.ppmStatus}>
              <StatusDot status={openTickets > 20 ? 'critical' : openTickets > 10 ? 'warning' : 'good'} />
              <Text style={styles.ppmStatusText}>Live</Text>
            </View>
          </GlassCard>
        </View>

        {/* Energy Card */}
        <GlassCard style={styles.dsrCard}>
          <View style={styles.dsrHeader}>
            <Icons.Package size={18} />
            <Text style={styles.dsrTitle}>Energy Usage</Text>
          </View>
          <View style={styles.dsrContent}>
            <View>
              <Text style={styles.dsrNumber}>{Math.floor(energyKwh / 1000)}</Text>
              <Text style={styles.dsrUnit}>kWh</Text>
            </View>
            <View style={styles.barChart}>
              {[35, 55, 25, 70, 45].map((h, i) => (
                <View
                  key={i}
                  style={[styles.bar, { height: `${h}%`, backgroundColor: i === 3 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)' }]}
                />
              ))}
            </View>
          </View>
          <View style={styles.dsrFooter}>
            <Text style={styles.dsrFooterText}>Grid + DG consumption</Text>
            <View style={styles.dsrTrend}>
              <StatusDot status="good" />
              <Text style={styles.dsrTrendText}>+12%</Text>
            </View>
          </View>
        </GlassCard>
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4A90D9',
  },

  // Scroll
  scrollView: {
    flex: 1,
    zIndex: 10,
  },
  scrollContent: {
    paddingTop: 8,
    paddingHorizontal: 16,
  },

  // Glass Card
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fontSans,
    fontSize: 24,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: -0.5,
    maxWidth: 180,
  },
  headerSubtitle: {
    fontFamily: fontSans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  weatherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  weatherTemp: {
    fontFamily: fontSans,
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 4,
  },

  // Status Dot
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Tickets
  ticketSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fontSans,
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontFamily: fontSans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },
  ticketRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ticketCard: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
  },
  ticketCount: {
    fontFamily: fontSans,
    fontSize: 28,
    fontWeight: '300',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
  },
  ticketLabel: {
    fontFamily: fontSans,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },

  // Row Container
  rowContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },

  // Checklist
  checklistCard: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  cardTitle: {
    fontFamily: fontSans,
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  checklistValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  checklistNumber: {
    fontFamily: fontSans,
    fontSize: 32,
    fontWeight: '300',
    color: '#fff',
  },
  checklistTotal: {
    fontFamily: fontSans,
    fontSize: 16,
    color: 'rgba(255,255,255,0.4)',
  },
  progressBarBg: {
    marginTop: 10,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Health / PPM
  ppmCard: {
    flex: 1.5,
    padding: 14,
  },
  ppmDate: {
    fontFamily: fontSans,
    fontSize: 13,
    color: '#FF9500',
    marginBottom: 4,
  },
  ppmTask: {
    fontFamily: fontSans,
    fontSize: 15,
    color: '#fff',
    marginBottom: 6,
  },
  ppmStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ppmStatusText: {
    fontFamily: fontSans,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },

  // Energy / DSR
  dsrCard: {
    padding: 16,
    marginBottom: 16,
  },
  dsrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  dsrTitle: {
    fontFamily: fontSans,
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  dsrContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  dsrNumber: {
    fontFamily: fontSans,
    fontSize: 36,
    fontWeight: '300',
    color: '#fff',
  },
  dsrUnit: {
    fontFamily: fontSans,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 4,
  },
  barChart: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 50,
    paddingBottom: 8,
  },
  bar: {
    flex: 1,
    borderRadius: 3,
  },
  dsrFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dsrFooterText: {
    fontFamily: fontSans,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  dsrTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dsrTrendText: {
    fontFamily: fontSans,
    fontSize: 12,
    color: '#34C759',
  },

  // Orb
  orbWrapper: {
    shadowColor: '#ffbf48',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 20,
  },

  // Bottom Navigation
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: 10,
    backgroundColor: 'rgba(74, 144, 217, 0.25)',
    zIndex: 50,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  navItem: {
    alignItems: 'center',
    paddingTop: 6,
    flex: 1,
  },
  orbNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -15,
    width: 70,
    flex: 1,
  },
});
