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
  Dimensions,
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
import { useGamification } from '@/hooks/mst/useGamification';
import WeatherBackground from '@/components/dashboard/WeatherBackground';
import SafeBlurView from '@/components/ui/SafeBlurView';
import TicketCard from '@/components/shared/TicketCard';
import { TicketShuffleStack } from '@/components/shared/TicketShuffleStack';
import CreateTicketModal from '@/components/shared/CreateTicketModal';
import SignOutModal from '@/components/ui/SignOutModal';
import CassandraSessionModal from '@/components/cassandra/CassandraSessionModal';
import FloatingMenu from '@/components/ui/FloatingMenu';
import SidekickFace from '@/components/dashboard/SidekickFace';
import { useCassandraStore } from '@/stores/cassandraStore';
import {
  SPACING,
  TYPOGRAPHY,
  STATUS_COLORS,
  CARD_SURFACES,
} from '@/constants/designSystem';

const { width: SCREEN_W } = Dimensions.get('window');
const fontSans = 'System';
const fontDisplay = 'System';
const BG = '#060912';

interface Ticket {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  created_at: string;
  ticket_number?: string;
  assigned_to?: string | null;
  assignee?: { full_name: string } | null;
}

interface Props {
  propertyId: string;
}

// ─── Shift Toggle Component ───────────────────────────────────────────────────
function ShiftToggle({
  isCheckedIn,
  onToggle,
}: {
  isCheckedIn: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.shiftToggle, isCheckedIn && styles.shiftToggleActive]}
      onPress={onToggle}
      activeOpacity={0.85}
    >
      <View
        style={[
          styles.shiftDot,
          { backgroundColor: isCheckedIn ? '#1FC26E' : '#D9261C' },
        ]}
      />
      <Text style={styles.shiftText}>
        {isCheckedIn ? 'ON DUTY' : 'OFF DUTY'}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Glass Stat Card ──────────────────────────────────────────────────────────
function GlassStatCard({
  label,
  value,
  icon,
  accent,
  delay,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(500)} style={{ flex: 1 }}>
      <View style={[styles.statCard, { borderColor: accent + '25' }]}>
        <SafeBlurView intensity={40} style={styles.statBlur} tint="dark">
          <LinearGradient
            colors={[accent + '15', 'rgba(25,20,50,0.3)']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.statContent}>
            <Ionicons name={icon} size={20} color={accent} />
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        </SafeBlurView>
      </View>
    </Animated.View>
  );
}

// ─── Leaderboard Entry ────────────────────────────────────────────────────────
function LeaderboardEntry({
  entry,
  index,
}: {
  entry: any;
  index: number;
}) {
  const rankColors = ['#F59E0B', '#94A3B8', '#B45309'];
  const rankColor = index < 3 ? rankColors[index] : 'rgba(255,255,255,0.30)';

  return (
    <View style={styles.leaderRow}>
      <Text style={[styles.leaderRank, { color: rankColor }]}>
        {index + 1}
      </Text>
      <View style={styles.leaderAvatar}>
        <Text style={styles.leaderAvatarText}>
          {(entry.full_name ?? 'U').charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.leaderName}>{entry.full_name || 'Unknown'}</Text>
        <Text style={styles.leaderMeta}>
          {entry.tickets_resolved ?? 0} resolved · {entry.sla_met_count ?? 0} SLA met
        </Text>
      </View>
      <Text style={styles.leaderScore}>{entry.score ?? 0} pts</Text>
    </View>
  );
}

