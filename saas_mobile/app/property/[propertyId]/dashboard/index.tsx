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
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  runOnJS,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { 
  Gesture, 
  GestureDetector, 
  GestureHandlerRootView 
} from 'react-native-gesture-handler';

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

// ---- Recent Tickets Shuffle Stack ----
function TicketCard({ 
  ticket, 
  index, 
  total, 
  translateX, 
  onSwipeIndex 
}: { 
  ticket: any; 
  index: number; 
  total: number;
  translateX: any;
  onSwipeIndex: (idx: number) => void;
}) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();

  const isTop = index === 0;
  
  const animatedStyle = useAnimatedStyle(() => {
    // Stack effect: only the top card swipes,others scale and shift
    if (isTop) {
      return {
        transform: [
          { translateX: translateX.value },
          { rotate: `${interpolate(translateX.value, [-SCREEN_WIDTH, 0, SCREEN_WIDTH], [-10, 0, 10], Extrapolate.CLAMP)}deg` }
        ],
        zIndex: total,
      };
    }

    // Cards behind
    const stackScale = interpolate(Math.abs(translateX.value), [0, 100], [1 - (index * 0.05), 1 - ((index - 1) * 0.05)], Extrapolate.CLAMP);
    const stackTranslateY = interpolate(Math.abs(translateX.value), [0, 100], [index * -15, (index - 1) * -15], Extrapolate.CLAMP);
    const stackOpacity = interpolate(Math.abs(translateX.value), [0, 100], [0.8 - (index * 0.2), 0.8 - ((index - 1) * 0.2)], Extrapolate.CLAMP);

    return {
      transform: [
        { scale: stackScale },
        { translateY: stackTranslateY }
      ],
      opacity: stackOpacity,
      zIndex: total - index,
    };
  });

  const pan = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 120) {
        // Swipe away
        const dest = e.translationX > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH;
        translateX.value = withSpring(dest, {}, () => {
          runOnJS(onSwipeIndex)(index);
        });
      } else {
        translateX.value = withSpring(0);
      }
    });

  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.split(' ');
    return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  };

  const priorityColor = ticket.priority === 'urgent' || ticket.priority === 'high' ? '#EF4444' : '#64748B';
  const statusColor = ticket.status === 'resolved' || ticket.status === 'closed' ? '#10B981' : '#3B82F6';

  const getTimeRemaining = (dueDate: string) => {
    if (!dueDate) return 'Not set';
    const total = Date.parse(dueDate) - Date.now();
    if (total <= 0) return 'Overdue';
    
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((total / 1000 / 60) % 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m left`;
  };

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.shuffleCard, animatedStyle, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardTopRow}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{getInitials(ticket.assigned_to_user?.full_name || 'Unassigned')}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.cardTicketId}>{ticket.ticket_id || `TKT-${ticket.id.slice(0, 8)}`}</Text>
            <Text style={styles.cardTicketDate}>{new Date(ticket.created_at).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        </View>

        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: priorityColor + '15' }]}>
            <Text style={[styles.badgeText, { color: priorityColor }]}>{String(ticket.priority || 'NORMAL').toUpperCase()}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor + '15' }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{String(ticket.status || 'OPEN').replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.cardDesc} numberOfLines={2}>
          {ticket.title || 'No description provided'}
        </Text>
        
        {ticket.assigned_to_user && (
          <Text style={styles.assigneeText}>Assignee: {ticket.assigned_to_user.full_name}</Text>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.slaCol}>
            <Text style={styles.slaLabel}>Time Remaining</Text>
            <View style={styles.slaRow}>
              <Clock size={12} color="#F59E0B" />
              <Text style={styles.slaValue}>{getTimeRemaining(ticket.due_date)}</Text> 
            </View>
          </View>
          <View style={styles.typeCol}>
             <Text style={styles.slaLabel}>Category</Text>
             <Text style={styles.typeValue} numberOfLines={1}>{ticket.category || 'General'}</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={[styles.cardBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push(`/property/${propertyId}/tickets/${ticket.id}`)}
          >
            <Text style={styles.cardBtnText}>View Details</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.cardBtn, { backgroundColor: '#F1F5F9' }]}>
            <Text style={[styles.cardBtnText, { color: '#64748B' }]}>Update Progress</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

function RecentTicketsCard({ tickets }: { tickets: any[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = useSharedValue(0);

  // We only show a few at a time for the stack
  const displayTickets = useMemo(() => {
    if (tickets.length === 0) return [];
    // Slice from current index, but we want to show 3 cards
    const start = currentIndex % tickets.length;
    const items = [];
    for(let i=0; i<Math.min(3, tickets.length); i++) {
        items.push(tickets[(start + i) % tickets.length]);
    }
    return items;
  }, [tickets, currentIndex]);

  const handleSwipe = (idx: number) => {
    translateX.value = 0;
    setCurrentIndex(prev => prev + 1);
  };

  if (tickets.length === 0) {
    return (
      <View style={styles.recentTicketsCard}>
        <Text style={styles.cardTitle}>Recent Tickets</Text>
        <Text style={styles.noDataText}>No recent tickets.</Text>
      </View>
    );
  }

  return (
    <View style={styles.recentTicketsCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Text style={styles.cardTitle}>Your Current Requests</Text>
        <TouchableOpacity>
           <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8' }}>View All {'>'}</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.stackContainer}>
        {displayTickets.map((t, i) => (
           <TicketCard 
             key={t.id} 
             ticket={t} 
             index={i} 
             total={displayTickets.length} 
             translateX={translateX}
             onSwipeIndex={handleSwipe}
           />
        )).reverse()}
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

// ---- Diesel Summary Card ----
function DieselSummaryCard({ totalHours, avgFuel }: { totalHours: number; avgFuel: number }) {
  return (
    <View style={styles.dieselCard}>
      <Text style={styles.cardTitle}>Diesel Logger</Text>
      <View style={styles.dieselRow}>
        <View style={styles.dieselMetric}>
          <Clock size={16} color="#64748B" />
          <Text style={styles.dieselLabel}>Runtime Today</Text>
          <Text style={styles.dieselValue}>{totalHours.toFixed(1)} hrs</Text>
        </View>
        <View style={styles.dieselDivider} />
        <View style={styles.dieselMetric}>
          <Package size={16} color="#64748B" />
          <Text style={styles.dieselLabel}>Avg Fuel Level</Text>
          <Text style={styles.dieselValue}>{Math.round(avgFuel)}%</Text>
        </View>
      </View>
    </View>
  );
}

// ---- Checklist Summary Card ----
function ChecklistSummaryCard({ done, pending }: { done: number; pending: number }) {
  const total = done + pending;
  const progress = total > 0 ? (done / total) * 100 : 0;

  return (
    <View style={styles.checklistSummaryCard}>
      <Text style={styles.cardTitle}>Daily Checklists</Text>
      <View style={styles.chkRow}>
        <View style={styles.chkProgressWrap}>
           <Svg width={60} height={60} style={{ transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={30} cy={30} r={26} stroke="#F1F5F9" strokeWidth={6} fill="none" />
              <Circle cx={30} cy={30} r={26} stroke="#3B82F6" strokeWidth={6} fill="none" strokeDasharray={`${2 * Math.PI * 26}`} strokeDashoffset={`${2 * Math.PI * 26 * (1 - progress / 100)}`} strokeLinecap="round" />
           </Svg>
           <View style={styles.chkProgressCenter}>
              <Text style={styles.chkProgressText}>{Math.round(progress)}%</Text>
           </View>
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
           <Text style={styles.chkStatsText}><Text style={{ fontWeight: '700', color: '#1A2332' }}>{done} Done</Text> out of {total}</Text>
           <Text style={styles.chkPendingText}>{pending} slots pending or missed</Text>
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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DashboardInner />
    </GestureHandlerRootView>
  );
}

function DashboardInner() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const { membership, signOut } = useAuth();
  const { theme } = useTheme();
  const colors = Colors[theme];

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
  const [validationEnabled, setValidationEnabled] = useState(false);

  const propertyInfo = useMemo(() => {
    if (!membership) return { name: '', code: '', role: '' };
    const prop = membership.properties?.find((p) => p.id === propertyId);
    return { 
      name: prop?.name ?? '', 
      code: prop?.code ?? '',
      role: (prop as any)?.role ?? '' // Derive role from property link metadata
    };
  }, [membership, propertyId]);

  const isTenantRole = propertyInfo.role === 'tenant' || propertyInfo.role === 'super_tenant';

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
        if (isTenantRole) q = q.eq('internal', false);
        if (dateFilter) q = q.gte('created_at', dateFilter);
        return q;
      };

      const [
        totalRes,
        openRes,
        inProgressRes,
        resolvedRes,
        pendingValRes,
        urgentOpenRes,
        recentRes,
        validationRes,
        elecRes,
      ] = await Promise.all([
        makeTicketQuery(),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).filter('property_id', 'eq', propertyId).filter('status', 'in', '("open","blocked","client_raised")').filter('created_at', 'gte', dateFilter ?? '2000-01-01').filter('internal', 'in', isTenantRole ? '(false)' : '(true,false)'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).filter('property_id', 'eq', propertyId).filter('status', 'in', '("assigned","in_progress","paused","work_started")').filter('created_at', 'gte', dateFilter ?? '2000-01-01').filter('internal', 'in', isTenantRole ? '(false)' : '(true,false)'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).filter('property_id', 'eq', propertyId).filter('status', 'in', '("resolved","closed","satisfied","pending_validation")').filter('created_at', 'gte', dateFilter ?? '2000-01-01').filter('internal', 'in', isTenantRole ? '(false)' : '(true,false)'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('status', 'pending_validation').gte('created_at', dateFilter ?? '2000-01-01').filter('internal', 'in', isTenantRole ? '(false)' : '(true,false)'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).in('priority', ['urgent', 'high', 'critical']).not('status', 'in', '("resolved","closed","satisfied")').gte('created_at', dateFilter ?? '2000-01-01').filter('internal', 'in', isTenantRole ? '(false)' : '(true,false)'),
        supabase.from('tickets').select('id, title, status, created_at, priority, description, ticket_id, due_date, internal, assigned_to_user:assigned_to(full_name)').eq('property_id', propertyId).filter('internal', 'in', isTenantRole ? '(false)' : '(true,false)').order('created_at', { ascending: false }).limit(5),
        supabase.from('property_features').select('is_enabled').eq('property_id', propertyId).eq('feature_key', 'ticket_validation').maybeSingle() as any,
        supabase.from('electricity_readings').select('computed_units, reading_date').eq('property_id', propertyId).gte('reading_date', monthStart),
        supabase.from('diesel_readings').select('opening_hours, closing_hours, closing_diesel_level').eq('property_id', propertyId).gte('reading_date', today),
        supabase.from('sop_completions').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).gte('completion_date', today),
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
        dieselStats: {
          totalHoursToday: (recentRes as any)[3]?.data?.reduce((acc: number, r: any) => acc + (Math.max(0, (r.closing_hours || 0) - (r.opening_hours || 0))), 0) ?? 0,
          avgFuelLevel: (recentRes as any)[3]?.data?.length > 0 ? (recentRes as any)[3]?.data?.reduce((acc: number, r: any) => acc + (r.closing_diesel_level || 0), 0) / (recentRes as any)[3]?.data?.length : 0,
          activeGens: (recentRes as any)[3]?.data?.length ?? 0,
        },
        checklistStats: {
            doneToday: (recentRes as any)[4]?.count ?? 0,
            pendingToday: 0, // Simplified: needs target count logic
        }
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
                  <Text style={styles.dotLabel}>{stats.ticketStats.open} Open</Text>
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
          <DieselSummaryCard totalHours={stats.dieselStats.totalHoursToday} avgFuel={stats.dieselStats.avgFuelLevel} />
          <ChecklistSummaryCard done={stats.checklistStats.doneToday} pending={stats.checklistStats.pendingToday || 4} />
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
  // Shuffle Cards
  stackContainer: {
    height: 360,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  shuffleCard: {
    position: 'absolute',
    width: SCREEN_WIDTH - 64,
    height: 330,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
  },
  cardTicketId: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: '#1A2332',
  },
  cardTicketDate: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 11,
    color: '#94A3B8',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontFamily: 'Urbanist-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#1A2332',
    marginBottom: 8,
  },
  assigneeText: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    marginBottom: 16,
  },
  slaCol: {
    flex: 1,
  },
  slaLabel: {
    fontFamily: 'Poppins-Bold',
    fontSize: 9,
    textTransform: 'uppercase',
    color: '#94A3B8',
    marginBottom: 4,
  },
  slaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slaValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
    color: '#F59E0B',
  },
  typeCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  typeValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
    color: '#1A2332',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cardBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBtnText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  // Diesel Card
  dieselCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dieselRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  dieselMetric: {
    flex: 1,
    alignItems: 'center',
  },
  dieselLabel: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 10,
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  dieselValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#1A2332',
    marginTop: 2,
  },
  dieselDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#F1F5F9',
  },
  // Checklist Card
  checklistSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  chkProgressWrap: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chkProgressCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chkProgressText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 12,
    color: '#1A2332',
  },
  chkStatsText: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 14,
    color: '#64748B',
  },
  chkPendingText: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
});
