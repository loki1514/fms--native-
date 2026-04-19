import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/utils/supabase/client';

// ---- Types ----
type TimePeriod = 'today' | 'month' | 'all';

interface TicketStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  pending_validation: number;
  urgent_open: number;
}

interface DashboardStats {
  ticketStats: TicketStats;
  electricityUnits: number;
  electricityUnitsToday: number;
  visitorsToday: number;
  checkedIn: number;
  checkedOut: number;
  vendorRevenue: number;
  vendorCommission: number;
  vendorCount: number;
  recentTickets: any[];
  dieselStats: {
    totalHoursToday: number;
    avgFuelLevel: number;
    activeGens: number;
  };
  checklistStats: {
    doneToday: number;
    pendingToday: number;
  };
}

const TIME_FILTERS: { value: TimePeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All' },
];

const fontSans = Platform.OS === 'ios' ? 'System' : 'sans-serif';
const fontDisplay = Platform.OS === 'web' ? 'Poppins' : 'System';

// ---- Design tokens ----
const BG = '#060912';
const GLASS_BG = 'rgba(255,255,255,0.06)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const ACCENT_AMBER = '#F5A000';
const ACCENT_GREEN = '#38A169';
const ACCENT_BLUE = '#3182CE';
const ACCENT_RED = '#FF6B6B';
const SUCCESS_GREEN = '#1FC26E';
const CRITICAL_RED = '#D9261C';

// ---- Sparkline bar chart ----
function Sparkline({ data, accentColor, height = 64 }: { data: number[]; accentColor: string; height?: number }) {
  const max = Math.max(...data, 1);
  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
      {data.map((v, i) => (
        <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
          <View
            style={{
              width: '100%',
              height: `${Math.max((v / max) * 100, 5)}%`,
              backgroundColor: i === data.length - 1 ? accentColor : 'rgba(255,255,255,0.15)',
              borderRadius: 3,
            }}
          />
        </View>
      ))}
    </View>
  );
}

// ---- Pulse dot ----
function PulseDot({ color }: { color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withSpring(0.85, { damping: 10, stiffness: 100 });
    opacity.value = withSpring(0.5, { damping: 10, stiffness: 100 });
    const t1 = setTimeout(() => {
      scale.value = withSpring(1, { damping: 10, stiffness: 100 });
      opacity.value = withSpring(1, { damping: 10, stiffness: 100 });
    }, 800);
    const interval = setInterval(() => {
      scale.value = withSpring(0.85, { damping: 10, stiffness: 100 });
      opacity.value = withSpring(0.5, { damping: 10, stiffness: 100 });
      setTimeout(() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 100 });
        opacity.value = withSpring(1, { damping: 10, stiffness: 100 });
      }, 800);
    }, 1600);
    return () => { clearTimeout(t1); clearInterval(interval); };
  }, [scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { width: 8, height: 8, borderRadius: 4, backgroundColor: color, shadowColor: color, shadowOpacity: 1, shadowRadius: 6 },
        animStyle,
      ]}
    />
  );
}

// ---- Glass card tile ----
function GlassTile({
  badgeColor,
  badgeBg,
  label,
  children,
  delay = 0,
  style,
}: {
  badgeColor: string;
  badgeBg?: string;
  label: string;
  children: React.ReactNode;
  delay?: number;
  style?: any;
}) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(500)} style={style}>
      <View style={styles.tile}>
        <View style={styles.tileHeader}>
          <View style={[styles.iconBadge, { backgroundColor: badgeBg || badgeColor + '18' }]}>
            <View style={{ width: 14, height: 14, borderRadius: 3 }} />
          </View>
          <Text style={styles.tileLabel}>{label}</Text>
        </View>
        {children}
      </View>
    </Animated.View>
  );
}

