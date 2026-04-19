import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useWeather } from '@/hooks/useWeather';
import WeatherBackground from '@/components/dashboard/WeatherBackground';
import DashboardTile from '@/components/dashboard/DashboardTile';
import { Property, TileDetail } from './types';
import {
  BG,
  fontSans,
  fontDisplay,
  STATUS_COLORS,
} from './constants';
import MiniBarChart from './MiniBarChart';
import PulseDot from './PulseDot';

// Placeholder or real detail mapped data
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
      chartData: property.tickets || [],
      chartColor: '#3B82F6',
      trendDirection: 'up',
      trendLabel: 'Real-time volume',
      breakdownTitle: 'Metric Distribution',
      breakdown: [
        { label: 'Open', value: open, color: STATUS_COLORS.critical },
        { label: 'Resolved', value: resolved, color: STATUS_COLORS.optimal },
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
      ],
      chartColor: '#1FC26E',
      trendDirection: 'up',
      trendLabel: 'Daily accuracy',
      breakdownTitle: 'Completion Status',
      breakdown: [
        { label: 'Completed', value: property.checklist.completed, color: STATUS_COLORS.optimal },
        { label: 'Incomplete', value: property.checklist.total - property.checklist.completed, color: STATUS_COLORS.warning },
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
      ],
      chartColor: property.healthStatus === 'critical' ? '#D9261C' : '#1FC26E',
      trendDirection: 'down',
      trendLabel: 'Real-time index',
      breakdownTitle: 'Health Components',
      breakdown: [
        { label: 'Facility', value: property.healthScore, color: STATUS_COLORS.optimal },
        { label: 'Risk', value: 100 - property.healthScore, color: STATUS_COLORS.critical },
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
      ],
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
  const healthColor =
    healthStatus === 'good' ? STATUS_COLORS.optimal :
    healthStatus === 'warning' ? STATUS_COLORS.warning :
    STATUS_COLORS.critical;
  
  const checklistPct = property.checklist
    ? Math.round((property.checklist.completed / property.checklist.total) * 100)
    : 87;

  // Use property.tickets if available, otherwise deterministic placeholder
  const history = useMemo(() => {
    if (property.tickets && property.tickets.length > 0) return property.tickets;
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ({
      day: d,
      count: 10 + (i * 2), // Stable placeholder
    }));
  }, [property.tickets]);

  const tileDetails = useMemo(() => generateTileDetails(property), [property]);

  return (
    <View style={[styles.detailContainer, { backgroundColor: BG }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Issue #15: Gradient overlap - use more subtle background if weather is active */}
      <LinearGradient
        colors={weather ? ['#0f121e', '#07090e'] : ['#1c2135', '#0f121e', '#07090e']}
        style={StyleSheet.absoluteFillObject}
      />
      
      {weather && <WeatherBackground condition={weather.condition} />}

      <ScrollView
        style={styles.detailScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ 
          paddingBottom: insets.bottom + 120, 
          paddingTop: insets.top + 24,
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

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.45)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tickets, checklists..."
            placeholderTextColor="rgba(255,255,255,0.35)"
          />
        </View>

        {/* Tickets tile */}
        <Animated.View style={{ marginBottom: 20 }} entering={FadeInUp.delay(100).duration(500)}>
          <DashboardTile
            label="TICKETS"
            variant="tickets"
            delay={0.05}
            onPress={() => onShowTileDetail(tileDetails.tickets)}
          >
            <View style={styles.tileTopRow}>
              <View>
                <Text style={styles.tileMetricBig}>{total}</Text>
                <Text style={styles.tileSubtext}>
                  {open} open · {resolved} resolved
                </Text>
              </View>
              <MiniBarChart data={history} />
            </View>
            <View style={styles.tileDivider} />
            <View style={styles.tileFooter}>
              <View style={styles.healthBadge}>
                <PulseDot color={healthColor} />
                <Text style={[styles.healthBadgeText, { color: healthColor }]}>
                  {healthStatus === 'good' ? 'Healthy' : healthStatus === 'warning' ? 'Watch' : 'Critical'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.40)" />
            </View>
          </DashboardTile>
        </Animated.View>

        {/* Checklist + Health row */}
        <Animated.View entering={FadeInUp.delay(180).duration(500)}>
          <View style={styles.rowTwo}>
            <DashboardTile
              label="CHECKLIST"
              variant="checklist"
              delay={0.12}
              onPress={() => onShowTileDetail(tileDetails.checklist)}
            >
              <Text style={styles.tileMetricMid}>
                {property.checklist.completed}{' '}
                <Text style={styles.tileMetricSuffix}>/ {property.checklist.total}</Text>
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${property.checklist.percent}%` }]} />
              </View>
              <Text style={styles.tileSubtext}>{property.checklist.percent}% completed</Text>
            </DashboardTile>

            <DashboardTile
              label="HEALTH"
              variant="health"
              delay={0.18}
              onPress={() => onShowTileDetail(tileDetails.health)}
            >
              <Text style={[styles.tileMetricMid, { color: healthColor }]}>
                {healthStatus === 'good' ? 'Optimal' : healthStatus === 'warning' ? 'Watch' : 'Critical'}
              </Text>
              <View style={[styles.healthDotLarge, { backgroundColor: healthColor }]} />
              <Text style={styles.tileSubtext}>Facility score: {property.healthScore}</Text>
            </DashboardTile>
          </View>
        </Animated.View>

        {/* Energy row */}
        <Animated.View entering={FadeInUp.delay(260).duration(500)} style={{ marginTop: 20 }}>
          <View style={styles.energyRow}>
            <DashboardTile
              label="ENERGY"
              variant="energy"
              delay={0.24}
              onPress={() => onShowTileDetail(tileDetails.energy)}
            >
              <View style={styles.energyContent}>
                <View>
                  <Text style={styles.tileMetricMid}>
                    {property.energy.electricity} <Text style={styles.tileMetricSuffix}>kVAh</Text>
                  </Text>
                  <Text style={styles.tileSubtext}>Real-time grid consumption</Text>
                </View>
                <View style={[styles.trendBadge, { backgroundColor: property.energy.trend > 0 ? 'rgba(217,38,28,0.15)' : 'rgba(31,194,110,0.15)' }]}>
                   <Ionicons 
                     name={property.energy.trend > 0 ? 'trending-up' : 'trending-down'} 
                     size={14} 
                     color={property.energy.trend > 0 ? STATUS_COLORS.critical : STATUS_COLORS.optimal} 
                   />
                   <Text style={[styles.trendText, { color: property.energy.trend > 0 ? STATUS_COLORS.critical : STATUS_COLORS.optimal }]}>
                     {Math.abs(property.energy.trend)}%
                   </Text>
                </View>
              </View>
            </DashboardTile>
          </View>
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
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 20,
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
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: fontSans,
    paddingVertical: 0,
  },
  tileTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tileMetricBig: {
    fontFamily: fontSans,
    fontSize: 48,
    fontWeight: '300',
    color: '#FFFFFF',
    letterSpacing: -1.5,
    lineHeight: 52,
  },
  tileMetricMid: {
    fontFamily: fontSans,
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tileMetricSuffix: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.40)',
  },
  tileSubtext: {
    fontFamily: fontSans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.50)',
    marginTop: 4,
  },
  tileDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 12,
  },
  tileFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  healthBadgeText: {
    fontFamily: fontSans,
    fontSize: 13,
    fontWeight: '600',
  },
  rowTwo: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginTop: 12,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1FC26E',
    borderRadius: 2,
  },
  healthDotLarge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginVertical: 8,
  },
  energyRow: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  energyContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  trendText: {
    fontFamily: fontSans,
    fontSize: 12,
    fontWeight: '700',
  },
});