// ─── Filter Chip ──────────────────────────────────────────────────────────────
function FilterChip({
  label,
  active,
  onPress,
  count,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  count?: number;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
      {count !== undefined && (
        <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
          <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function LovableMstDashboard({ propertyId }: Props) {
  const { user, signOut, membership } = useAuth();
  const insets = useSafeAreaInsets();
  const { weather } = useWeather();
  const router = useRouter();

  // ── State ──
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [showChat, setShowChat] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [tick, setTick] = useState(0);

  // Gamification
  const { leaderboard, myStats, loading: gamificationLoading } = useGamification(propertyId);

  // Cassandra voice state for orb
  const voiceState = useCassandraStore((s) => s.voiceState);
  const faceState: any = (() => {
    if (voiceState === 'recording' || voiceState === 'processing' || voiceState === 'connecting') return 'listening';
    if (voiceState === 'speaking') return 'speaking';
    if (voiceState === 'error') return 'alert';
    return 'idle';
  })();

  // Shared ticker for SLA timers
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!propertyId) return;
    const supabase = createClient();

    try {
      const { data: ticketData } = await supabase
        .from('tickets')
        .select('*, assignee:users!assigned_to(full_name)')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (ticketData) setTickets(ticketData as Ticket[]);

      // Shift status
      const { data: shiftData } = await supabase
        .from('resolver_stats')
        .select('is_checked_in')
        .eq('property_id', propertyId)
        .eq('user_id', user?.id as string)
        .maybeSingle();

      if (shiftData) setIsCheckedIn(!!(shiftData as any).is_checked_in);
    } catch (_) {
      {/* silent */}
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [propertyId, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  // Shift toggle
  const toggleShift = useCallback(async () => {
    const supabase = createClient();
    const newStatus = !isCheckedIn;
    setIsCheckedIn(newStatus);
    try {
      await (supabase.from('shift_logs') as any).insert({
        property_id: propertyId,
        user_id: user?.id,
        action: newStatus ? 'check_in' : 'check_out',
      });
      await (supabase.from('resolver_stats') as any)
        .upsert({ property_id: propertyId, user_id: user?.id, is_checked_in: newStatus });
    } catch (_) {
      setIsCheckedIn(!newStatus);
    }
  }, [isCheckedIn, propertyId, user?.id]);

  // Stats
  const stats = useMemo(() => {
    const total = tickets.length;
    const active = tickets.filter((t) =>
      ['open', 'in_progress', 'blocked', 'client_raised'].includes(t.status)
    ).length;
    const completed = tickets.filter((t) =>
      ['resolved', 'closed', 'satisfied'].includes(t.status)
    ).length;
    return { total, active, completed };
  }, [tickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    let list = tickets;
    if (filter === 'active') {
      list = list.filter((t) => ['open', 'in_progress', 'blocked', 'client_raised'].includes(t.status));
    } else if (filter === 'completed') {
      list = list.filter((t) => ['resolved', 'closed', 'satisfied'].includes(t.status));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.ticket_number?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tickets, filter, searchQuery]);

  // Shuffle stack tickets (open/active only)
  const shuffleTickets = useMemo(
    () => tickets.filter((t) => ['open', 'in_progress'].includes(t.status)),
    [tickets]
  );

  const orgId = membership?.org_id ?? '';

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1c2135', '#0f121e', '#07090e']} style={StyleSheet.absoluteFillObject} />
      {weather && <WeatherBackground condition={weather.condition} />}

      <FloatingMenu
        title="MST Portal"
        items={[
          { label: 'Overview', icon: 'grid', onPress: () => {} },
          { label: 'Requests', icon: 'ticket', onPress: () => {} },
          { label: 'Flow Map', icon: 'git-branch', onPress: () => router.push(`/property/${propertyId}/flow-map`) },
          { label: 'Visitors', icon: 'people', onPress: () => router.push(`/property/${propertyId}/visitors`) },
          { label: 'Diesel', icon: 'water', onPress: () => router.push(`/property/${propertyId}/diesel`) },
          { label: 'Electricity', icon: 'flash', onPress: () => router.push(`/property/${propertyId}/electricity`) },
          { label: 'Settings', icon: 'settings', onPress: () => router.push(`/property/${propertyId}/settings`) },
        ]}
        footer={{ label: 'Sign Out', icon: 'log-out-outline', danger: true, onPress: () => setShowSignOut(true) }}
      />

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
            <Text style={styles.headerTitle}>Maintenance Portal</Text>
            <Text style={styles.headerSubtitle}>{user?.email}</Text>
          </View>
          <ShiftToggle isCheckedIn={isCheckedIn} onToggle={toggleShift} />
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInUp.delay(80).duration(500)} style={styles.statsRow}>
          <GlassStatCard label="Total" value={stats.total} icon="layers" accent="#6366F1" delay={80} />
          <GlassStatCard label="Active" value={stats.active} icon="flash" accent="#3B82F6" delay={140} />
          <GlassStatCard label="Done" value={stats.completed} icon="checkmark-circle" accent="#1FC26E" delay={200} />
        </Animated.View>

        {/* Search */}
        <Animated.View entering={FadeInUp.delay(180).duration(500)} style={styles.searchBar}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.45)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tickets..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.45)" />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Filter chips */}
        <Animated.View entering={FadeInUp.delay(220).duration(500)} style={styles.chipRow}>
          <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} count={tickets.length} />
          <FilterChip label="Active" active={filter === 'active'} onPress={() => setFilter('active')} count={stats.active} />
          <FilterChip label="Completed" active={filter === 'completed'} onPress={() => setFilter('completed')} count={stats.completed} />
        </Animated.View>

        {/* Ticket Shuffle Stack (when All/Active and no search) */}
        {filter !== 'completed' && !searchQuery && shuffleTickets.length > 0 && (
          <Animated.View entering={FadeInUp.delay(260).duration(500)} style={{ marginBottom: SPACING.xl }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Incoming Requests</Text>
              <Text style={styles.sectionCount}>{shuffleTickets.length}</Text>
            </View>
            <View style={{ height: 320, alignItems: 'center' }}>
              <TicketShuffleStack
                tickets={shuffleTickets as any}
                user={user}
                propertyId={propertyId}
                onEdit={() => {}}
                tick={tick}
              />
            </View>
          </Animated.View>
        )}

        {/* Ticket list */}
        <Animated.View entering={FadeInUp.delay(300).duration(500)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {filter === 'all' ? 'All Requests' : filter === 'active' ? 'Active Requests' : 'Completed'}
            </Text>
            <Text style={styles.sectionCount}>{filteredTickets.length}</Text>
          </View>
          {filteredTickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              id={ticket.id}
              title={ticket.title}
              priority={(ticket.priority?.toUpperCase() as any) || 'MEDIUM'}
              status={
                ['closed', 'resolved'].includes(ticket.status) ? 'COMPLETED' :
                ticket.status === 'in_progress' ? 'IN_PROGRESS' :
                ticket.assigned_to ? 'ASSIGNED' : 'OPEN'
              }
              ticketNumber={ticket.ticket_number || `TKT-${ticket.id.slice(0,8)}`}
              createdAt={ticket.created_at}
              assignedTo={ticket.assignee?.full_name || 'Unassigned'}
              tick={tick}
              onClick={() => router.push(`/property/${propertyId}/tickets/${ticket.id}` as any)}
              style={{ marginBottom: 12 }}
            />
          ))}
          {filteredTickets.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="ticket-outline" size={40} color="rgba(255,255,255,0.20)" />
              <Text style={styles.emptyText}>No tickets found</Text>
            </View>
          )}
        </Animated.View>

        {/* Gamification Leaderboard */}
        {!gamificationLoading && leaderboard.length > 0 && (
          <Animated.View entering={FadeInUp.delay(340).duration(500)} style={{ marginTop: SPACING['2xl'] }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Daily Leaderboard</Text>
              {myStats && (
                <Text style={styles.sectionSubtitle}>
                  You: {myStats.today.total_points ?? 0} pts
                </Text>
              )}
            </View>
            <View style={styles.leaderboardCard}>
              {leaderboard.slice(0, 5).map((entry, i) => (
                <LeaderboardEntry key={entry.user_id ?? i} entry={entry} index={i} />
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Floating bottom nav with Cassandra */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16 }]}>
        <SafeBlurView intensity={40} style={styles.bottomNavBlur} tint="dark">
          <TouchableOpacity style={styles.navItem} onPress={() => {}}>
            <Ionicons name="grid" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => {}}>
            <Ionicons name="ticket" size={22} color="rgba(255,255,255,0.40)" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navOrb} onPress={() => setShowChat(true)}>
            <SidekickFace size={48} state={faceState} compact />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setShowCreate(true)}>
            <Ionicons name="add-circle" size={22} color="rgba(255,255,255,0.40)" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setShowSignOut(true)}>
            <Ionicons name="person" size={22} color="rgba(255,255,255,0.40)" />
          </TouchableOpacity>
        </SafeBlurView>
      </View>

      {/* Modals */}
      <CassandraSessionModal visible={showChat} onClose={() => setShowChat(false)} orgId={orgId} />
      <CreateTicketModal visible={showCreate} onClose={() => setShowCreate(false)} propertyId={propertyId} />
      <SignOutModal isOpen={showSignOut} onClose={() => setShowSignOut(false)} onConfirm={signOut} />
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
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fontDisplay,
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontFamily: fontSans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  shiftToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  shiftToggleActive: {
    borderColor: 'rgba(31,194,110,0.30)',
    backgroundColor: 'rgba(31,194,110,0.10)',
  },
  shiftDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  shiftText: {
    fontFamily: fontSans,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: CARD_SURFACES.cardBorder,
    height: 110,
  },
  statBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: fontDisplay,
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  statLabel: {
    fontFamily: fontSans,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_SURFACES.cardBg,
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 3,
    borderRadius: 14,
    borderColor: CARD_SURFACES.cardBorder,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: fontSans,
    paddingVertical: 0,
  },
  chipRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  chipActive: {
    backgroundColor: 'rgba(112,143,150,0.25)',
    borderColor: 'rgba(112,143,150,0.40)',
  },
  chipText: {
    fontFamily: fontSans,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.50)',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipBadge: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  chipBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  chipBadgeText: {
    fontFamily: fontSans,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.60)',
  },
  chipBadgeTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontFamily: fontDisplay,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionCount: {
    fontFamily: fontSans,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
  },
  sectionSubtitle: {
    fontFamily: fontSans,
    fontSize: 13,
    fontWeight: '600',
    color: '#708F96',
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
  leaderboardCard: {
    backgroundColor: CARD_SURFACES.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_SURFACES.cardBorder,
    marginHorizontal: SPACING.xl,
    padding: SPACING.lg,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  leaderRank: {
    fontFamily: fontDisplay,
    fontSize: 14,
    fontWeight: '800',
    width: 24,
  },
  leaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaderAvatarText: {
    fontFamily: fontDisplay,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leaderName: {
    fontFamily: fontSans,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  leaderMeta: {
    fontFamily: fontSans,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  leaderScore: {
    fontFamily: fontDisplay,
    fontSize: 14,
    fontWeight: '700',
    color: '#708F96',
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
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.60)',
    zIndex: 30,
    flexDirection: 'row',
  },
  drawer: {
    width: 280,
    height: '100%',
    backgroundColor: '#0a0c14',
    paddingHorizontal: 20,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
  },
  drawerTitle: {
    fontFamily: fontDisplay,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  drawerItemText: {
    fontFamily: fontSans,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.80)',
  },
  drawerSignOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 32,
    paddingVertical: 12,
  },
  drawerSignOutText: {
    fontFamily: fontSans,
    fontSize: 15,
    fontWeight: '600',
    color: '#FF3B30',
  },
});
