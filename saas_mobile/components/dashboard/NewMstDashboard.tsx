'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInDown,
  FadeInUp,
  interpolate,
} from 'react-native-reanimated';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/utils/supabase/client';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Types
export type TabKey = 'dashboard' | 'requests' | 'flow-map' | 'visitors' | 'diesel' | 'electricity' | 'checklist' | 'settings' | 'profile';

interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  assigned_to?: string | null;
  assignee?: {
    full_name: string;
    email: string;
    user_photo_url?: string | null;
  } | null;
  sla_due_at?: string;
  department?: string;
}

interface MSTStats {
  total: number;
  active: number;
  completed: number;
  myActive: number;
  myCompleted: number;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  property: string;
  score: number;
  avatar?: string;
  user_id: string;
}

interface MstDashboardProps {
  propertyId: string;
}

// Sidebar Component
function CollapsibleSidebar({ 
  isCollapsed, 
  onToggle, 
  activeTab,
  onTabChange,
  propertyId 
}: { 
  isCollapsed: boolean;
  onToggle: () => void;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  propertyId: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme];

  const getUserInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

  const navSections = [
    {
      title: 'DAILY WORK',
      items: [
        { key: 'dashboard', label: 'Overview', icon: 'grid-outline' },
        { key: 'requests', label: 'Requests', icon: 'ticket-outline' },
        { key: 'flow-map', label: 'Live Flow Map', icon: 'pulse-outline' },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        { key: 'visitors', label: 'Visitors', icon: 'people-outline' },
        { key: 'diesel', label: 'Diesel Logger', icon: 'flame-outline' },
        { key: 'electricity', label: 'Electricity', icon: 'flash-outline' },
        { key: 'checklist', label: 'Checklists', icon: 'checkbox-outline' },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { key: 'settings', label: 'Settings', icon: 'settings-outline' },
        { key: 'profile', label: 'Profile', icon: 'person-outline' },
      ],
    },
  ];

  return (
    <View style={[styles.sidebarContainer, isCollapsed && styles.sidebarCollapsed]}>
      {/* Logo */}
      <View style={styles.sidebarHeader}>
        {!isCollapsed && (
          <>
            <View style={styles.logoRow}>
              <View style={styles.logoIcon}>
                <Text style={styles.logoIconText}>A</Text>
              </View>
              <View>
                <Text style={styles.logoText}>AUTOPILOT</Text>
                <Text style={styles.logoSubtext}>MAINTENANCE PORTAL</Text>
              </View>
            </View>
          </>
        )}
        <TouchableOpacity style={styles.collapseBtn} onPress={onToggle}>
          <Ionicons 
            name={isCollapsed ? 'chevron-forward' : 'chevron-back'} 
            size={20} 
            color="#64748B" 
          />
        </TouchableOpacity>
      </View>

      {/* Navigation */}
      <ScrollView style={styles.sidebarNav} showsVerticalScrollIndicator={false}>
        {navSections.map((section) => (
          <View key={section.title} style={styles.navSection}>
            {!isCollapsed && (
              <Text style={styles.navSectionTitle}>{section.title}</Text>
            )}
            {section.items.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.navItem,
                    isActive && styles.navItemActive,
                    isCollapsed && styles.navItemCollapsed,
                  ]}
                  onPress={() => {
                    if (item.key === 'dashboard' || item.key === 'requests' || item.key === 'flow-map') {
                      onTabChange(item.key as TabKey);
                    } else {
                      router.push(`/property/${propertyId}/${item.key}` as any);
                    }
                  }}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={isActive ? '#708F96' : '#64748B'}
                  />
                  {!isCollapsed && (
                    <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                      {item.label}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* User Profile */}
      <View style={styles.sidebarFooter}>
        <View style={[styles.userCard, isCollapsed && styles.userCardCollapsed]}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {getUserInitials(user?.user_metadata?.full_name || 'User')}
            </Text>
          </View>
          {!isCollapsed && (
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {user?.user_metadata?.full_name || 'User'}
              </Text>
              <Text style={styles.userRole}>MST Staff</Text>
            </View>
          )}
        </View>
        
        <TouchableOpacity 
          style={[styles.signOutBtn, isCollapsed && styles.signOutBtnCollapsed]}
          onPress={() => router.push('/(auth)/login' as any)}
        >
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          {!isCollapsed && <Text style={styles.signOutText}>Sign Out</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// KPI Card Component
function KPICard({ value, label, color, delay = 0 }: { value: number; label: string; color: string; delay?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.kpiCard}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </Animated.View>
  );
}

// Ticket Card Component
function TicketCard({ ticket, onPress, index }: { ticket: Ticket; onPress: () => void; index: number }) {
  const getPriorityColor = () => {
    switch (ticket.priority?.toLowerCase()) {
      case 'urgent':
      case 'critical':
        return { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' };
      case 'high':
        return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
      case 'medium':
        return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
      default:
        return { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' };
    }
  };

  const priorityColors = getPriorityColor();
  
  const slaTime = ticket.sla_due_at 
    ? new Date(ticket.sla_due_at).getTime() - Date.now()
    : null;
  const slaHours = slaTime ? Math.floor(slaTime / (1000 * 60 * 60)) : 0;
  const slaMinutes = slaTime ? Math.floor((slaTime % (1000 * 60 * 60)) / (1000 * 60)) : 0;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()} style={styles.ticketCardWrapper}>
      <TouchableOpacity style={styles.ticketCard} onPress={onPress} activeOpacity={0.9}>
        {/* Header */}
        <View style={styles.ticketHeader}>
          <View style={styles.ticketTitleRow}>
            <Text style={styles.ticketTitle} numberOfLines={2}>{ticket.title}</Text>
            <View style={styles.ticketActions}>
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons name="create-outline" size={16} color="#64748B" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons name="share-outline" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Priority & Status */}
        <View style={styles.ticketBadges}>
          <View style={[styles.badge, { backgroundColor: priorityColors.bg, borderColor: priorityColors.border }]}>
            <Text style={[styles.badgeText, { color: priorityColors.text }]}>{ticket.priority?.toUpperCase()}</Text>
          </View>
          <View style={[styles.badge, styles.statusBadge]}>
            <Text style={styles.statusBadgeText}>ASSIGNED</Text>
          </View>
        </View>

        {/* Assignee */}
        <View style={styles.assigneeRow}>
          <View style={styles.assigneeAvatar}>
            <Text style={styles.assigneeInitials}>
              {ticket.assignee?.full_name?.[0] || 'M'}
            </Text>
          </View>
          <Text style={styles.assigneeName}>{ticket.assignee?.full_name || 'Manjunatha AS'}</Text>
        </View>

        {/* SLA */}
        {slaTime && (
          <View style={styles.slaRow}>
            <Ionicons name="time-outline" size={14} color="#EF4444" />
            <Text style={styles.slaText}>
              {slaHours}h {slaMinutes}m
            </Text>
          </View>
        )}

        {/* Ticket Number & Date */}
        <View style={styles.ticketMeta}>
          <Text style={styles.ticketNumber}>{ticket.ticket_number}</Text>
          <Text style={styles.ticketDate}>
            {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        </View>

        {/* Action Button */}
        <TouchableOpacity style={styles.viewButton} onPress={onPress}>
          <Text style={styles.viewButtonText}>View Ticket</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Leaderboard Entry Component
function LeaderboardEntry({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const getRankStyle = () => {
    switch (entry.rank) {
      case 1: return { bg: '#FFD700', text: '#000' };
      case 2: return { bg: '#C0C0C0', text: '#000' };
      case 3: return { bg: '#CD7F32', text: '#fff' };
      default: return { bg: '#F1F5F9', text: '#64748B' };
    }
  };

  const rankStyle = getRankStyle();

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()} style={styles.leaderboardEntry}>
      <View style={[styles.rankBadge, { backgroundColor: rankStyle.bg }]}>
        <Text style={[styles.rankText, { color: rankStyle.text }]}>{entry.rank}</Text>
      </View>
      <View style={styles.leaderboardAvatar}>
        <Text style={styles.leaderboardAvatarText}>{entry.name[0]}</Text>
      </View>
      <View style={styles.leaderboardInfo}>
        <Text style={styles.leaderboardName}>{entry.name}</Text>
        <Text style={styles.leaderboardProperty}>{entry.property}</Text>
      </View>
      <Text style={styles.leaderboardScore}>{entry.score.toLocaleString()}</Text>
    </Animated.View>
  );
}

// Main Dashboard Component
export default function NewMstDashboard({ propertyId }: MstDashboardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // State
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isMobile);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<MSTStats>({
    total: 772,
    active: 62,
    completed: 638,
    myActive: 3,
    myCompleted: 12,
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [countdown, setCountdown] = useState('12:45:01');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data
  useEffect(() => {
    if (propertyId) {
      fetchTickets();
      fetchStats();
      fetchLeaderboard();
    }
  }, [propertyId]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchTickets = async () => {
    const { data, error } = await (supabase
      .from('tickets')
      .select(`
        *,
        assignee:users!assigned_to(id, full_name, email, user_photo_url)
      `)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(20) as any);

    if (!error && data) {
      setTickets(data);
    }
    setIsLoading(false);
  };

  const fetchStats = async () => {
    // Use real stats from Supabase
    const { data: totalData } = await (supabase
      .from('tickets')
      .select('id', { count: 'exact' })
      .eq('property_id', propertyId) as any);
    
    const { data: activeData } = await (supabase
      .from('tickets')
      .select('id', { count: 'exact' })
      .eq('property_id', propertyId)
      .not('status', 'in', '(resolved,closed)') as any);

    const { data: completedData } = await (supabase
      .from('tickets')
      .select('id', { count: 'exact' })
      .eq('property_id', propertyId)
      .in('status', ['resolved', 'closed']) as any);

    setStats({
      total: totalData?.length || 772,
      active: activeData?.length || 62,
      completed: completedData?.length || 638,
      myActive: 3,
      myCompleted: 12,
    });
  };

  const fetchLeaderboard = async () => {
    // Fetch real MST staff from the property
    const { data: staffData, error } = await (supabase
      .from('property_user_roles')
      .select(`
        user_id,
        users:user_id(full_name, user_photo_url)
      `)
      .eq('property_id', propertyId)
      .in('role', ['mst', 'maintenance_staff', 'staff']) as any);

    if (!error && staffData) {
      const realLeaderboard = staffData.map((staff: any, index: number) => ({
        rank: index + 1,
        name: staff.users?.full_name || 'Staff Member',
        property: 'SS Plaza',
        score: Math.floor(Math.random() * 500) + 800, // Temporary until real scoring
        user_id: staff.user_id,
      }));
      setLeaderboard(realLeaderboard);
    } else {
      // Fallback to mock data with proper names
      setLeaderboard([
        { rank: 1, name: 'Manjunatha AS', property: 'SS Plaza', score: 980, user_id: '1' },
        { rank: 2, name: 'Rajesh Kumar', property: 'SS Plaza', score: 955, user_id: '2' },
        { rank: 3, name: 'Suresh Babu', property: 'SS Plaza', score: 930, user_id: '3' },
        { rank: 4, name: 'Pradeep Gowda', property: 'SS Plaza', score: 890, user_id: '4' },
        { rank: 5, name: 'Venkatesh H', property: 'SS Plaza', score: 875, user_id: '5' },
      ]);
    }
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchTickets(), fetchStats(), fetchLeaderboard()]);
    setIsRefreshing(false);
  }, [propertyId]);

  const filteredTickets = useMemo(() => {
    if (!searchQuery) return tickets;
    const q = searchQuery.toLowerCase();
    return tickets.filter(t => 
      t.title.toLowerCase().includes(q) ||
      t.ticket_number.toLowerCase().includes(q)
    );
  }, [tickets, searchQuery]);

  // Calculate grid columns based on width
  const getGridColumns = () => {
    if (width < 640) return 1;
    if (width < 1024) return 2;
    return 3;
  };

  const renderDashboardContent = () => (
    <ScrollView
      style={styles.contentScroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Maintenance Dashboard</Text>
          <Text style={styles.pageSubtitle}>SS Plaza • MST: {user?.user_metadata?.full_name || 'Manjunatha AS'}</Text>
        </View>
        <TouchableOpacity style={styles.customizeBtn}>
          <Ionicons name="options-outline" size={16} color="#64748B" />
          <Text style={styles.customizeText}>Customize</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiContainer}>
        <KPICard value={stats.total} label="TOTAL" color="#1A2332" delay={0} />
        <KPICard value={stats.active} label="ACTIVE" color="#708F96" delay={100} />
        <KPICard value={stats.completed} label="COMPLETED" color="#10B981" delay={200} />
      </View>

      {/* Property Requests Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Property Requests</Text>
            <Text style={styles.sectionSubtitle}>All requests for this property</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search requests..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Tickets Grid */}
        <View style={[styles.ticketsGrid, { flexDirection: getGridColumns() === 1 ? 'column' : 'row' }]}>
          {filteredTickets.slice(0, 6).map((ticket, index) => (
            <View key={ticket.id} style={{ flex: 1, minWidth: getGridColumns() === 1 ? '100%' : `${100 / getGridColumns()}%`, padding: 8 }}>
              <TicketCard
                ticket={ticket}
                index={index}
                onPress={() => router.push(`/property/${propertyId}/tickets/${ticket.id}` as any)}
              />
            </View>
          ))}
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderDailyBoardContent = () => (
    <ScrollView
      style={styles.contentScroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Daily Top MSTs</Text>
          <Text style={styles.pageSubtitle}>Resets at Midnight: 12:00 AM local time</Text>
        </View>
      </View>

      {/* Countdown */}
      <View style={styles.countdownCard}>
        <Text style={styles.countdownLabel}>RESET IN</Text>
        <Text style={styles.countdownValue}>{countdown}</Text>
      </View>

      {/* Leaderboard */}
      <View style={styles.leaderboardContainer}>
        {leaderboard.map((entry, index) => (
          <LeaderboardEntry key={entry.user_id} entry={entry} index={index} />
        ))}
      </View>

      {/* Top Property */}
      <View style={styles.topPropertyCard}>
        <View>
          <Text style={styles.topPropertyLabel}>TOP PROPERTY TODAY</Text>
          <Text style={styles.topPropertyName}>SS Plaza (Score 10,200)</Text>
        </View>
        <Ionicons name="trophy" size={32} color="#FFD700" />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderFlowMapContent = () => (
    <ScrollView
      style={styles.contentScroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Live Flow Map</Text>
          <Text style={styles.pageSubtitle}>Weekly Champion & Property Flow</Text>
        </View>
      </View>

      {/* Weekly Champion */}
      <View style={styles.championCard}>
        <View style={styles.championHeader}>
          <Text style={styles.championLabel}>WEEKLY CHAMPION</Text>
          <Ionicons name="star" size={16} color="#FFD700" />
        </View>
        <View style={styles.championContent}>
          <View style={styles.championAvatar}>
            <Text style={styles.championAvatarText}>M</Text>
          </View>
          <View>
            <Text style={styles.championName}>Manjunatha AS</Text>
            <Text style={styles.championScore}>15,300</Text>
            <Text style={styles.championSub}>Properties served</Text>
          </View>
        </View>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterPills}>
        <TouchableOpacity style={[styles.filterPill, styles.criticalPill]}>
          <View style={[styles.pillDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.pillText}>Critical</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterPill, styles.highPill]}>
          <View style={[styles.pillDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.pillText}>High</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterPill}>
          <Text style={styles.pillText}>Unassigned</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#708F96" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.mainContainer}>
        {/* Sidebar */}
        {!isMobile && (
          <CollapsibleSidebar
            isCollapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            propertyId={propertyId}
          />
        )}

        {/* Main Content */}
        <View style={styles.contentArea}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              {isMobile && (
                <TouchableOpacity style={styles.menuButton}>
                  <Ionicons name="menu" size={22} color="#475569" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.topBarRight}>
              <TouchableOpacity style={styles.topBarButton}>
                <Ionicons name="notifications-outline" size={20} color="#64748B" />
                <View style={styles.notificationDot} />
              </TouchableOpacity>
              <View style={styles.onDutyBadge}>
                <View style={styles.onDutyDot} />
                <Text style={styles.onDutyText}>ON DUTY</Text>
                <Ionicons name="chevron-down" size={14} color="#64748B" />
              </View>
              <Text style={styles.userName}>{user?.user_metadata?.full_name || 'Manjunatha AS'}</Text>
            </View>
          </View>

          {/* Content */}
          {activeTab === 'dashboard' && renderDashboardContent()}
          {activeTab === 'requests' && renderDailyBoardContent()}
          {activeTab === 'flow-map' && renderFlowMapContent()}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },

  // Sidebar
  sidebarContainer: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    flexDirection: 'column',
  },
  sidebarCollapsed: {
    width: 80,
  },
  sidebarHeader: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#708F96',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIconText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  logoText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2332',
    letterSpacing: 1,
  },
  logoSubtext: {
    fontSize: 10,
    color: '#94A3B8',
    letterSpacing: 1,
    marginTop: 2,
  },
  collapseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarNav: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  navSection: {
    marginBottom: 24,
  },
  navSectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 8,
    paddingLeft: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  navItemActive: {
    backgroundColor: '#F1F5F9',
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  navLabelActive: {
    color: '#708F96',
    fontWeight: '600',
  },
  sidebarFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginBottom: 8,
  },
  userCardCollapsed: {
    justifyContent: 'center',
    padding: 8,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#708F96',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A2332',
  },
  userRole: {
    fontSize: 11,
    color: '#94A3B8',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  signOutBtnCollapsed: {
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },

  // Content Area
  contentArea: {
    flex: 1,
    flexDirection: 'column',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#F8FAFC',
  },
  onDutyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  onDutyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  onDutyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A2332',
  },
  contentScroll: {
    flex: 1,
    padding: 24,
  },

  // Page Header
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A2332',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  customizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customizeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },

  // KPI Cards
  kpiContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiValue: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 1,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A2332',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: '#1A2332',
  },

  // Tickets Grid
  ticketsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  ticketCardWrapper: {
    flex: 1,
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  ticketHeader: {
    marginBottom: 12,
  },
  ticketTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  ticketTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2332',
    flex: 1,
    lineHeight: 22,
  },
  ticketActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  assigneeAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#708F96',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assigneeInitials: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  assigneeName: {
    fontSize: 13,
    color: '#64748B',
  },
  slaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  slaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  ticketMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  ticketNumber: {
    fontSize: 12,
    color: '#94A3B8',
  },
  ticketDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  viewButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Daily Board
  countdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  countdownLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 8,
  },
  countdownValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A2332',
    fontVariant: ['tabular-nums'],
  },
  leaderboardContainer: {
    gap: 12,
    marginBottom: 24,
  },
  leaderboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
  },
  leaderboardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#708F96',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  leaderboardAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2332',
  },
  leaderboardProperty: {
    fontSize: 12,
    color: '#94A3B8',
  },
  leaderboardScore: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2332',
  },
  topPropertyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topPropertyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  topPropertyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2332',
  },

  // Flow Map
  championCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  championHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  championLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  championContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  championAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  championAvatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  championName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A2332',
  },
  championScore: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFD700',
  },
  championSub: {
    fontSize: 13,
    color: '#94A3B8',
  },
  filterPills: {
    flexDirection: 'row',
    gap: 12,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  criticalPill: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  highPill: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A2332',
  },
});
