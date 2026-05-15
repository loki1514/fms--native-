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

const fontSans = Platform.select({ web: 'system-ui, -apple-system, sans-serif', ios: 'System', android: 'sans-serif', default: 'System' });
const fontDisplay = Platform.select({ web: '"SF Pro Display", system-ui, -apple-system, sans-serif', ios: 'System', android: 'sans-serif', default: 'System' });
const BG = '#121212';

type TabKey = 'overview';

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
    <Animated.View entering={FadeInUp.delay(delay).duration(500)} style={{ width: '100%' }}>
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

// ─── Attention Card ───────────────────────────────────────────────────────────
function AttentionCard({ item, index, onAction }: { item: any; index: number; onAction: () => void }) {
  const severityColor =
    item.severity === 'critical' ? '#EF4444' :
    item.severity === 'high' ? '#F59E0B' :
    item.severity === 'medium' ? '#3B82F6' : '#6B7280';
  const iconName =
    item.type === 'sla_risk' ? 'timer-outline' :
    item.type === 'unassigned_critical' ? 'alert-circle-outline' :
    item.type === 'unassigned_high' ? 'warning-outline' :
    item.type === 'stale_ticket' ? 'time-outline' :
    item.type === 'sop_missed' ? 'checkbox-outline' : 'information-circle-outline';

  return (
    <Animated.View entering={FadeInUp.delay(index * 100).duration(500)}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onAction}
        style={[styles.attentionCard, { borderLeftColor: severityColor, borderLeftWidth: 3 }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.attentionIconBadge, { backgroundColor: severityColor + '15' }]}>
            <Ionicons name={iconName} size={16} color={severityColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.attentionTitle}>{item.title}</Text>
            <Text style={styles.attentionDesc} numberOfLines={2}>{item.description}</Text>
          </View>
          <View style={[styles.attentionActionBadge, { backgroundColor: severityColor + '15' }]}>
            <Text style={[styles.attentionActionText, { color: severityColor }]}>{item.action_label}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
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
  const [showDrawer, setShowDrawer] = useState(false);

  // Data state
  const [tickets, setTickets] = useState<any[]>([]);
  const [sopCount, setSopCount] = useState(0);
  const [sopTotal, setSopTotal] = useState(0);
  const [energyKwh, setEnergyKwh] = useState(0);
  const [energyTrend, setEnergyTrend] = useState(12);
  const [propertyName, setPropertyName] = useState('Property');

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

  const openTickets = useMemo(() => filteredTickets.filter((t) => ['open', 'blocked', 'client_raised'].includes(t.status)).length, [filteredTickets]);
  const resolvedTickets = useMemo(() => filteredTickets.filter((t) => ['resolved', 'closed', 'satisfied'].includes(t.status)).length, [filteredTickets]);
  const totalTickets = filteredTickets.length;
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
      {/* Tickets Intelligence Tile — moved up */}
      <GlassTile label="Tickets" icon="ticket" delay={80} status={healthStatus} onPress={() => setShowTileDetail(tileDetails.tickets)}>
        {/* Time filter toggle */}
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
        <View style={styles.tileTopRow}>
          <View>
            <Text style={styles.tileMetricBig}>{totalTickets}</Text>
            <Text style={styles.tileSubtext}>{openTickets} open · {resolvedTickets} resolved</Text>
          </View>
          <MiniBarChart data={ticketHistory} />
        </View>
        {/* Status breakdown row */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {ticketFunnel.slice(0, 4).map((f: any) => {
            const shortLabel = f.status_label
              ?.replace(/_/g, ' ')
              ?.replace(/pending validation/i, 'Pending')
              ?.replace(/assigned/i, 'Assigned')
              ?.replace(/closed/i, 'Closed')
              ?.replace(/waitlist/i, 'Waitlist')
              ?.replace(/open/i, 'Open')
              ?.replace(/resolved/i, 'Resolved')
              ?.replace(/in progress/i, 'In Progress')
              || f.status_label;
            return (
              <View key={f.status_label} style={{ flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 2, overflow: 'hidden' }}>
                <Text style={{ fontFamily: fontDisplay, fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>{f.ticket_count}</Text>
                <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontFamily: fontSans, fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginTop: 2, textAlign: 'center', maxWidth: '100%' }}>{shortLabel}</Text>
              </View>
            );
          })}
        </View>
      </GlassTile>

      {/* Compact Health Score — one line */}
      {healthScore && (
        <Animated.View entering={FadeInUp.delay(120).duration(500)}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.tileWrapper, { minHeight: 64 }]}
            onPress={() => setShowTileDetail(tileDetails.health)}
          >
            <SafeBlurView intensity={40} style={[styles.tileBlur, { minHeight: 64 }]} tint="dark">
              <LinearGradient
                colors={['rgba(255,255,255,0.06)', 'rgba(0,0,0,0.2)']}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={[styles.tileContent, { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                <View style={[styles.healthDot, { backgroundColor: (healthScore.score ?? 0) >= 80 ? '#10B981' : (healthScore.score ?? 0) >= 50 ? '#F59E0B' : '#EF4444' }]} />
                <Text style={[styles.tileLabel, { flex: 0, letterSpacing: 1 }]}>HEALTH</Text>
                <Text style={[styles.tileMetricMid, { fontSize: 22 }]}>{healthScore.score ?? 0}</Text>
                <Text style={[styles.tileSuffix, { fontSize: 12 }]}>/ 100</Text>
                <Text style={[styles.tileSubtext, { color: healthColor, fontWeight: '600', fontSize: 12, marginTop: 0 }]}>
                  {(healthScore.score ?? 0) >= 80 ? 'Excellent' : (healthScore.score ?? 0) >= 50 ? 'Needs Attention' : 'Critical'}
                </Text>
                <View style={{ flex: 1 }} />
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.tileMetricSmall, { fontSize: 13 }]}>{healthScore.total_open ?? 0}</Text>
                    <Text style={[styles.tileSuffix, { fontSize: 9 }]}>Open</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.tileMetricSmall, { fontSize: 13, color: '#F59E0B' }]}>{healthScore.sla_risk ?? 0}</Text>
                    <Text style={[styles.tileSuffix, { fontSize: 9 }]}>Risk</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.tileMetricSmall, { fontSize: 13, color: '#EF4444' }]}>{healthScore.stale ?? 0}</Text>
                    <Text style={[styles.tileSuffix, { fontSize: 9 }]}>Stale</Text>
                  </View>
                </View>
              </View>
            </SafeBlurView>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Attention Feed */}
      {attentionItems.length > 0 && (
        <>
          <Animated.View entering={FadeInUp.delay(160).duration(500)} style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.md }}>
            <Text style={styles.sectionLabel}>⚠️ NEEDS ATTENTION</Text>
          </Animated.View>
          {attentionItems.slice(0, 3).map((item, index) => (
            <AttentionCard
              key={item.id}
              item={item}
              index={index}
              onAction={() => {
                if (item.entity_type === 'ticket') {
                  router.push(`/property/${propertyId}/tickets/${item.entity_id}`);
                }
              }}
            />
          ))}
        </>
      )}

      {/* Checklist — full width */}
      <GlassTile label="Checklist" icon="checkbox-outline" delay={200} onPress={() => setShowTileDetail(tileDetails.checklist)}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.tileMetricMid}>
              {sopCount} <Text style={styles.tileSuffix}>/ {sopTotal}</Text>
            </Text>
            <Text style={styles.tileSubtext}>{checklistPct}% completed</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <ProgressBar percent={checklistPct} color={STATUS_COLORS.optimal.bg} />
            <Text style={[styles.tileSubtext, { marginTop: 4, color: checklistPct >= 80 ? STATUS_COLORS.optimal.bg : STATUS_COLORS.watch.bg }]}>
              {checklistPct >= 80 ? 'On track' : checklistPct >= 50 ? 'Behind' : 'Critical'}
            </Text>
          </View>
        </View>
      </GlassTile>

      {/* Energy Tile */}
      <GlassTile label="Energy Usage" icon="flash" delay={280} status={energyTrend > 10 ? 'watch' : 'optimal'} onPress={() => setShowTileDetail(tileDetails.energy)}>
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
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a1a1a', '#121212', '#0a0a0a']} style={StyleSheet.absoluteFillObject} />
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
            {lastUpdated && (
              <Text style={styles.headerUpdated}>Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.signOutBtn} onPress={() => setShowDrawer(true)}>
            <Ionicons name="menu" size={22} color="rgba(255,255,255,0.60)" />
          </TouchableOpacity>
        </Animated.View>

        {/* Tab Content */}
        <View style={{ marginTop: SPACING.lg }}>{renderTabContent()}</View>

        {/* Navigation Drawer */}
        <Modal visible={showDrawer} transparent animationType="slide" onRequestClose={() => setShowDrawer(false)}>
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
            <TouchableOpacity style={styles.drawerBackdrop} onPress={() => setShowDrawer(false)} activeOpacity={1} />
            <View style={[styles.drawerPanel, { paddingTop: insets.top + 16 }]}>
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerTitle}>Menu</Text>
                <TouchableOpacity onPress={() => setShowDrawer(false)} style={styles.drawerCloseBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={24} color="rgba(255,255,255,0.70)" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {[
                  { label: 'Dashboard', route: 'dashboard', icon: 'grid-outline' },
                  { label: 'Tickets', route: 'tickets', icon: 'ticket-outline' },
                  { label: 'Flow Map', route: 'flow-map', icon: 'git-merge-outline' },
                  { label: 'Visitors', route: 'visitors', icon: 'people-outline' },
                  { label: 'Rooms', route: 'rooms', icon: 'cube-outline' },
                  { label: 'Stock', route: 'stock', icon: 'cube-outline' },
                  { label: 'Diesel', route: 'diesel', icon: 'flame-outline' },
                  { label: 'Electricity', route: 'electricity', icon: 'flash-outline' },
                  { label: 'Users', route: 'users', icon: 'person-outline' },
                  { label: 'Settings', route: 'settings', icon: 'settings-outline' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.route}
                    style={styles.drawerItem}
                    onPress={() => { setShowDrawer(false); router.push(`/property/${propertyId}/${item.route}` as never); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={item.icon as any} size={20} color="rgba(255,255,255,0.60)" />
                    <Text style={styles.drawerItemLabel}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.20)" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.drawerSignOut} onPress={() => { setShowDrawer(false); setShowSignOut(true); }}>
                <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                <Text style={styles.drawerSignOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>

      {/* Floating bottom nav with Cassandra */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16 }]}>
        <SafeBlurView intensity={40} style={styles.bottomNavBlur} tint="dark">
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('overview')}>
            <Ionicons name={activeTab === 'overview' ? 'grid' : 'grid-outline'} size={22} color={activeTab === 'overview' ? '#FFFFFF' : 'rgba(255,255,255,0.40)'} />
          </TouchableOpacity>
          <SidekickFace size={48} state={faceState} compact onClick={() => setShowChat(true)} />
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
  headerUpdated: {
    fontFamily: fontSans,
    fontSize: 11,
    color: 'rgba(255,255,255,0.30)',
    marginTop: 4,
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
  sectionLabel: {
    fontFamily: fontSans,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  tileMetricSmall: {
    fontFamily: fontDisplay,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  attentionCard: {
    backgroundColor: CARD_SURFACES.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_SURFACES.cardBorder,
    padding: 14,
    marginHorizontal: SPACING.xl,
    marginBottom: 10,
  },
  attentionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attentionTitle: {
    fontFamily: fontSans,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  attentionDesc: {
    fontFamily: fontSans,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
    lineHeight: 16,
  },
  attentionActionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  attentionActionText: {
    fontFamily: fontSans,
    fontSize: 11,
    fontWeight: '700',
  },
  timeToggleRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 4,
    width: '100%',
  },
  timeToggleBtn: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  timeToggleBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  timeToggleText: {
    fontFamily: fontSans,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.50)',
  },
  timeToggleTextActive: {
    color: '#FFFFFF',
  },
  // Drawer
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  drawerPanel: {
    width: 280,
    height: '100%',
    backgroundColor: '#1A1A1A',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  drawerTitle: {
    fontFamily: fontDisplay,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  drawerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  drawerItemLabel: {
    flex: 1,
    fontFamily: fontSans,
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.80)',
  },
  drawerSignOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
  },
  drawerSignOutText: {
    fontFamily: fontSans,
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  healthDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
