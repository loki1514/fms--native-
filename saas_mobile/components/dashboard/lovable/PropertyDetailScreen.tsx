import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useWeather } from '@/hooks/useWeather';
import WeatherBackground from '@/components/dashboard/WeatherBackground';
import MiniBarChart from './MiniBarChart';
import PulseDot from './PulseDot';
import { Property, TileDetail } from './types';
import { BG, fontSans, fontDisplay } from './constants';
import {
  GlassCard,
  StatusGradient,
  STATUS_COLORS,
  SPACING,
  TYPOGRAPHY,
  CARD_SURFACES,
  type StatusType,
} from '@/constants/designSystem';

// Helper to generate dynamic tile details from live property data
function generateTileDetails(property: Property): Record<string, TileDetail> {
  const open = property.openTickets;
  const resolved = property.resolvedTickets;
  const total = property.totalTickets;

  return {
    tickets: {
      id: 'tickets',
      iconName: 'ticket',
      label: 'Tickets',
      title: 'Facility · Tickets',
      metrics: [
        { label: 'Open', value: open.toString() },
        { label: 'Resolved', value: resolved.toString() },
        { label: 'Total', value: total.toString() },
      ],
      chartTitle: '7-Day History',
      chartData: (property.tickets || []).map(t => ({ label: t.day, value: t.count })),
      chartColor: '#3B82F6',
      trendDirection: 'up',
      trendLabel: 'Real-time volume',
      breakdownTitle: 'Metric Distribution',
      breakdown: [
        { label: 'Open', value: open, color: STATUS_COLORS.critical.bg },
        { label: 'Resolved', value: resolved, color: STATUS_COLORS.optimal.bg },
        { label: 'Total', value: total, color: '#3B82F6' },
      ],
      aiAnalysis: open > 15
        ? 'Critical ticket backlog detected. Priority response recommended for oldest open items.'
        : 'Ticket volume is within normal operating parameters. Focus on maintaining resolution speed.',
    },
    checklist: {
      id: 'checklist',
      iconName: 'checkmark-square',
      label: 'Checklist',
      title: 'Operations · Daily Checklist',
      metrics: [
        { label: 'Completed', value: property.checklist.completed.toString() },
        { label: 'Total', value: property.checklist.total.toString() },
        { label: 'Success %', value: `${property.checklist.percent}%` },
      ],
      chartTitle: 'Compliance Score',
      chartData: [
        { label: 'Goal', value: 100 },
        { label: 'Current', value: property.checklist.percent },
      ] as const,
      chartColor: STATUS_COLORS.optimal.bg,
      trendDirection: 'up',
      trendLabel: 'Daily accuracy',
      breakdownTitle: 'Completion Status',
      breakdown: [
        { label: 'Completed', value: property.checklist.completed, color: STATUS_COLORS.optimal.bg },
        { label: 'Incomplete', value: property.checklist.total - property.checklist.completed, color: STATUS_COLORS.watch.bg },
      ],
      aiAnalysis: property.checklist.percent > 90
        ? 'Operational compliance is excellent. Teams are following standard procedures consistently.'
        : 'Checklist completion is below target. Review pending tasks in the maintenance department.',
    },
    health: {
      id: 'health',
      iconName: 'heart',
      label: 'Health',
      title: 'Facility · Health Score',
      metrics: [
        { label: 'Health Score', value: property.healthScore.toString() },
        { label: 'Open Issues', value: open.toString() },
        { label: 'Status', value: property.healthStatus.toUpperCase() },
      ],
      chartTitle: 'Health Index',
      chartData: [
        { label: 'Critical', value: 30 },
        { label: 'Base', value: property.healthScore },
      ] as const,
      chartColor: property.healthStatus === 'critical' ? STATUS_COLORS.critical.bg : STATUS_COLORS.optimal.bg,
      trendDirection: 'down',
      trendLabel: 'Real-time index',
      breakdownTitle: 'Health Components',
      breakdown: [
        { label: 'Facility', value: property.healthScore, color: STATUS_COLORS.optimal.bg },
        { label: 'Risk', value: 100 - property.healthScore, color: STATUS_COLORS.critical.bg },
      ],
      aiAnalysis: property.healthScore > 80
        ? 'Facility health is optimal. No immediate infrastructure risks identified.'
        : 'Facility health requires monitoring. High ticket volume and incomplete SOPs are impacting the score.',
    },
    energy: {
      id: 'energy',
      iconName: 'flash',
      label: 'Energy',
      title: 'Facility · Energy Consumption',
      metrics: [
        { label: 'Electricity', value: `${property.energy.electricity} kVAh` },
        { label: 'Diesel', value: `${property.energy.diesel} L` },
        { label: 'Trend', value: `${property.energy.trend > 0 ? '+' : ''}${property.energy.trend}%` },
      ],
      chartTitle: 'Consumption Trend',
      chartData: [
        { label: 'Avg', value: 100 },
        { label: 'Current', value: 100 + property.energy.trend },
      ] as const,
      chartColor: '#FFD60A',
      trendDirection: property.energy.trend > 0 ? 'up' : 'down',
      trendLabel: '30-day average',
      breakdownTitle: 'Source Distribution',
      breakdown: [
        { label: 'Grid', value: property.energy.electricity, color: '#FFD60A' },
        { label: 'DG', value: property.energy.diesel, color: '#FF9500' },
      ],
      aiAnalysis: property.energy.trend > 10
        ? 'Energy consumption is trending higher than monthly average. Inspect heavy loads or check for utility leakage.'
        : 'Energy consumption is stable and matches historical patterns.',
    }
  };
}

