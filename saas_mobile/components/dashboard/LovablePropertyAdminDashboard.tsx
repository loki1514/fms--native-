import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWeather } from '@/hooks/useWeather';
import WeatherBackground from '@/components/dashboard/WeatherBackground';
import SafeBlurView from '@/components/ui/SafeBlurView';
import SignOutModal from '@/components/ui/SignOutModal';
import CassandraSessionModal from '@/components/cassandra/CassandraSessionModal';
import SidekickFace from '@/components/dashboard/SidekickFace';
import DetailModal, { type TileDetail } from '@/components/dashboard/DetailModal';
import { useCassandraStore } from '@/stores/cassandraStore';
import {
  SPACING,
  TYPOGRAPHY,
  STATUS_COLORS,
  CARD_SURFACES,
} from '@/constants/designSystem';

const fontSans = 'System';
const fontDisplay = 'System';
const BG = '#060912';

type TabKey = 'overview' | 'users' | 'visitors' | 'settings';

interface Props {
  propertyId: string;
}

// ─── Pulse Dot ────────────────────────────────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  return (
    <View
      style={[
        styles.pulseDot,
        { backgroundColor: color, shadowColor: color, shadowOpacity: 0.8, shadowRadius: 6 },
      ]}
    />
  );
}

// ─── Glass Tile ───────────────────────────────────────────────────────────────
function GlassTile({
  label,
  icon,
  children,
  onPress,
  delay,
  status,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  onPress?: () => void;
  delay: number;
  status?: 'optimal' | 'watch' | 'critical';
}) {
  const statusColor = status ? STATUS_COLORS[status].bg : undefined;

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(500)} style={{ flex: 1 }}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.tileWrapper}>
        <SafeBlurView intensity={40} style={styles.tileBlur} tint="dark">
          <LinearGradient
            colors={
              status === 'critical'
                ? ['rgba(217,38,28,0.20)', 'rgba(25,20,50,0.3)']
                : status === 'watch'
                ? ['rgba(196,160,0,0.20)', 'rgba(25,20,50,0.3)']
                : ['rgba(255,255,255,0.06)', 'rgba(25,20,50,0.2)']
            }
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.tileContent}>
            <View style={styles.tileHeader}>
              <View style={styles.iconBadge}>
                <Ionicons name={icon} size={14} color="#FFFFFF" />
              </View>
              <Text style={styles.tileLabel}>{label.toUpperCase()}</Text>
              {status && <PulseDot color={statusColor!} />}
            </View>
            <View style={styles.tileBody}>{children}</View>
          </View>
        </SafeBlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────
