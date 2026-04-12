import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/context';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/utils/supabase/client';
import {
  Ticket,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  Building2,
  Users,
  Package,
  Store,
  LogOut,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---- Types ----
type TimePeriod = 'today' | 'month' | 'all';

interface TicketStats {
  total: number;
  open: number;
  waitlist: number;
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
}

const TIME_FILTERS: { value: TimePeriod; label: string }[] = [
  { value: 'today', label: 'TODAY' },
  { value: 'month', label: 'THIS MONTH' },
  { value: 'all', label: 'ALL TIME' },
];

// ---- KPI Card ----
function KpiCard({
  title,
  value,
  subtitle,
  icon,
  iconBg,
  iconColor,
  progress,
  progressColor,
  onPress,
  extra,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  progress?: number;
  progressColor?: string;
  onPress?: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={styles.kpiCard}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.kpiCardHeader}>
        <Text style={styles.kpiCardTitle}>{title}</Text>
        <View style={[styles.kpiIconWrap, { backgroundColor: iconBg }]}>
          {icon}
        </View>
      </View>
      <View style={styles.kpiValueRow}>
        <Text style={styles.kpiValue}>{value}</Text>
        {subtitle && <Text style={styles.kpiSubtitle}>{subtitle}</Text>}
      </View>
      {progress !== undefined && (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(progress, 100)}%`, backgroundColor: progressColor ?? '#10B981' },
            ]}
          />
        </View>
      )}
      {extra && <View style={{ marginTop: 8 }}>{extra}</View>}
    </TouchableOpacity>
  );
}

// ---- Electricity Gauge ----
function ElectricityGauge({ units, label }: { units: number; label: string }) {
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.min((units / (label === 'Today' ? 100 : 1000)) * 100, 100);
  const dashOffset = circumference - (percent / 100) * circumference;

  return (
    <View style={styles.electricityCard}>
      <Text style={styles.cardTitle}>Electricity</Text>
      <Text style={[styles.electricityPeriod, { color: '#708F96' }]}>{label}</Text>

      <View style={styles.gaugeContainer}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Defs>
            <LinearGradient id="elecGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#facc15" />
              <Stop offset="100%" stopColor="#f59e0b" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#elecGrad)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={dashOffset}
          />
        </Svg>
        <View style={[styles.gaugeCenter, { width: size, height: size }]}>
          <Zap size={20} color="#F59E0B" strokeWidth={1.5} />
          <Text style={styles.gaugeValue}>{units.toLocaleString()}</Text>
          <Text style={styles.gaugeUnit}>kVAh</Text>
        </View>
      </View>

      <Text style={styles.unitsLabel}>Units Consumed</Text>
      <View style={{ borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 8, marginTop: 8 }}>
        <Text style={styles.viewAnalytics}>View Analytics</Text>
      </View>
    </View>
  );
}

// ---- Property Card (Yellow) ----
function PropertyCard({
  propertyName,
  propertyCode,
  visitors,
  checkedIn,
  checkedOut,
}: {
  propertyName: string;
  propertyCode: string;
  visitors: number;
  checkedIn: number;
  checkedOut: number;
}) {
  return (
    <View style={styles.propertyCard}>
      <Text style={styles.propertyCardTitle}>{propertyName}</Text>
      <Text style={[styles.propertyCardCode, { color: '#B91C1C' }]}>Property: {propertyCode}</Text>

      <View style={styles.propertyImagePlaceholder}>
        <Building2 size={40} color="rgba(234,179,8,0.3)" strokeWidth={1} />
        <Text style={styles.awaitingVisuals}>Awaiting Visuals</Text>
      </View>

      <View style={styles.visitorStatsRow}>
        <View>
          <Text style={styles.visitorStatLabel}>Visitors</Text>
          <Text style={styles.visitorStatValue}>{visitors}</Text>
        </View>
        <View>
          <Text style={styles.visitorStatLabel}>Checked In / Out</Text>
          <Text style={styles.visitorStatValue}>{checkedIn} / {checkedOut}</Text>
        </View>
      </View>
    </View>
  );
}

// ---- Recent Tickets ----
function RecentTicketsCard({ tickets }: { tickets: any[] }) {
  return (
    <View style={styles.recentTicketsCard}>
      <Text style={styles.cardTitle}>Recent Tickets</Text>
      <View style={styles.ticketsList}>
        {tickets.length === 0 ? (
          <Text style={styles.noDataText}>No recent tickets.</Text>
        ) : (
          tickets.map((t, idx) => (
            <View key={t.id ?? idx} style={styles.ticketRow}>
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketTitle} numberOfLines={1}>{t.title}</Text>
                <Text style={styles.ticketStatus}>
                  {String(t.status ?? '').replace('_', ' ')}
                </Text>
              </View>
              <Text style={styles.ticketDate}>
                {new Date(t.created_at).toLocaleDateString()}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

// ---- Module Summary ----
function ModuleSummaryCard({
  tickets,
  visitors,
  electricity,
  vendors,
  periodLabel,
}: {
  tickets: number;
  visitors: number;
  electricity: number;
  vendors: number;
  periodLabel: string;
}) {
  return (
    <View style={styles.moduleSummaryCard}>
      <Text style={styles.cardTitle}>Module Summary</Text>
      <View style={styles.moduleSummaryGrid}>
        <View style={[styles.moduleBox, { backgroundColor: '#EFF6FF' }]}>
          <Text style={[styles.moduleBoxLabel, { color: '#2563EB' }]}>Tickets</Text>
          <Text style={[styles.moduleBoxValue, { color: '#1E3A8A' }]}>{tickets}</Text>
        </View>
        <View style={[styles.moduleBox, { backgroundColor: '#ECFDF5' }]}>
          <Text style={[styles.moduleBoxLabel, { color: '#059669' }]}>Visitors</Text>
          <Text style={[styles.moduleBoxValue, { color: '#064E3B' }]}>{visitors}</Text>
        </View>
        <View style={[styles.moduleBox, { backgroundColor: '#FFFBEB' }]}>
          <Text style={[styles.moduleBoxLabel, { color: '#D97706' }]}>
            Electricity ({periodLabel})
          </Text>
          <Text style={[styles.moduleBoxValue, { color: '#1A2332' }]}>
            {electricity.toLocaleString()}
          </Text>
        </View>
        <View style={[styles.moduleBox, { backgroundColor: '#F5F3FF' }]}>
          <Text style={[styles.moduleBoxLabel, { color: '#7C3AED' }]}>Vendors</Text>
          <Text style={[styles.moduleBoxValue, { color: '#4C1D95' }]}>{vendors}</Text>
        </View>
      </View>
    </View>
  );
}

// ---- Vendor Revenue Card ----
function VendorRevenueCard({ revenue, commission, count }: { revenue: number; commission: number; count: number }) {
  return (
    <View style={styles.vendorCard}>
      <Text style={styles.cardTitle}>Vendor Revenue</Text>
      <Text style={[styles.vendorPeriod, { color: '#708F96' }]}>Today</Text>
      <Text style={styles.vendorRevenue}>Rs. {revenue.toLocaleString()}</Text>
      <Text style={styles.vendorCommission}>
        Commission: Rs. {commission.toLocaleString()} from {count} vendors
      </Text>
    </View>
  );
}

// ---- Main Dashboard Screen ----
export default function DashboardScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const { membership, signOut } = useAuth();
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [stats, setStats] = useState<DashboardStats>({
    ticketStats: { total: 0, open: 0, waitlist: 0, in_progress: 0, resolved: 0, pending_validation: 0, urgent_open: 0 },
    electricityUnits: 0,
    electricityUnitsToday: 0,
    visitorsToday: 0,
    checkedIn: 0,
    checkedOut: 0,
    vendorRevenue: 0,
    vendorCommission: 0,
    vendorCount: 0,
    recentTickets: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [validationEnabled, setValidationEnabled] = useState(false);

  // Property info
  const propertyInfo = useMemo(() => {
    if (!membership) return { name: '', code: '' };
    const prop = membership.properties?.find((p) => p.id === propertyId);
    return { name: prop?.name ?? '', code: prop?.code ?? '' };
  }, [membership, propertyId]);

  const periodLabel = timePeriod === 'today' ? 'Today' : timePeriod === 'month' ? 'Month' : 'All';

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const fetchStats = async () => {
    if (!propertyId) return;
    setIsLoading(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      // Build date filter
      let dateFilter: string | undefined;
      if (timePeriod === 'today') dateFilter = today;
      else if (timePeriod === 'month') dateFilter = monthStart;

      // Tickets
      const makeTicketQuery = () => {
        let q = supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('property_id', propertyId);
        if (dateFilter) q = q.gte('created_at', dateFilter);
        return q;
      };

      const [
        totalRes,
        openRes,
        waitlistRes,
        inProgressRes,
        resolvedRes,
        pendingValRes,
        urgentOpenRes,
        recentRes,
        validationRes,
        elecRes,
      ] = await Promise.all([
        makeTicketQuery(),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).in('status', ['open', 'waitlist', 'blocked', 'client_raised']).gte('created_at', dateFilter ?? '2000-01-01'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).in('status', ['waitlist']).gte('created_at', dateFilter ?? '2000-01-01'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).in('status', ['assigned', 'in_progress', 'paused', 'work_started']).gte('created_at', dateFilter ?? '2000-01-01'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).in('status', ['resolved', 'closed', 'satisfied', 'pending_validation']).gte('created_at', dateFilter ?? '2000-01-01'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('status', 'pending_validation').gte('created_at', dateFilter ?? '2000-01-01'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).in('priority', ['urgent', 'high', 'critical']).not('status', 'in', '("resolved","closed","satisfied")').gte('created_at', dateFilter ?? '2000-01-01'),
        supabase.from('tickets').select('id, title, status, created_at').eq('property_id', propertyId).order('created_at', { ascending: false }).limit(5),
        supabase.from('property_features').select('is_enabled').eq('property_id', propertyId).eq('feature_key', 'ticket_validation').maybeSingle() as any,
        supabase.from('electricity_readings').select('computed_units, reading_date').eq('property_id', propertyId).gte('reading_date', monthStart),
      ]);

      // Electricity
      const monthUnits = elecRes.data?.reduce((acc: number, r: any) => acc + (r.computed_units || 0), 0) ?? 0;
      const todayUnits = elecRes.data?.filter((r: any) => r.reading_date === today).reduce((acc: number, r: any) => acc + (r.computed_units || 0), 0) ?? 0;

      // VMS
      const vmsRes = await supabase.from('visitor_logs').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).gte('created_at', dateFilter ?? '2000-01-01');
      const checkedInRes = await supabase.from('visitor_logs').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('status', 'checked_in').gte('created_at', dateFilter ?? '2000-01-01');
      const checkedOutRes = await supabase.from('visitor_logs').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('status', 'checked_out').gte('created_at', dateFilter ?? '2000-01-01');

      // Vendor
      const vendorsRes = await supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('property_id', propertyId);

      setStats({
        ticketStats: {
          total: totalRes.count ?? 0,
          open: openRes.count ?? 0,
          waitlist: waitlistRes.count ?? 0,
          in_progress: inProgressRes.count ?? 0,
          resolved: resolvedRes.count ?? 0,
          pending_validation: pendingValRes.count ?? 0,
          urgent_open: urgentOpenRes.count ?? 0,
        },
        electricityUnits: Math.round(monthUnits),
        electricityUnitsToday: Math.round(todayUnits),
        visitorsToday: vmsRes.count ?? 0,
        checkedIn: checkedInRes.count ?? 0,
        checkedOut: checkedOutRes.count ?? 0,
        vendorRevenue: 0,
        vendorCommission: 0,
        vendorCount: vendorsRes.count ?? 0,
        recentTickets: recentRes.data ?? [],
      });
      setValidationEnabled(validationRes.data?.is_enabled ?? false);
    } catch (err) {
      console.error('[Dashboard] fetch error:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [propertyId, timePeriod]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const completionRate = stats.ticketStats.total > 0
    ? Math.round((stats.ticketStats.resolved / stats.ticketStats.total) * 100 * 10) / 10
    : 0;

  if (isLoading && stats.ticketStats.total === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Header Section — Teal */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Unified Dashboard</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <LogOut size={16} color="rgba(255,255,255,0.8)" strokeWidth={1.5} />
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>

        {/* Time Period Filter */}
        <View style={styles.filterRow}>
          {TIME_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[
                styles.filterBtn,
                timePeriod === f.value && styles.filterBtnActive,
              ]}
              onPress={() => setTimePeriod(f.value)}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  timePeriod === f.value && styles.filterBtnTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Property Indicator */}
        <View style={styles.propertyIndicator}>
          <View style={styles.propertyIconCircle}>
            <Building2 size={16} color="#FFFFFF" strokeWidth={1.5} />
          </View>
          <Text style={styles.propertyIndicatorText}>{propertyInfo.name}</Text>
        </View>

        <Text style={styles.breadcrumb}>
          Dashboard / {propertyInfo.name || 'Property'}
        </Text>

        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          {/* Card 1: Total Tickets */}
          <KpiCard
            title={`Total Tickets ${timePeriod === 'today' ? '(Today)' : timePeriod === 'month' ? '(This Month)' : '(All Time)'}`}
            value={stats.ticketStats.total}
            subtitle={`${completionRate}% resolved`}
            icon={<Ticket size={14} color="#64748B" strokeWidth={1.5} />}
            iconBg="#F1F5F9"
            iconColor="#64748B"
            progress={completionRate}
            progressColor="#10B981"
            extra={
              <View style={styles.kpiFooter}>
                <Text style={styles.kpiFooterText}>
                  {stats.ticketStats.open + stats.ticketStats.in_progress} active
                </Text>
              </View>
            }
          />

          {/* Card 2: Open & Active */}
          <KpiCard
            title="Open & Active"
            value={stats.ticketStats.open + stats.ticketStats.in_progress}
            icon={<AlertCircle size={14} color="#3B82F6" strokeWidth={1.5} />}
            iconBg="#EFF6FF"
            iconColor="#3B82F6"
            extra={
              <View style={styles.statusDots}>
                <View style={styles.dotRow}>
                  <View style={[styles.dot, { backgroundColor: '#60A5FA' }]} />
                  <Text style={styles.dotLabel}>{stats.ticketStats.open - stats.ticketStats.waitlist} Open</Text>
                </View>
                <View style={styles.dotRow}>
                  <View style={[styles.dot, { backgroundColor: '#FCD34D' }]} />
                  <Text style={styles.dotLabel}>{stats.ticketStats.waitlist} Waitlist</Text>
                </View>
                <View style={styles.dotRow}>
                  <View style={[styles.dot, { backgroundColor: '#22D3EE' }]} />
                  <Text style={styles.dotLabel}>{stats.ticketStats.in_progress} In Progress</Text>
                </View>
                {stats.ticketStats.urgent_open > 0 && (
                  <View style={styles.dotRow}>
                    <View style={[styles.dot, { backgroundColor: '#FB7185' }]} />
                    <Text style={[styles.dotLabel, { color: '#E11D48' }]}>
                      {stats.ticketStats.urgent_open} High/Urgent
                    </Text>
                  </View>
                )}
              </View>
            }
          />

          {/* Card 3: Resolved & Closed */}
          <KpiCard
            title="Resolved & Closed"
            value={stats.ticketStats.resolved}
            subtitle={`${completionRate}%`}
            icon={<CheckCircle2 size={14} color="#10B981" strokeWidth={1.5} />}
            iconBg="#ECFDF5"
            iconColor="#10B981"
            progress={completionRate}
            progressColor="#10B981"
            extra={
              <View style={styles.kpiFooter}>
                <Text style={styles.kpiFooterText}>
                  {stats.ticketStats.resolved - stats.ticketStats.pending_validation} confirmed
                  {stats.ticketStats.pending_validation > 0 && (
                    <Text style={{ color: '#F59E0B' }}>
                      {' '}+ {stats.ticketStats.pending_validation} awaiting
                    </Text>
                  )}
                </Text>
              </View>
            }
          />

          {/* Card 4: Pending Validation */}
          {validationEnabled && (
            <KpiCard
              title="Pending Validation"
              value={stats.ticketStats.pending_validation}
              icon={<Clock size={14} color={stats.ticketStats.pending_validation > 0 ? '#F59E0B' : '#10B981'} strokeWidth={1.5} />}
              iconBg={stats.ticketStats.pending_validation > 0 ? '#FFFBEB' : '#ECFDF5'}
              iconColor={stats.ticketStats.pending_validation > 0 ? '#F59E0B' : '#10B981'}
              extra={
                <Text style={styles.kpiFooterText}>
                  {stats.ticketStats.pending_validation > 0
                    ? 'Awaiting tenant sign-off'
                    : 'All resolved tickets confirmed'}
                </Text>
              }
            />
          )}
        </View>
      </View>

      {/* Main Content Grid */}
      <View style={styles.contentGrid}>
        {/* Left Column */}
        <View style={styles.leftColumn}>
          <ElectricityGauge
            units={timePeriod === 'today' ? stats.electricityUnitsToday : stats.electricityUnits}
            label={periodLabel}
          />
          <VendorRevenueCard
            revenue={stats.vendorRevenue}
            commission={stats.vendorCommission}
            count={stats.vendorCount}
          />
        </View>

        {/* Center: Property Card */}
        <PropertyCard
          propertyName={propertyInfo.name || 'Property'}
          propertyCode={propertyInfo.code || 'N/A'}
          visitors={stats.visitorsToday}
          checkedIn={stats.checkedIn}
          checkedOut={stats.checkedOut}
        />

        {/* Right Column */}
        <View style={styles.rightColumn}>
          <RecentTicketsCard tickets={stats.recentTickets} />
          <ModuleSummaryCard
            tickets={stats.ticketStats.total}
            visitors={stats.visitorsToday}
            electricity={timePeriod === 'today' ? stats.electricityUnitsToday : stats.electricityUnits}
            vendors={stats.vendorCount}
            periodLabel={periodLabel}
          />
        </View>
      </View>
    </ScrollView>
  );
}

// ---- Styles ----
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#708F96',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  logoutBtnText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  filterBtnActive: {
    backgroundColor: '#FBBF24',
  },
  filterBtnText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.8)',
  },
  filterBtnTextActive: {
    color: '#1A2332',
  },
  propertyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  propertyIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  propertyIndicatorText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
    maxWidth: 120,
  },
  breadcrumb: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 16,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flex: 1,
    minWidth: (SCREEN_WIDTH - 32 - 32 - 20) / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  kpiCardTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#94A3B8',
    flex: 1,
    marginRight: 8,
  },
  kpiIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
  },
  kpiValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 36,
    color: '#1A2332',
    letterSpacing: -1,
  },
  kpiSubtitle: {
    fontFamily: 'Poppins-Medium',
    fontSize: 11,
    color: '#94A3B8',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  kpiFooter: {
    marginTop: 4,
  },
  kpiFooterText: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 10,
    color: '#94A3B8',
  },
  statusDots: {
    gap: 4,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotLabel: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 10,
    color: '#64748B',
  },
  contentGrid: {
    padding: 16,
    gap: 16,
  },
  leftColumn: {
    gap: 16,
  },
  rightColumn: {
    gap: 16,
  },
  cardTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: '#1A2332',
    marginBottom: 8,
  },
  electricityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  electricityPeriod: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 11,
    marginBottom: 12,
  },
  gaugeContainer: {
    alignItems: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  gaugeCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: '#1A2332',
    marginTop: 2,
  },
  gaugeUnit: {
    fontFamily: 'Poppins-Medium',
    fontSize: 9,
    color: '#94A3B8',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  unitsLabel: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 10,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  viewAnalytics: {
    fontFamily: 'Poppins-Medium',
    fontSize: 11,
    color: '#D97706',
    textDecorationLine: 'underline',
  },
  vendorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  vendorPeriod: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 11,
    marginBottom: 4,
  },
  vendorRevenue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: '#1A2332',
  },
  vendorCommission: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  propertyCard: {
    backgroundColor: '#FBBF24',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  propertyCardTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: '#1A2332',
    marginBottom: 4,
  },
  propertyCardCode: {
    fontFamily: 'Poppins-Medium',
    fontSize: 13,
    marginBottom: 16,
  },
  propertyImagePlaceholder: {
    height: 140,
    backgroundColor: 'rgba(234,179,8,0.2)',
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  awaitingVisuals: {
    fontFamily: 'Poppins-Medium',
    fontSize: 9,
    color: 'rgba(234,179,8,0.5)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  visitorStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  visitorStatLabel: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 11,
    color: '#1E40AF',
    marginBottom: 2,
  },
  visitorStatValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: '#1A2332',
  },
  recentTicketsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  ticketsList: {
    gap: 8,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
  },
  ticketInfo: {
    flex: 1,
    marginRight: 8,
  },
  ticketTitle: {
    fontFamily: 'Poppins-Medium',
    fontSize: 13,
    color: '#1A2332',
    marginBottom: 2,
  },
  ticketStatus: {
    fontFamily: 'Urbanist-Regular',
    fontSize: 11,
    color: '#64748B',
    textTransform: 'capitalize',
  },
  ticketDate: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 10,
    color: '#94A3B8',
  },
  noDataText: {
    fontFamily: 'Urbanist-Regular',
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 16,
  },
  moduleSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  moduleSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moduleBox: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 12,
    padding: 12,
  },
  moduleBoxLabel: {
    fontFamily: 'Poppins-Medium',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  moduleBoxValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
  },
});