// ---- Floating Bottom Nav ----
function FloatingBottomNav({
  active,
  onProperties,
  onConsole,
  onCassandra,
  onProfile,
  insets,
}: {
  active: string;
  onProperties: () => void;
  onConsole: () => void;
  onCassandra: () => void;
  onProfile: () => void;
  insets: any;
}) {
  const tabs = [
    { key: 'properties', label: 'Properties', icon: 'grid', iconFilled: 'grid' },
    { key: 'console', label: 'Console', icon: 'settings-outline', iconFilled: 'settings' },
    { key: 'cassandra', label: '', icon: '', iconFilled: '' },
    { key: 'profile', label: 'Profile', icon: 'person-outline', iconFilled: 'person' },
  ];

  return (
    <View style={[styles.floatingNav, { bottom: Math.max(insets.bottom, 16) + 16 }]}>
      <View style={styles.navPill}>
        {tabs.map((tab) => {
          if (tab.key === 'cassandra') {
            return (
              <TouchableOpacity key={tab.key} style={styles.cassandraOrbBtn} onPress={onCassandra} activeOpacity={0.8}>
                <View style={styles.cassandraOrb}>
                  <View style={styles.orbInner} />
                </View>
              </TouchableOpacity>
            );
          }
          const isActive = active === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.navBtn}
              onPress={
                tab.key === 'properties' ? onProperties :
                tab.key === 'console' ? onConsole :
                tab.key === 'profile' ? onProfile : undefined
              }
              activeOpacity={0.7}
            >
              <Ionicons
                name={(isActive ? tab.iconFilled : tab.icon) as any}
                size={20}
                color={isActive ? '#708F96' : 'rgba(255,255,255,0.40)'}
              />
              {tab.label && (
                <Text style={[styles.navText, isActive && styles.navTextActive]}>
                  {tab.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ---- Main Dashboard ----
export default function DashboardScreen() {
  return <DashboardInner />;
}

function DashboardInner() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const { membership, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [stats, setStats] = useState<DashboardStats>({
    ticketStats: { total: 0, open: 0, in_progress: 0, resolved: 0, pending_validation: 0, urgent_open: 0 },
    electricityUnits: 0,
    electricityUnitsToday: 0,
    visitorsToday: 0,
    checkedIn: 0,
    checkedOut: 0,
    vendorRevenue: 0,
    vendorCommission: 0,
    vendorCount: 0,
    recentTickets: [],
    dieselStats: { totalHoursToday: 0, avgFuelLevel: 0, activeGens: 0 },
    checklistStats: { doneToday: 0, pendingToday: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const propertyInfo = useMemo(() => {
    if (!membership) return { name: '', code: '' };
    const prop = membership.properties?.find((p) => p.id === propertyId);
    return {
      name: prop?.name ?? '',
      code: prop?.code ?? '',
    };
  }, [membership, propertyId]);

  const periodLabel = timePeriod === 'today' ? 'Today' : timePeriod === 'month' ? 'Month' : 'All';

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // 7-day sparkline data (mock for now — replace with real data)
  const ticketHistory = [206, 211, 210, 210, 207, 211, 209];
  const energyHistory = [35, 55, 70, 92, 78, 60, 45];

  const checklistTotal = (stats.checklistStats.doneToday ?? 0) + (stats.checklistStats.pendingToday ?? 4);
  const checklistPct = checklistTotal > 0 ? Math.round((stats.checklistStats.doneToday / checklistTotal) * 100) : 0;
  const healthStatus = stats.ticketStats.open > 15 ? 'critical' : stats.ticketStats.open > 5 ? 'warning' : 'good';
  const healthColor = healthStatus === 'critical' ? ACCENT_RED : healthStatus === 'warning' ? ACCENT_AMBER : SUCCESS_GREEN;

  const fetchStats = async () => {
    if (!propertyId) return;
    setIsLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      let dateFilter: string | undefined;
      if (timePeriod === 'today') dateFilter = todayStr;
      else if (timePeriod === 'month') dateFilter = monthStart;

      const [
        totalRes, openRes, inProgressRes, resolvedRes,
        pendingValRes, urgentOpenRes, recentRes,
        elecRes, checklistRes,
      ] = await Promise.all([
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).gte('created_at', dateFilter ?? '2000-01-01'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).in('status', ['open', 'blocked', 'client_raised']).gte('created_at', dateFilter ?? '2000-01-01'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).in('status', ['assigned', 'in_progress', 'paused', 'work_started']).gte('created_at', dateFilter ?? '2000-01-01'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).in('status', ['resolved', 'closed', 'satisfied', 'pending_validation']).gte('created_at', dateFilter ?? '2000-01-01'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('status', 'pending_validation').gte('created_at', dateFilter ?? '2000-01-01'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).in('priority', ['urgent', 'high', 'critical']).not('status', 'in', '("resolved","closed","satisfied")').gte('created_at', dateFilter ?? '2000-01-01'),
        supabase.from('tickets').select('id, title, status, priority, assigned_to_user:assigned_to(full_name)').eq('property_id', propertyId).order('created_at', { ascending: false }).limit(5),
        supabase.from('electricity_readings').select('computed_units, reading_date').eq('property_id', propertyId).gte('reading_date', monthStart),
        supabase.from('sop_completions').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).gte('completion_date', todayStr),
      ]);

      const monthUnits = elecRes.data?.reduce((acc: number, r: any) => acc + (r.computed_units || 0), 0) ?? 0;
      const todayUnits = elecRes.data?.filter((r: any) => r.reading_date === todayStr).reduce((acc: number, r: any) => acc + (r.computed_units || 0), 0) ?? 0;

      setStats((prev) => ({
        ...prev,
        ticketStats: {
          total: totalRes.count ?? 0,
          open: openRes.count ?? 0,
          in_progress: inProgressRes.count ?? 0,
          resolved: resolvedRes.count ?? 0,
          pending_validation: pendingValRes.count ?? 0,
          urgent_open: urgentOpenRes.count ?? 0,
        },
        electricityUnits: Math.round(monthUnits),
        electricityUnitsToday: Math.round(todayUnits),
        recentTickets: recentRes.data ?? [],
        checklistStats: {
          doneToday: checklistRes.count ?? 0,
          pendingToday: 4,
        },
      }));
    } catch (err) {
      console.error('[Dashboard] fetch error:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStats(); }, [propertyId, timePeriod]);
  const onRefresh = () => { setRefreshing(true); fetchStats(); };

  if (isLoading && stats.ticketStats.total === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: BG }]}>
        <ActivityIndicator size="large" color="#708F96" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  const active = 'properties';

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      {/* Full dark gradient canvas */}
      <LinearGradient
        colors={['#1a1a2e', '#0f0f1a', '#060912']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="rgba(255,255,255,0.6)" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <View style={styles.headerTopRow}>
            {/* Back button */}
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Title */}
            <View style={styles.titleGroup}>
              <Text style={styles.title}>{propertyInfo.name || 'Property'}</Text>
              <Text style={styles.subtitle}>
                {propertyInfo.code || 'PROP'} · {today}
              </Text>
            </View>

            {/* Right controls */}
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
                <Ionicons name="notifications-outline" size={18} color="rgba(255,255,255,0.7)" />
                <View style={styles.notifDot} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
                <Ionicons name="sunny-outline" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Time filter */}
          <View style={styles.filterRow}>
            {TIME_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.value}
                style={[styles.filterBtn, timePeriod === f.value && styles.filterBtnActive]}
                onPress={() => setTimePeriod(f.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, timePeriod === f.value && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Tickets Tile (full-width) ── */}
        <View style={styles.section}>
          <Animated.View entering={FadeInUp.delay(0.05).duration(500)}>
            <View style={styles.tile}>
              {/* Header */}
              <View style={styles.tileHeader}>
                <View style={[styles.iconBadge, { backgroundColor: ACCENT_AMBER + '18' }]}>
                  <Ionicons name="ticket-outline" size={14} color={ACCENT_AMBER} />
                </View>
                <Text style={styles.tileLabel}>TICKETS</Text>
              </View>
              {/* Body */}
              <View style={styles.tileBodyRow}>
                <View>
                  <Text style={styles.bigNumber}>{stats.ticketStats.total.toLocaleString()}</Text>
                  <Text style={styles.subText}>
                    {stats.ticketStats.open} open · {stats.ticketStats.in_progress} in progress
                  </Text>
                </View>
                <View style={{ flex: 1, paddingLeft: 24 }}>
                  <Sparkline data={ticketHistory} accentColor={ACCENT_AMBER} height={64} />
                </View>
              </View>
              {/* Footer */}
              <View style={styles.tileDivider} />
              <View style={styles.tileFooter}>
                <View style={styles.statusRow}>
                  <PulseDot color={CRITICAL_RED} />
                  <Text style={[styles.footerLabel, { color: CRITICAL_RED }]}>Critical</Text>
                </View>
                <Text style={styles.footerLabel}>{stats.ticketStats.urgent_open} urgent</Text>
              </View>
            </View>
          </Animated.View>

          {/* ── Checklist + Health row ── */}
          <View style={styles.twoColRow}>
            {/* Checklist */}
            <Animated.View entering={FadeInUp.delay(0.12).duration(500)} style={{ flex: 1 }}>
              <View style={styles.tile}>
                <View style={styles.tileHeader}>
                  <View style={[styles.iconBadge, { backgroundColor: ACCENT_GREEN + '18' }]}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={ACCENT_GREEN} />
                  </View>
                  <Text style={styles.tileLabel}>CHECKLIST</Text>
                </View>
                <Text style={styles.midNumber}>
                  {stats.checklistStats.doneToday}
                  <Text style={styles.midSuffix}> / {checklistTotal}</Text>
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${checklistPct}%`, backgroundColor: ACCENT_GREEN }]} />
                </View>
                <Text style={styles.subText}>{checklistPct}% completed</Text>
              </View>
            </Animated.View>

            {/* Health */}
            <Animated.View entering={FadeInUp.delay(0.18).duration(500)} style={{ flex: 1 }}>
              <View style={styles.tile}>
                <View style={styles.tileHeader}>
                  <View style={[styles.iconBadge, { backgroundColor: healthColor + '18' }]}>
                    <Ionicons name="heart-outline" size={14} color={healthColor} />
                  </View>
                  <Text style={styles.tileLabel}>HEALTH</Text>
                </View>
                <Text style={[styles.midNumber, { color: healthColor }]}>
                  {healthStatus === 'good' ? 'Optimal' : healthStatus === 'warning' ? 'Watch' : 'Critical'}
                </Text>
                <View style={[styles.healthDot, { backgroundColor: healthColor, shadowColor: healthColor }]} />
                <Text style={styles.subText}>{stats.ticketStats.open} open tickets</Text>
                <View style={styles.liveRow}>
                  <PulseDot color={SUCCESS_GREEN} />
                  <Text style={[styles.footerLabel, { marginLeft: 6 }]}>Live</Text>
                </View>
              </View>
            </Animated.View>
          </View>

          {/* ── Energy Tile (full-width) ── */}
          <Animated.View entering={FadeInUp.delay(0.24).duration(500)}>
            <View style={styles.tile}>
              <View style={styles.tileHeader}>
                <View style={[styles.iconBadge, { backgroundColor: ACCENT_AMBER + '18' }]}>
                  <Ionicons name="flash-outline" size={14} color={ACCENT_AMBER} />
                </View>
                <Text style={styles.tileLabel}>ENERGY USAGE</Text>
              </View>
              <View style={styles.tileBodyRow}>
                <View>
                  <Text style={styles.midNumber}>
                    {timePeriod === 'today' ? stats.electricityUnitsToday : stats.electricityUnits}
                    <Text style={styles.midSuffix}> kWh</Text>
                  </Text>
                  <View style={styles.trendChip}>
                    <View style={styles.trendDot} />
                    <Text style={styles.trendText}>+12%</Text>
                  </View>
                  <Text style={[styles.subText, { marginTop: 6 }]}>Grid + DG consumption</Text>
                </View>
                <View style={{ flex: 1, paddingLeft: 16 }}>
                  <Sparkline data={energyHistory} accentColor={ACCENT_AMBER} height={40} />
                  <Text style={[styles.chartLabel, { marginTop: 6 }]}>Last 7 days</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Floating Bottom Nav */}
      <FloatingBottomNav
        active={active}
        onProperties={() => {}}
        onConsole={() => {}}
        onCassandra={() => {}}
        onProfile={() => {}}
        insets={insets}
      />
    </View>
  );
}

// ---- Styles ----
const styles = StyleSheet.create({
  // Container
  container: { flex: 1 },
  scroll: { flex: 1, zIndex: 10 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontFamily: fontSans, fontSize: 15, color: 'rgba(255,255,255,0.55)' },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginBottom: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleGroup: { flex: 1 },
  title: {
    fontFamily: fontDisplay,
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.04 * 28,
  },
  subtitle: {
    fontFamily: fontSans,
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.01 * 14,
    marginTop: 2,
  },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CRITICAL_RED,
  },

  // Filter
  filterRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 980,
    padding: 4,
    alignSelf: 'flex-start',
    gap: 4,
  },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 980,
  },
  filterBtnActive: { backgroundColor: '#FFFFFF' },
  filterText: {
    fontFamily: fontSans,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  filterTextActive: { color: '#708F96' },

  // Section
  section: {
    paddingHorizontal: 20,
    gap: 12,
  },

  // Tile (glass card)
  tile: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 40,
    elevation: 4,
    overflow: 'hidden',
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileLabel: {
    fontFamily: fontSans,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.70)',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },

  // Tile body
  tileBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  bigNumber: {
    fontFamily: fontDisplay,
    fontSize: 72,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.04 * 72,
    lineHeight: 72,
  },
  midNumber: {
    fontFamily: fontDisplay,
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.04 * 48,
    lineHeight: 56,
  },
  midSuffix: {
    fontSize: 18,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: 0,
  },
  subText: {
    fontFamily: fontSans,
    fontSize: 14,
    color: 'rgba(255,255,255,0.60)',
    marginTop: 4,
  },
  chartLabel: {
    fontFamily: fontSans,
    fontSize: 12,
    color: 'rgba(255,255,255,0.40)',
    textAlign: 'right',
  },

  // Tile footer
  tileDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    marginTop: 16,
    paddingTop: 16,
  },
  tileFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerLabel: {
    fontFamily: fontSans,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.60)',
  },

  // Two column
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // Checklist
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Health
  healthDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginTop: 8,
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 4,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  // Energy
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(31,194,110,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  trendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SUCCESS_GREEN,
  },
  trendText: {
    fontFamily: fontSans,
    fontSize: 11,
    fontWeight: '700',
    color: SUCCESS_GREEN,
  },

  // Floating Bottom Nav
  floatingNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  navPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 980,
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 4,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navText: {
    fontFamily: fontSans,
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.40)',
    marginTop: 2,
  },
  navTextActive: { color: '#708F96' },
  cassandraOrbBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -8,
  },
  cassandraOrb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1a1a3e',
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(167,139,250,0.8)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 8,
  },
  orbInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(167,139,250,0.4)',
  },
});