function MiniBarChart({ data, highlightColor }: { data: number[]; highlightColor?: string }) {
  const max = Math.max(...data, 1);
  return (
    <View style={styles.barChart}>
      {data.map((v, i) => (
        <View key={i} style={styles.barCol}>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  height: `${Math.max((v / max) * 100, 5)}%`,
                  backgroundColor:
                    i === data.length - 1 ? highlightColor || 'rgba(112,143,150,0.80)' : 'rgba(0,0,0,0.12)',
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <View style={styles.progressBar}>
      <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: color }]} />
    </View>
  );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────
function TabButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={active ? '#FFFFFF' : 'rgba(255,255,255,0.40)'} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── User Card ────────────────────────────────────────────────────────────────
function UserCard({ user }: { user: any }) {
  return (
    <View style={styles.listCard}>
      <View style={styles.listAvatar}>
        <Text style={styles.listAvatarText}>
          {(user.full_name ?? user.email ?? 'U').charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.listName}>{user.full_name || 'Unknown'}</Text>
        <Text style={styles.listMeta}>{user.email}</Text>
        <Text style={styles.listRole}>{user.role || 'Member'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.30)" />
    </View>
  );
}

// ─── Visitor Card ─────────────────────────────────────────────────────────────
function VisitorCard({ visitor }: { visitor: any }) {
  return (
    <View style={styles.listCard}>
      <View style={styles.listAvatar}>
        <Text style={styles.listAvatarText}>{(visitor.name ?? 'V').charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.listName}>{visitor.name || 'Guest'}</Text>
        <Text style={styles.listMeta}>{visitor.purpose || 'General Visit'}</Text>
        <Text style={styles.listRole}>{visitor.status || 'Checked In'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.30)" />
    </View>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function LovablePropertyAdminDashboard({ propertyId }: Props) {
  const { user, signOut, membership } = useAuth();
  const insets = useSafeAreaInsets();
  const { weather } = useWeather();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [showTileDetail, setShowTileDetail] = useState<TileDetail | null>(null);

  // Data state
  const [tickets, setTickets] = useState<any[]>([]);
  const [sopCount, setSopCount] = useState(0);
  const [sopTotal, setSopTotal] = useState(0);
  const [energyKwh, setEnergyKwh] = useState(0);
  const [energyTrend, setEnergyTrend] = useState(12);
  const [propertyUsers, setPropertyUsers] = useState<any[]>([]);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [propertyName, setPropertyName] = useState('Property');

  // Cassandra voice state
  const voiceState = useCassandraStore((s) => s.voiceState);
  const faceState: any = (() => {
    if (voiceState === 'recording' || voiceState === 'processing' || voiceState === 'connecting') return 'listening';
    if (voiceState === 'speaking') return 'speaking';
    if (voiceState === 'error') return 'alert';
    return 'idle';
  })();

  const orgId = membership?.org_id ?? '';

  const fetchData = useCallback(async () => {
    if (!propertyId) return;
    const supabase = createClient();

    try {
      // Property details
      const { data: propData } = await supabase
        .from('properties')
        .select('name')
        .eq('id', propertyId)
        .single();
      if (propData) setPropertyName((propData as any).name);

      // Tickets
      const { data: ticketData } = await supabase
        .from('tickets')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });
      if (ticketData) setTickets(ticketData);

      // SOP completions
      const { data: sopData } = await supabase
        .from('sop_completions')
        .select('status')
        .eq('property_id', propertyId);
      if (sopData) {
        setSopTotal(sopData.length);
        setSopCount(sopData.filter((s: any) => s.status === 'completed').length);
      }

      // Electricity
      const { data: elecData } = await supabase
        .from('electricity_readings')
        .select('final_units')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (elecData) setEnergyKwh(Math.round((elecData as any).final_units || 0));

      // Users
      const { data: userData } = await supabase
        .from('property_memberships')
        .select('user_id, role, users(full_name, email, phone)')
        .eq('property_id', propertyId)
        .eq('is_active', true);
      if (userData) {
        setPropertyUsers(
          userData.map((u: any) => ({
            id: u.user_id,
            full_name: u.users?.full_name,
            email: u.users?.email,
            phone: u.users?.phone,
            role: u.role,
          }))
        );
      }

      // Visitors (today)
      const today = new Date().toISOString().split('T')[0];
      const { data: visitorData } = await supabase
        .from('visitors')
        .select('*')
        .eq('property_id', propertyId)
        .gte('check_in_time', today)
        .order('check_in_time', { ascending: false });
      if (visitorData) setVisitors(visitorData);
    } catch (_) {
      {/* silent */}
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  // Stats
  const openTickets = useMemo(() => tickets.filter((t) => ['open', 'blocked', 'client_raised'].includes(t.status)).length, [tickets]);
  const resolvedTickets = useMemo(() => tickets.filter((t) => ['resolved', 'closed', 'satisfied'].includes(t.status)).length, [tickets]);
  const totalTickets = tickets.length;
  const healthStatus: 'optimal' | 'watch' | 'critical' = openTickets > 15 ? 'critical' : openTickets > 5 ? 'watch' : 'optimal';
  const healthColor = STATUS_COLORS[healthStatus].bg;
  const checklistPct = sopTotal > 0 ? Math.round((sopCount / sopTotal) * 100) : 100;

  // Mock 7-day history for sparklines
  const ticketHistory = useMemo(() => {
    return [12, 18, 15, 22, 19, 25, openTickets || 14];
  }, [openTickets]);

  const energyHistory = useMemo(() => {
    return [35, 55, 70, 92, 78, 60, 45];
  }, []);

  // Tile detail data
  const tileDetails: Record<string, TileDetail> = {
    tickets: {
      id: 'tickets',
      iconName: 'ticket',
      label: 'Tickets',
      title: `${propertyName} · Tickets`,
      metrics: [
        { label: 'Open', value: openTickets.toString() },
        { label: 'Resolved', value: resolvedTickets.toString() },
        { label: 'Total', value: totalTickets.toString() },
      ],
      chartTitle: '7-Day Volume',
      chartData: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ({ label: d, value: ticketHistory[i] })),
      chartColor: '#3B82F6',
      trendDirection: openTickets > 10 ? 'up' : 'down',
      trendLabel: `${openTickets} open tickets`,
      breakdownTitle: 'Status Breakdown',
      breakdown: [
        { label: 'Open', value: openTickets, color: STATUS_COLORS.critical.bg },
        { label: 'Resolved', value: resolvedTickets, color: STATUS_COLORS.optimal.bg },
        { label: 'Total', value: totalTickets, color: '#3B82F6' },
      ],
      aiAnalysis: openTickets > 15
        ? 'Critical ticket backlog detected. Immediate staff reallocation recommended to meet SLA targets.'
        : 'Ticket volume is within normal operating parameters. Focus on maintaining resolution speed.',
    },
    checklist: {
      id: 'checklist',
      iconName: 'checkbox-outline',
      label: 'Checklist',
      title: `${propertyName} · Daily Checklist`,
      metrics: [
        { label: 'Completed', value: sopCount.toString() },
        { label: 'Total', value: sopTotal.toString() },
        { label: 'Success %', value: `${checklistPct}%` },
      ],
      chartTitle: 'Completion Trend',
      chartData: [
        { label: 'Goal', value: 100 },
        { label: 'Current', value: checklistPct },
      ],
      chartColor: STATUS_COLORS.optimal.bg,
      trendDirection: 'up',
      trendLabel: `${checklistPct}% compliance`,
      breakdownTitle: 'Completion Status',
      breakdown: [
        { label: 'Completed', value: sopCount, color: STATUS_COLORS.optimal.bg },
        { label: 'Pending', value: Math.max(0, sopTotal - sopCount), color: STATUS_COLORS.watch.bg },
      ],
      aiAnalysis: checklistPct > 90
        ? 'Operational compliance is excellent. Teams are following standard procedures consistently.'
        : 'Checklist completion is below target. Review pending tasks and assign additional resources.',
    },
    health: {
      id: 'health',
      iconName: 'heart',
      label: 'Health',
      title: `${propertyName} · Facility Health`,
      metrics: [
        { label: 'Open Issues', value: openTickets.toString() },
        { label: 'Status', value: healthStatus.toUpperCase() },
        { label: 'Trend', value: openTickets > 5 ? 'Declining' : 'Stable' },
      ],
      chartTitle: 'Health Index',
      chartData: [
        { label: 'Risk', value: Math.min(openTickets * 5, 100) },
        { label: 'Healthy', value: Math.max(0, 100 - openTickets * 5) },
      ],
      chartColor: healthColor,
      trendDirection: openTickets > 5 ? 'down' : 'up',
      trendLabel: 'Real-time index',
      breakdownTitle: 'Health Components',
      breakdown: [
        { label: 'Tickets', value: openTickets, color: healthColor },
        { label: 'SOP Compliance', value: `${checklistPct}%`, color: STATUS_COLORS.optimal.bg },
      ],
      aiAnalysis: healthStatus === 'critical'
        ? 'Facility health has declined significantly. High open ticket count is the primary driver. Schedule emergency review.'
        : 'Facility health is stable. Continue monitoring ticket resolution rates and SOP compliance.',
    },
    energy: {
      id: 'energy',
      iconName: 'flash',
      label: 'Energy',
      title: `${propertyName} · Energy Consumption`,
      metrics: [
        { label: 'Today (kWh)', value: energyKwh.toString() },
        { label: 'Trend', value: `${energyTrend > 0 ? '+' : ''}${energyTrend}%` },
        { label: 'Peak', value: '14:00' },
      ],
      chartTitle: 'Hourly Consumption',
      chartData: ['06', '09', '12', '15', '18', '21', '00'].map((d, i) => ({ label: d, value: energyHistory[i] })),
      chartColor: '#FFD60A',
      trendDirection: energyTrend > 0 ? 'up' : 'down',
      trendLabel: `${Math.abs(energyTrend)}% vs avg`,
      breakdownTitle: 'Source Mix',
      breakdown: [
        { label: 'Grid', value: '68%', color: '#3B82F6' },
        { label: 'DG', value: '24%', color: '#C4A000' },
        { label: 'Solar', value: '8%', color: '#1FC26E' },
      ],
      aiAnalysis: energyTrend > 10
        ? 'Energy consumption is trending higher than average. Inspect heavy loads or check for utility leakage.'
        : 'Energy consumption is stable and matches historical patterns.',
    },
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#1c2135', '#0f121e', '#07090e']} style={StyleSheet.absoluteFillObject} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#708F96" />
          <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 16 }}>Loading...</Text>
        </View>
      </View>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            {/* Tickets Tile */}
            <GlassTile label="Tickets" icon="ticket" delay={100} status={healthStatus} onPress={() => setShowTileDetail(tileDetails.tickets)}>
              <View style={styles.tileTopRow}>
                <View>
                  <Text style={styles.tileMetricBig}>{totalTickets}</Text>
                  <Text style={styles.tileSubtext}>{openTickets} open · {resolvedTickets} resolved</Text>
                </View>
                <MiniBarChart data={ticketHistory} />
              </View>
            </GlassTile>

            {/* Checklist + Health Row */}
            <View style={styles.rowTwo}>
              <GlassTile label="Checklist" icon="checkbox-outline" delay={180} onPress={() => setShowTileDetail(tileDetails.checklist)}>
                <Text style={styles.tileMetricMid}>
                  {sopCount} <Text style={styles.tileSuffix}>/ {sopTotal}</Text>
                </Text>
                <ProgressBar percent={checklistPct} color={STATUS_COLORS.optimal.bg} />
                <Text style={styles.tileSubtext}>{checklistPct}% completed</Text>
              </GlassTile>

              <GlassTile label="Health" icon="heart" delay={240} status={healthStatus} onPress={() => setShowTileDetail(tileDetails.health)}>
                <Text style={[styles.tileMetricMid, { color: healthColor }]}>
                  {healthStatus === 'optimal' ? 'Optimal' : healthStatus === 'watch' ? 'Watch' : 'Critical'}
                </Text>
                <View style={[styles.healthDotLarge, { backgroundColor: healthColor, shadowColor: healthColor }]} />
                <Text style={styles.tileSubtext}>Facility Status</Text>
              </GlassTile>
            </View>

            {/* Energy Tile */}
            <GlassTile label="Energy Usage" icon="flash" delay={300} status={energyTrend > 10 ? 'watch' : 'optimal'} onPress={() => setShowTileDetail(tileDetails.energy)}>
              <View style={styles.tileTopRow}>
                <View>
                  <Text style={styles.tileMetricMid}>
                    {energyKwh} <Text style={styles.tileSuffix}>kWh</Text>
                  </Text>
                  <Text style={styles.tileSubtext}>Grid + DG consumption today</Text>
                </View>
                <View style={styles.trendChip}>
                  <Ionicons name={energyTrend > 0 ? 'trending-up' : 'trending-down'} size={12} color="#1FC26E" />
                  <Text style={styles.trendChipText}>+{energyTrend}%</Text>
                </View>
              </View>
              <MiniBarChart data={energyHistory} highlightColor="rgba(214,158,46,0.85)" />
            </GlassTile>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickBtn} onPress={() => setShowChat(true)}>
                <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
                <Text style={styles.quickText}>Ask Cassandra</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtn} onPress={() => router.push(`/property/${propertyId}/users`)}>
                <Ionicons name="people" size={20} color="#FFFFFF" />
                <Text style={styles.quickText}>Users</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtn} onPress={() => router.push(`/property/${propertyId}/visitors`)}>
                <Ionicons name="person-add" size={20} color="#FFFFFF" />
                <Text style={styles.quickText}>Visitors</Text>
              </TouchableOpacity>
            </View>
          </>
        );

      case 'users':
        return (
          <View style={{ paddingHorizontal: SPACING.xl }}>
            {propertyUsers.map((u) => (
              <UserCard key={u.id} user={u} />
            ))}
            {propertyUsers.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={40} color="rgba(255,255,255,0.20)" />
                <Text style={styles.emptyText}>No users found</Text>
              </View>
            )}
          </View>
        );

      case 'visitors':
        return (
          <View style={{ paddingHorizontal: SPACING.xl }}>
            {visitors.map((v, i) => (
              <VisitorCard key={v.id ?? i} visitor={v} />
            ))}
            {visitors.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="person-outline" size={40} color="rgba(255,255,255,0.20)" />
                <Text style={styles.emptyText}>No visitors today</Text>
              </View>
            )}
          </View>
        );

      case 'settings':
        return (
          <View style={{ paddingHorizontal: SPACING.xl }}>
            <View style={styles.settingsCard}>
              <TouchableOpacity style={styles.settingsRow} onPress={() => router.push(`/property/${propertyId}/settings`)}>
                <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.60)" />
                <Text style={styles.settingsText}>Property Settings</Text>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.30)" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingsRow} onPress={() => router.push(`/property/${propertyId}/diesel`)}>
                <Ionicons name="water-outline" size={20} color="rgba(255,255,255,0.60)" />
                <Text style={styles.settingsText}>Diesel Logger</Text>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.30)" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingsRow} onPress={() => router.push(`/property/${propertyId}/electricity`)}>
                <Ionicons name="flash-outline" size={20} color="rgba(255,255,255,0.60)" />
                <Text style={styles.settingsText}>Electricity Logger</Text>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.30)" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingsRow} onPress={() => setShowSignOut(true)}>
                <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
                <Text style={[styles.settingsText, { color: '#FF3B30' }]}>Sign Out</Text>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.30)" />
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1c2135', '#0f121e', '#07090e']} style={StyleSheet.absoluteFillObject} />
      {weather && <WeatherBackground condition={weather.condition} />}

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="rgba(255,255,255,0.6)" />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
      >
        {/* Header */}
        <Animated.View entering={FadeInUp.duration(500)} style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{propertyName}</Text>
            <Text style={styles.headerSubtitle}>Property Admin Dashboard</Text>
          </View>
          <TouchableOpacity style={styles.signOutBtn} onPress={() => setShowSignOut(true)}>
            <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.60)" />
          </TouchableOpacity>
        </Animated.View>

        {/* Tabs */}
        <Animated.View entering={FadeInUp.delay(60).duration(500)} style={styles.tabsRow}>
          <TabButton label="Overview" icon="grid" active={activeTab === 'overview'} onPress={() => setActiveTab('overview')} />
          <TabButton label="Users" icon="people" active={activeTab === 'users'} onPress={() => setActiveTab('users')} />
          <TabButton label="Visitors" icon="person-add" active={activeTab === 'visitors'} onPress={() => setActiveTab('visitors')} />
          <TabButton label="Settings" icon="settings" active={activeTab === 'settings'} onPress={() => setActiveTab('settings')} />
        </Animated.View>

        {/* Tab Content */}
        <View style={{ marginTop: SPACING.lg }}>{renderTabContent()}</View>
      </ScrollView>

      {/* Floating bottom nav with Cassandra */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16 }]}>
        <SafeBlurView intensity={40} style={styles.bottomNavBlur} tint="dark">
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('overview')}>
            <Ionicons name={activeTab === 'overview' ? 'grid' : 'grid-outline'} size={22} color={activeTab === 'overview' ? '#FFFFFF' : 'rgba(255,255,255,0.40)'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('users')}>
            <Ionicons name={activeTab === 'users' ? 'people' : 'people-outline'} size={22} color={activeTab === 'users' ? '#FFFFFF' : 'rgba(255,255,255,0.40)'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navOrb} onPress={() => setShowChat(true)}>
            <SidekickFace size={48} state={faceState} compact />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('visitors')}>
            <Ionicons name={activeTab === 'visitors' ? 'person-add' : 'person-add-outline'} size={22} color={activeTab === 'visitors' ? '#FFFFFF' : 'rgba(255,255,255,0.40)'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('settings')}>
            <Ionicons name={activeTab === 'settings' ? 'settings' : 'settings-outline'} size={22} color={activeTab === 'settings' ? '#FFFFFF' : 'rgba(255,255,255,0.40)'} />
          </TouchableOpacity>
        </SafeBlurView>
      </View>

      {/* Modals */}
      <CassandraSessionModal visible={showChat} onClose={() => setShowChat(false)} orgId={orgId} />
      <SignOutModal isOpen={showSignOut} onClose={() => setShowSignOut(false)} onConfirm={signOut} />
      <DetailModal detail={showTileDetail} onClose={() => setShowTileDetail(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1, zIndex: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  headerTitle: {
    fontFamily: fontDisplay,
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontFamily: fontSans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  signOutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(112,143,150,0.25)',
  },
  tabText: {
    fontFamily: fontSans,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.40)',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tileWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: CARD_SURFACES.cardBorder,
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    minHeight: 160,
  },
  tileBlur: {
    flex: 1,
    minHeight: 160,
  },
  tileContent: {
    padding: 20,
    flex: 1,
    justifyContent: 'space-between',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileLabel: {
    fontFamily: fontSans,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.70)',
    letterSpacing: 2,
    flex: 1,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  tileBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  tileTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  tileMetricBig: {
    fontFamily: fontDisplay,
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1.5,
  },
  tileMetricMid: {
    fontFamily: fontDisplay,
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  tileSuffix: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.40)',
  },
  tileSubtext: {
    fontFamily: fontSans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.50)',
    marginTop: 4,
  },
  rowTwo: {
    flexDirection: 'row',
    gap: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  healthDotLarge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginTop: SPACING.sm,
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    height: 50,
    width: 90,
  },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 2, minHeight: 2 },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignSelf: 'flex-start',
  },
  trendChipText: {
    fontFamily: fontSans,
    fontSize: 12,
    fontWeight: '700',
    color: '#1FC26E',
  },
  quickActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.xl,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: CARD_SURFACES.cardBg,
    borderWidth: 1,
    borderColor: CARD_SURFACES.cardBorder,
    gap: 6,
  },
  quickText: {
    fontFamily: fontSans,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.70)',
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_SURFACES.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_SURFACES.cardBorder,
    padding: 14,
    marginBottom: 12,
  },
  listAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listAvatarText: {
    fontFamily: fontDisplay,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  listName: {
    fontFamily: fontSans,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listMeta: {
    fontFamily: fontSans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.50)',
    marginTop: 2,
  },
  listRole: {
    fontFamily: fontSans,
    fontSize: 11,
    fontWeight: '600',
    color: '#708F96',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontFamily: fontSans,
    fontSize: 15,
    color: 'rgba(255,255,255,0.40)',
    marginTop: 12,
  },
  settingsCard: {
    backgroundColor: CARD_SURFACES.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_SURFACES.cardBorder,
    padding: SPACING.lg,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  settingsText: {
    fontFamily: fontSans,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    zIndex: 20,
  },
  bottomNavBlur: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 12,
    overflow: 'hidden',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  navOrb: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
});