/** Map internal health status to design system StatusType */
function getStatusType(healthStatus: string): StatusType {
  if (healthStatus === 'critical') return 'critical';
  if (healthStatus === 'warning') return 'watch';
  return 'optimal';
}

/** Status pill component using design system tokens */
function StatusPill({ status }: { status: StatusType }) {
  const palette = STATUS_COLORS[status];
  const label = status === 'optimal' ? 'Optimal' : status === 'watch' ? 'Watch' : 'Critical';
  return (
    <View style={[styles.statusPill, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <PulseDot color={palette.bg} />
      <Text style={[styles.statusPillText, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

interface PropertyDetailScreenProps {
  property: Property;
  onBack: () => void;
  onShowChat: () => void;
  onShowTileDetail: (detail: any) => void;
}

export default function PropertyDetailScreen({
  property,
  onBack,
  onShowChat,
  onShowTileDetail,
}: PropertyDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { weather } = useWeather();

  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const open = property.openTickets ?? 0;
  const resolved = property.resolvedTickets ?? 0;
  const total = property.totalTickets ?? 0;
  const healthStatus = property.healthStatus ?? (open > 15 ? 'critical' : open > 5 ? 'warning' : 'good');
  const statusType = getStatusType(healthStatus);

  const checklistPct = property.checklist
    ? Math.round((property.checklist.completed / property.checklist.total) * 100)
    : 87;

  const history = useMemo(() => {
    if (property.tickets && property.tickets.length > 0) return property.tickets;
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ({
      day: d,
      count: 10 + (i * 2),
    }));
  }, [property.tickets]);

  const tileDetails = useMemo(() => generateTileDetails(property), [property]);

  return (
    <View style={[styles.detailContainer, { backgroundColor: BG }]}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={weather ? ['#0f121e', '#07090e'] : ['#1c2135', '#0f121e', '#07090e']}
        style={StyleSheet.absoluteFillObject}
      />

      {weather && <WeatherBackground condition={weather.condition} />}

      <ScrollView
        style={styles.detailScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 160,
          paddingTop: insets.top + SPACING.xl,
        }}
      >
        {/* Header */}
        <View style={styles.detailHeaderScrollable}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.detailTitleGroup}>
            <Text style={styles.detailTitle} numberOfLines={1}>{property.name}</Text>
            <Text style={styles.detailSubtitle}>
              {property.code} · {today}
            </Text>
          </View>
        </View>

        {/* ── Tickets Card (full-width) ── */}
        <Animated.View style={{ marginBottom: SPACING.lg, marginHorizontal: SPACING.xl }} entering={FadeInUp.delay(100).duration(500)}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onShowTileDetail(tileDetails.tickets)}
          >
            <StatusGradient status={statusType}>
              <GlassCard status={statusType} style={styles.fixedCard}>
                {/* Top row: label left, status pill right */}
                <View style={styles.cardTopRow}>
                  <View style={styles.labelRow}>
                    <View style={styles.iconBadge}>
                      <Ionicons name="ticket-outline" size={14} color={STATUS_COLORS[statusType].bg} />
                    </View>
                    <Text style={styles.cardLabel}>TICKETS</Text>
                  </View>
                  <StatusPill status={statusType} />
                </View>

                {/* Body */}
                <View style={styles.cardBody}>
                  <View>
                    <Text style={styles.displayNumber}>{total}</Text>
                    <Text style={styles.cardSubtext}>
                      {open} open · {resolved} resolved
                    </Text>
                  </View>
                  <View style={styles.chartContainer}>
                    <MiniBarChart data={history} />
                  </View>
                </View>
              </GlassCard>
            </StatusGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Checklist + Health row ── */}
        <Animated.View entering={FadeInUp.delay(180).duration(500)}>
          <View style={styles.rowTwo}>
            {/* Checklist */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onShowTileDetail(tileDetails.checklist)}
              style={{ flex: 1 }}
            >
              <StatusGradient status="optimal">
                <GlassCard status="optimal" style={styles.fixedCard}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.labelRow}>
                      <View style={styles.iconBadge}>
                        <Ionicons name="checkmark-circle-outline" size={14} color={STATUS_COLORS.optimal.bg} />
                      </View>
                      <Text style={styles.cardLabel}>CHECKLIST</Text>
                    </View>
                    <StatusPill status="optimal" />
                  </View>
                  <Text style={styles.midNumber}>
                    {property.checklist.completed}{' '}
                    <Text style={styles.midSuffix}>/ {property.checklist.total}</Text>
                  </Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${property.checklist.percent}%` }]} />
                  </View>
                  <Text style={styles.cardSubtext}>{property.checklist.percent}% completed</Text>
                </GlassCard>
              </StatusGradient>
            </TouchableOpacity>

            {/* Health */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onShowTileDetail(tileDetails.health)}
              style={{ flex: 1 }}
            >
              <StatusGradient status={statusType}>
                <GlassCard status={statusType} style={styles.fixedCard}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.labelRow}>
                      <View style={styles.iconBadge}>
                        <Ionicons name="heart-outline" size={14} color={STATUS_COLORS[statusType].bg} />
                      </View>
                      <Text style={styles.cardLabel}>HEALTH</Text>
                    </View>
                    <StatusPill status={statusType} />
                  </View>
                  <Text style={[styles.midNumber, { color: STATUS_COLORS[statusType].text }]}>
                    {statusType === 'optimal' ? 'Optimal' : statusType === 'watch' ? 'Watch' : 'Critical'}
                  </Text>
                  <View style={[styles.healthDot, { backgroundColor: STATUS_COLORS[statusType].bg }]} />
                  <Text style={styles.cardSubtext}>Facility score: {property.healthScore}</Text>
                </GlassCard>
              </StatusGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Energy Card (full-width) ── */}
        <Animated.View entering={FadeInUp.delay(260).duration(500)} style={{ marginTop: SPACING.lg, marginHorizontal: SPACING.xl, marginBottom: SPACING.xl }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onShowTileDetail(tileDetails.energy)}
          >
            <StatusGradient status={property.energy.trend > 10 ? 'watch' : 'optimal'}>
              <GlassCard status={property.energy.trend > 10 ? 'watch' : 'optimal'} style={styles.fixedCard}>
                <View style={styles.cardTopRow}>
                  <View style={styles.labelRow}>
                    <View style={styles.iconBadge}>
                      <Ionicons name="flash-outline" size={14} color={STATUS_COLORS.watch.bg} />
                    </View>
                    <Text style={styles.cardLabel}>ENERGY USAGE</Text>
                  </View>
                  <StatusPill status={property.energy.trend > 10 ? 'watch' : 'optimal'} />
                </View>
                <View style={styles.cardBody}>
                  <View>
                    <Text style={styles.midNumber}>
                      {property.energy.electricity} <Text style={styles.midSuffix}>kVAh</Text>
                    </Text>
                    <View style={styles.trendChip}>
                      <Ionicons
                        name={property.energy.trend > 0 ? 'trending-up' : 'trending-down'}
                        size={14}
                        color={property.energy.trend > 0 ? STATUS_COLORS.critical.bg : STATUS_COLORS.optimal.bg}
                      />
                      <Text style={[styles.trendText, { color: property.energy.trend > 0 ? STATUS_COLORS.critical.bg : STATUS_COLORS.optimal.bg }]}>
                        {Math.abs(property.energy.trend)}%
                      </Text>
                    </View>
                  </View>
                </View>
              </GlassCard>
            </StatusGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  detailContainer: { flex: 1 },
  detailScroll: { flex: 1, zIndex: 10 },
  detailHeaderScrollable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.xl,
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
  },
  detailTitleGroup: { flex: 1, paddingTop: 2 },
  detailTitle: {
    fontFamily: fontDisplay,
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1.2,
  },
  detailSubtitle: {
    fontFamily: fontSans,
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    marginTop: SPACING.xs,
  },
  // Cards
  fixedCard: {
    height: 180,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardLabel: {
    fontFamily: fontSans,
    fontSize: TYPOGRAPHY.caption.fontSize,
    fontWeight: TYPOGRAPHY.caption.fontWeight,
    color: 'rgba(255,255,255,0.70)',
    letterSpacing: TYPOGRAPHY.caption.letterSpacing,
    textTransform: 'uppercase',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillText: {
    fontFamily: fontSans,
    fontSize: 10,
    fontWeight: '600',
  },

  // Body
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  displayNumber: {
    ...TYPOGRAPHY.displayLarge,
    fontFamily: fontDisplay,
    color: '#FFFFFF',
  },
  midNumber: {
    ...TYPOGRAPHY.displayMedium,
    fontFamily: fontDisplay,
    color: '#FFFFFF',
  },
  midSuffix: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.40)',
  },
  cardSubtext: {
    fontFamily: fontSans,
    fontSize: TYPOGRAPHY.body.fontSize,
    color: 'rgba(255,255,255,0.50)',
    marginTop: SPACING.xs,
  },
  chartContainer: {
    width: 120,
    height: 60,
    paddingRight: SPACING.lg,
    justifyContent: 'flex-end',
  },

  // Two column row
  rowTwo: {
    flexDirection: 'row',
    gap: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },

  // Progress
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
    backgroundColor: STATUS_COLORS.optimal.bg,
    borderRadius: 2,
  },

  // Health
  healthDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginTop: SPACING.sm,
  },

  // Energy trend
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
    gap: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
  },
  trendText: {
    fontFamily: fontSans,
    fontSize: 12,
    fontWeight: '700',
  },
});
