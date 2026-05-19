import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Modal,
  Image,
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
import MobileFooter from '@/components/shared/MobileFooter';
import { useCassandraStore } from '@/stores/cassandraStore';
import {
  SPACING,
  TYPOGRAPHY,
  STATUS_COLORS,
  CARD_SURFACES,
} from '@/constants/designSystem';
import {
  PulseDot,
  GlassTile,
  MiniBarChart,
  ProgressBar,
  AttentionCard,
} from './DashboardComponents';
import { TicketCreateModal } from '../tickets/TicketCreateModal';

const fontSans = Platform.select({ web: 'system-ui, -apple-system, sans-serif', ios: 'System', android: 'sans-serif', default: 'System' });
const fontDisplay = Platform.select({ web: '"SF Pro Display", system-ui, -apple-system, sans-serif', ios: 'System', android: 'sans-serif', default: 'System' });
const BG = '#121212';

type TabKey = 'overview';

interface Props {
  propertyId: string;
  onBack?: () => void;
}

export default function LovablePropertyAdminDashboard({ propertyId, onBack }: Props) {
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
  const [showDrawer, setShowDrawer] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);

  // Data state
  const [tickets, setTickets] = useState<any[]>([]);
  const [sopCount, setSopCount] = useState(0);
  const [sopTotal, setSopTotal] = useState(0);
  const [energyKwh, setEnergyKwh] = useState(0);
  const [energyTrend, setEnergyTrend] = useState(12);
  const [propertyName, setPropertyName] = useState('Property');

  // New stats state
  const [vmsStats, setVmsStats] = useState({ total: 0, in: 0, out: 0 });
  const [vendorStats, setVendorStats] = useState({ revenue: 0, commission: 0 });
  const [dieselStats, setDieselStats] = useState({ level: 0, consumption: 0 });

  // Leadership cockpit state
  const [healthScore, setHealthScore] = useState<any>(null);
  const [attentionItems, setAttentionItems] = useState<any[]>([]);
  const [ticketFunnel, setTicketFunnel] = useState<any[]>([]);
  const [ticketTimeFilter, setTicketTimeFilter] = useState<'today' | 'month' | 'all'>('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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

      // Health score
      const { data: healthData } = await supabase.rpc('get_property_health_score', {
        p_property_id: propertyId,
      });
      if (healthData) setHealthScore(healthData);

      // Attention items
      const { data: attentionData } = await supabase.rpc('get_attention_items', {
        p_property_id: propertyId,
        p_limit: 10,
      });
      if (attentionData) setAttentionItems(attentionData);

      // Ticket funnel
      const { data: funnelData } = await supabase.rpc('get_ticket_funnel', {
        p_property_id: propertyId,
        p_days: 30,
      });
      if (funnelData) setTicketFunnel(funnelData);

      // --- NEW: VMS Summary ---
      const { data: vmsData } = await supabase
        .from('visitor_logs')
        .select('status', { count: 'exact' })
        .eq('property_id', propertyId);
      
      if (vmsData) {
        const total = vmsData.length;
        const checkedIn = vmsData.filter((v: any) => v.status === 'checked_in').length;
        const checkedOut = vmsData.filter((v: any) => v.status === 'checked_out').length;
        setVmsStats({ total, in: checkedIn, out: checkedOut });
      }

      // --- NEW: Vendor Revenue ---
      const { data: revData } = await supabase
        .from('vendor_daily_revenue')
        .select('revenue_amount, vendor_id')
        .eq('property_id', propertyId);
      
      if (revData) {
        const totalRev = revData.reduce((acc, row) => acc + (row.revenue_amount || 0), 0);
        // Simplified commission calculation (10% avg if vendors table not joined)
        setVendorStats({ revenue: totalRev, commission: totalRev * 0.1 });
      }

      // --- NEW: Diesel Level ---
      const { data: dieselData } = await supabase
        .from('diesel_readings')
        .select('current_fuel_level')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (dieselData) {
        setDieselStats({ level: (dieselData as any).current_fuel_level || 0, consumption: 0 });
      }

    } catch (_) {
      {/* silent */}
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setLastUpdated(new Date());
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
  const filteredTickets = useMemo(() => {
    const now = new Date();
    if (ticketTimeFilter === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      return tickets.filter((t) => t.created_at?.startsWith(todayStr));
    }
    if (ticketTimeFilter === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      return tickets.filter((t) => t.created_at >= monthStart);
    }
    return tickets;
  }, [tickets, ticketTimeFilter]);

  const openTickets = useMemo(() => 
    filteredTickets.filter((t) => ['open', 'assigned', 'in_progress', 'pending_validation', 'client_raised', 'waitlist'].includes(t.status)).length, 
    [filteredTickets]
  );
  const resolvedTickets = useMemo(() => 
    filteredTickets.filter((t) => ['resolved', 'closed', 'satisfied'].includes(t.status)).length, 
    [filteredTickets]
  );
  const totalTickets = filteredTickets.length;

  // Dynamically compute funnel from filtered tickets
  const dynamicFunnel = useMemo(() => {
    const counts: Record<string, number> = {
      'assigned': 0,
      'in_progress': 0,
      'pending_validation': 0,
      'closed': 0,
    };
    filteredTickets.forEach(t => {
      if (counts.hasOwnProperty(t.status)) counts[t.status]++;
    });
    return Object.entries(counts).map(([status, count]) => ({
      status_label: status,
      ticket_count: count
    }));
  }, [filteredTickets]);
  const healthStatus: 'optimal' | 'watch' | 'critical' = openTickets > 15 ? 'critical' : openTickets > 5 ? 'watch' : 'optimal';
  const healthColor = STATUS_COLORS[healthStatus].bg;
  const checklistPct = sopTotal > 0 ? Math.round((sopCount / sopTotal) * 100) : 100;
  
  // Stats for VMS and Vendor
  const pendingValidationCount = useMemo(() => tickets.filter(t => t.status === 'pending_validation').length, [tickets]);

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
        <LinearGradient colors={['#1a1a1a', '#121212', '#0a0a0a']} style={StyleSheet.absoluteFillObject} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#708F96" />
          <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 16 }}>Loading...</Text>
        </View>
      </View>
    );
  }

  const renderTabContent = () => (
    <>
      <GlassTile label="Tickets" icon="ticket" delay={80} status={healthStatus} onPress={() => setShowTileDetail(tileDetails.tickets)}>
        <View style={styles.timeToggleRow}>
          {(['today', 'month', 'all'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.timeToggleBtn, ticketTimeFilter === f && styles.timeToggleBtnActive]}
              onPress={() => setTicketTimeFilter(f)}
              activeOpacity={0.7}
            >
              <Text style={[styles.timeToggleText, ticketTimeFilter === f && styles.timeToggleTextActive]}>
                {f === 'today' ? 'Today' : f === 'month' ? 'This Month' : 'All Time'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <View style={{ alignItems: 'flex-start' }}>
            <Text style={styles.tileMetricMid}>{totalTickets}</Text>
            <Text style={[styles.tileSubtext, { marginTop: 0, fontSize: 10, letterSpacing: 1 }]}>TOTAL</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.tileMetricMid, { color: '#FCA5A5' }]}>{openTickets}</Text>
            <Text style={[styles.tileSubtext, { marginTop: 0, fontSize: 10, letterSpacing: 1 }]}>OPEN</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.tileMetricMid, { color: '#10B981' }]}>{resolvedTickets}</Text>
            <Text style={[styles.tileSubtext, { marginTop: 0, fontSize: 10, letterSpacing: 1 }]}>CLOSED</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {dynamicFunnel.map((f: any) => {
            const shortLabel = f.status_label?.replace(/_/g, ' ')?.replace(/pending validation/i, 'Pending')?.replace(/assigned/i, 'Assigned')?.replace(/closed/i, 'Closed')?.replace(/waitlist/i, 'Waitlist')?.replace(/open/i, 'Open')?.replace(/resolved/i, 'Resolved')?.replace(/in progress/i, 'In Progress') || f.status_label;
            return (
              <View key={f.status_label} style={{ flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 2, overflow: 'hidden' }}>
                <Text style={{ fontFamily: fontDisplay, fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>{f.ticket_count}</Text>
                <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontFamily: fontSans, fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginTop: 2, textAlign: 'center', maxWidth: '100%' }}>{shortLabel}</Text>
              </View>
            );
          })}
        </View>
      </GlassTile>

      {healthScore && (
        <Animated.View entering={FadeInUp.delay(120).duration(500)}>
          <TouchableOpacity activeOpacity={0.9} style={[styles.tileWrapper, { minHeight: 64, marginHorizontal: SPACING.xl, marginBottom: 12, borderRadius: 20, overflow: 'hidden' }]} onPress={() => setShowTileDetail(tileDetails.health)}>
            <SafeBlurView intensity={70} style={{ minHeight: 64 }} tint="dark">
              <View style={[styles.tileContent, { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }]}>
                <View style={[styles.healthDot, { width: 10, height: 10, borderRadius: 5, backgroundColor: (healthScore.score ?? 0) >= 80 ? '#10B981' : (healthScore.score ?? 0) >= 50 ? '#F59E0B' : '#EF4444' }]} />
                <Text style={{ fontFamily: fontSans, fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>HEALTH</Text>
                <Text style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: '700', color: '#FFF' }}>{healthScore.score ?? 0}</Text>
                <Text style={{ fontFamily: fontSans, fontSize: 12, color: healthColor, fontWeight: '600' }}>{(healthScore.score ?? 0) >= 80 ? 'Excellent' : (healthScore.score ?? 0) >= 50 ? 'Needs Attention' : 'Critical'}</Text>
                <View style={{ flex: 1 }} />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                   <View style={{ alignItems: 'center' }}><Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>{healthScore.total_open ?? 0}</Text><Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>Open</Text></View>
                   <View style={{ alignItems: 'center' }}><Text style={{ color: '#F59E0B', fontSize: 13, fontWeight: '700' }}>{healthScore.sla_risk ?? 0}</Text><Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>Risk</Text></View>
                </View>
              </View>
            </SafeBlurView>
          </TouchableOpacity>
        </Animated.View>
      )}

      {attentionItems.length > 0 && (
        <>
          <Animated.View entering={FadeInUp.delay(160).duration(500)} style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.md }}>
            <Text style={{ fontFamily: fontSans, fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 2, textTransform: 'uppercase' }}>⚠️ NEEDS ATTENTION</Text>
          </Animated.View>
          {attentionItems.slice(0, 3).map((item, index) => (
            <AttentionCard key={item.id} item={item} index={index} onAction={() => item.entity_type === 'ticket' && router.push(`/property/${propertyId}/tickets/${item.entity_id}`)} />
          ))}
        </>
      )}

      <GlassTile label="Checklist" icon="checkbox-outline" delay={200} onPress={() => setShowTileDetail(tileDetails.checklist)}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.tileMetricMid}>{sopCount} <Text style={styles.tileSuffix}>/ {sopTotal}</Text></Text>
            <Text style={styles.tileSubtext}>{checklistPct}% completed</Text>
          </View>
          <ProgressBar percent={checklistPct} color={STATUS_COLORS.optimal.bg} />
        </View>
      </GlassTile>

      <GlassTile label="Energy Usage" icon="flash" delay={280} status={energyTrend > 10 ? 'watch' : 'optimal'} onPress={() => setShowTileDetail(tileDetails.energy)}>
        <View style={styles.tileTopRow}><View><Text style={styles.tileMetricMid}>{energyKwh} <Text style={styles.tileSuffix}>kWh</Text></Text><Text style={styles.tileSubtext}>Grid + DG consumption today</Text></View><View style={styles.trendChip}><Ionicons name={energyTrend > 0 ? 'trending-up' : 'trending-down'} size={12} color="#1FC26E" /><Text style={styles.trendChipText}>+{energyTrend}%</Text></View></View>
        <MiniBarChart data={energyHistory} highlightColor="rgba(214,158,46,0.85)" />
      </GlassTile>

      {/* NEW: Visitor Stats Tile */}
      <GlassTile label="Visitors" icon="people-outline" delay={320} onPress={() => router.push(`/property/${propertyId}/visitors`)}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.tileMetricMid}>{vmsStats.total}</Text>
            <Text style={styles.tileSubtext}>Total Visitors</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#10B981', fontWeight: '700' }}>{vmsStats.in}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>IN</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '700' }}>{vmsStats.out}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>OUT</Text>
            </View>
          </View>
        </View>
      </GlassTile>

      {/* NEW: Vendor Revenue Tile */}
      <GlassTile label="Cafeteria Revenue" icon="fast-food-outline" delay={360} onPress={() => router.push(`/property/${propertyId}/vendor`)}>
        <View style={styles.tileTopRow}>
          <View>
            <Text style={styles.tileMetricMid}>₹{vendorStats.revenue.toLocaleString()}</Text>
            <Text style={styles.tileSubtext}>Total Revenue</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#F59E0B', fontSize: 16, fontWeight: '800' }}>₹{Math.round(vendorStats.commission).toLocaleString()}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>COMMISSION</Text>
          </View>
        </View>
      </GlassTile>

      {/* NEW: Diesel Level Tile */}
      <GlassTile label="Diesel Status" icon="water-outline" delay={400} onPress={() => router.push(`/property/${propertyId}/diesel`)}>
        <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 2, borderColor: 'rgba(245,158,11,0.3)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800' }}>{dieselStats.level}%</Text>
          </View>
          <View>
            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>Current Level</Text>
            <Text style={styles.tileSubtext}>Tank A + Tank B summary</Text>
          </View>
        </View>
      </GlassTile>
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a1a1a', '#121212', '#0a0a0a']} style={StyleSheet.absoluteFillObject} />
      {weather && <WeatherBackground condition={weather.condition} />}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="rgba(255,255,255,0.6)" />} contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}>
        <Animated.View entering={FadeInUp.duration(500)} style={[styles.header, { paddingTop: insets.top + 16 }]}>
          {onBack ? (
            <TouchableOpacity style={styles.hamburgerBtn} onPress={onBack} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.hamburgerBtn} onPress={() => setShowDrawer(true)} activeOpacity={0.7}>
              <Ionicons name="menu" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <View style={styles.headerCenter}>
            <TouchableOpacity 
              style={styles.profileRow} 
              activeOpacity={0.7}
              onPress={() => router.push(`/property/${propertyId}/profile`)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user?.user_metadata?.full_name ? user.user_metadata.full_name.split(' ').map((n: any) => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}</Text>
              </View>
              <View style={[styles.nameContainer, { flex: 1 }]}>
                <Text style={styles.greetingText} numberOfLines={1}>Hey, {user?.user_metadata?.full_name?.split(' ')[0] || 'Admin'}</Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>{propertyName}</Text>
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowTicketModal(true)}>
              <Ionicons name="add-circle-outline" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconBtn}>
              <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
              <View style={styles.notificationBadge} />
            </TouchableOpacity>
          </View>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(100).duration(600)} style={styles.overviewHeader}><Text style={styles.overviewTitle}>PROPERTY{"\n"}OVERVIEW</Text></Animated.View>
        
        <View style={{ marginTop: SPACING.xs }}>{renderTabContent()}</View>
      </ScrollView>
      <MobileFooter activeTab="dashboard" />

      <DetailModal visible={!!showTileDetail} onClose={() => setShowTileDetail(null)} detail={showTileDetail!} />
      <SignOutModal visible={showSignOut} onClose={() => setShowSignOut(false)} onSignOut={signOut} />
      <CassandraSessionModal visible={showChat} onClose={() => setShowChat(false)} orgId={orgId} />
      
      <Modal visible={showDrawer} transparent animationType="fade" onRequestClose={() => setShowDrawer(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={[styles.drawerPanel, { paddingTop: insets.top + 16 }]}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerLogoContainer}>
                <Image 
                  source={require('@/assets/images/autopilot-logo-new.png')} 
                  style={[styles.drawerLogo, { tintColor: '#FFFFFF' }]} 
                  resizeMode="contain" 
                />
                <Text style={styles.drawerSubtitle}>PROPERTY ADMIN</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDrawer(false)} style={styles.drawerCloseBtn}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.drawerSectionLabel}>OPERATIONS</Text>
              {[
                { label: 'Dashboard', route: 'lovable-admin', icon: 'grid-outline' },
                { label: 'Tickets', route: 'tickets', icon: 'ticket-outline' },
                { label: 'User Directory', route: 'users', icon: 'people-outline' },
                { label: 'Visitors', route: 'visitors', icon: 'walk-outline' },
                { label: 'Meeting Rooms', route: 'rooms', icon: 'calendar-outline' },
              ].map((item) => (
                <TouchableOpacity key={item.route} style={styles.drawerItem} onPress={() => { setShowDrawer(false); router.push(`/property/${propertyId}/${item.route}` as any); }}>
                  <Ionicons name={item.icon as any} size={20} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.drawerItemLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.drawerSectionLabel, { marginTop: 20 }]}>UTILITIES</Text>
              {[
                { label: 'Diesel Manager', route: 'diesel', icon: 'fuel-outline' },
                { label: 'Electricity', route: 'electricity', icon: 'flash-outline' },
                { label: 'Stock / Inventory', route: 'stock', icon: 'cube-outline' },
                { label: 'SOPs & Checklists', route: 'checklist', icon: 'clipboard-outline' },
                { label: 'PPM', route: 'ppm', icon: 'calendar-clear-outline' },
              ].map((item) => (
                <TouchableOpacity key={item.route} style={styles.drawerItem} onPress={() => { setShowDrawer(false); router.push(`/property/${propertyId}/${item.route}` as any); }}>
                  <Ionicons name={item.icon as any} size={20} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.drawerItemLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.drawerSectionLabel, { marginTop: 20 }]}>MANAGEMENT</Text>
              {[
                { label: 'Procurement', route: 'soft-service-manager', icon: 'cart-outline' },
                { label: 'Escalation', route: 'escalation', icon: 'git-branch-outline' },
                { label: 'Vendor Revenue', route: 'vendor', icon: 'restaurant-outline' },
                { label: 'Reports', route: 'reports', icon: 'document-text-outline' },
                { label: 'Settings', route: 'settings', icon: 'settings-outline' },
              ].map((item) => (
                <TouchableOpacity key={item.route} style={styles.drawerItem} onPress={() => { setShowDrawer(false); router.push(`/property/${propertyId}/${item.route}` as any); }}>
                  <Ionicons name={item.icon as any} size={20} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.drawerItemLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.drawerSignOut} onPress={() => { setShowDrawer(false); setShowSignOut(true); }}>
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
              <Text style={styles.drawerSignOutText}>Logout</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.drawerBackdrop} onPress={() => setShowDrawer(false)} />
        </View>
      </Modal>

      {/* Create Request Modal */}
      <TicketCreateModal
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        propertyId={propertyId}
        organizationId={orgId}
        role="admin"
        onSuccess={fetchData}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingBottom: 12 },
  hamburgerBtn: { padding: 4 },
  headerCenter: { flex: 1, paddingHorizontal: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  greetingText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  headerRight: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  headerIconBtn: { position: 'relative' },
  notificationBadge: { position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  overviewHeader: { paddingHorizontal: SPACING.xl, marginTop: 20 },
  overviewTitle: { fontFamily: fontDisplay, fontSize: 24, fontWeight: '800', color: '#FFFFFF', lineHeight: 26, letterSpacing: -0.5 },
  tileWrapper: { marginHorizontal: SPACING.xl, marginBottom: 12, borderRadius: 20, overflow: 'hidden' },
  tileBlur: { minHeight: 140 },
  tileContent: { padding: 16 },
  tileTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tileMetricBig: { fontFamily: fontDisplay, fontSize: 42, fontWeight: '800', color: '#FFFFFF' },
  tileMetricMid: { fontFamily: fontDisplay, fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  tileSuffix: { fontSize: 16, color: 'rgba(255,255,255,0.3)', fontWeight: '600' },
  tileSubtext: { fontFamily: fontSans, fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  timeToggleRow: { flexDirection: 'row', gap: 6, marginBottom: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 4, width: '100%' },
  timeToggleBtn: { flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  timeToggleBtnActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  timeToggleText: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  timeToggleTextActive: { color: '#FFF', fontWeight: '700' },
  trendChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(31,194,110,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  trendChipText: { color: '#1FC26E', fontSize: 12, fontWeight: '700' },
  bottomNavContainer: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', zIndex: 100 },
  bottomNavStatic: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-around', 
    width: '100%', 
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255,255,255,0.1)', 
    backgroundColor: 'rgba(18, 18, 18, 0.8)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  staticNavItem: { alignItems: 'center', justifyContent: 'center', flex: 1, gap: 2 },
  staticNavItemCenter: { alignItems: 'center', justifyContent: 'center', flex: 1.2, gap: 2, marginTop: -4 },
  staticNavLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700', fontFamily: fontSans, marginTop: 2 },
  staticNavLabelActive: { color: '#FFF' },
  cassandraOrbSmall: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: '#000', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.2)', 
    shadowColor: '#3B82F6', 
    shadowOpacity: 0.3, 
    shadowRadius: 8,
    elevation: 5
  },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawerPanel: { width: 280, height: '100%', backgroundColor: '#111', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20 },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25, marginTop: 10 },
  drawerLogoContainer: { flex: 1 },
  drawerLogo: { width: 140, height: 35, marginLeft: -5 },
  drawerSubtitle: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginTop: 4, marginLeft: 2 },
  drawerTitle: { fontFamily: fontDisplay, fontSize: 24, fontWeight: '700', color: '#FFF' },
  drawerCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 15 },
  drawerItemLabel: { fontFamily: fontSans, fontSize: 16, color: '#FFF' },
  drawerSectionLabel: { fontFamily: fontSans, fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, marginBottom: 8, paddingHorizontal: 4 },
  drawerSignOut: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', marginBottom: 40 },
  drawerSignOutText: { color: '#EF4444', fontWeight: '700' },
});
