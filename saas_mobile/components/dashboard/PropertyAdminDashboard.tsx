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
  Modal,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import TicketCard from '../shared/TicketCard';
import SignOutModal from '../ui/SignOutModal';
import Skeleton from '../ui/Skeleton';

// Types
type Tab = 'overview' | 'requests' | 'users' | 'visitors' | 'diesel' | 'electricity' | 'settings' | 'profile';

interface Property {
  id: string;
  name: string;
  code: string;
  address: string;
  organization_id: string;
  image_url?: string;
}

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
  photo_before_url?: string;
  raised_by?: string;
  raised_by_name?: string;
  internal?: boolean;
}

interface DashboardStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  urgent: number;
}

interface PropertyAdminDashboardProps {
  propertyId: string;
}

export default function PropertyAdminDashboard({ propertyId }: PropertyAdminDashboardProps) {
  const { user, signOut, membership } = useAuth();
  const router = useRouter();

  // State
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [property, setProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    urgent: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const supabase = useMemo(() => createClient(), []);

  // Get assigned properties for switcher
  const assignedProperties = useMemo(() =>
    (membership?.properties || [])
      .filter(p => !['tenant', 'super_tenant'].includes((p.role || '').toLowerCase()))
      .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i),
    [membership]
  );

  useEffect(() => {
    if (propertyId) {
      fetchPropertyDetails();
      fetchTickets();
    }
  }, [propertyId]);

  const fetchTickets = async () => {
    if (!propertyId) return;

    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        assignee:users!assigned_to(full_name, email, user_photo_url)
      `)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tickets:', error);
    } else {
      const ticketData = data || [];
      setTickets(ticketData);
      
      // Calculate stats
      setStats({
        total: ticketData.length,
        open: ticketData.filter((t: any) => t.status === 'open').length,
        in_progress: ticketData.filter((t: any) => ['in_progress', 'assigned'].includes(t.status)).length,
        resolved: ticketData.filter((t: any) => ['resolved', 'closed'].includes(t.status)).length,
        urgent: ticketData.filter((t: any) => 
          ['urgent', 'high'].includes(t.priority) && !['resolved', 'closed'].includes(t.status)
        ).length,
      });
    }
  };

  const fetchPropertyDetails = async () => {
    setIsLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .maybeSingle();

      if (error || !data) {
        setErrorMsg('Property not found.');
      } else {
        setProperty(data);
      }
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchPropertyDetails(), fetchTickets()]);
    setIsRefreshing(false);
  }, [propertyId]);

  const filteredTickets = useMemo(() => {
    let result = tickets;
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.ticket_number.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(t => {
        if (statusFilter === 'open') return t.status === 'open';
        if (statusFilter === 'in_progress') return ['in_progress', 'assigned'].includes(t.status);
        if (statusFilter === 'resolved') return ['resolved', 'closed'].includes(t.status);
        return true;
      });
    }
    
    return result;
  }, [tickets, searchQuery, statusFilter]);

  const renderOverviewTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {/* Property Header */}
      <View style={styles.propertyHeader}>
        <View style={styles.propertyIcon}>
          <Ionicons name="business" size={32} color="#3B82F6" />
        </View>
        <View style={styles.propertyInfo}>
          <Text style={styles.propertyName}>{property?.name}</Text>
          <Text style={styles.propertyAddress}>{property?.address || 'No address set'}</Text>
          <View style={styles.propertyCodeBadge}>
            <Text style={styles.propertyCodeText}>{property?.code}</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.quickActionBtn}
          onPress={() => router.push('/tickets/create' as any)}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="add-circle" size={24} color="#3B82F6" />
          </View>
          <Text style={styles.quickActionText}>New Request</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickActionBtn}
          onPress={() => setActiveTab('users')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="people" size={24} color="#10B981" />
          </View>
          <Text style={styles.quickActionText}>Users</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickActionBtn}
          onPress={() => setActiveTab('visitors')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#FDF4FF' }]}>
            <Ionicons name="person-add" size={24} color="#A855F7" />
          </View>
          <Text style={styles.quickActionText}>Visitors</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCardLarge}>
          <Text style={styles.statNumberLarge}>{stats.total}</Text>
          <Text style={styles.statLabelLarge}>Total Requests</Text>
        </View>
        <View style={styles.statsColumn}>
          <View style={[styles.statCardSmall, styles.statCardUrgent]}>
            <Text style={[styles.statNumberSmall, styles.statNumberUrgent]}>{stats.urgent}</Text>
            <Text style={[styles.statLabelSmall, styles.statLabelUrgent]}>Urgent</Text>
          </View>
          <View style={styles.statCardSmall}>
            <Text style={styles.statNumberSmall}>{stats.open}</Text>
            <Text style={styles.statLabelSmall}>Open</Text>
          </View>
        </View>
      </View>

      {/* Secondary Stats */}
      <View style={styles.secondaryStats}>
        <View style={styles.secondaryStat}>
          <View style={[styles.secondaryStatIcon, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="time" size={20} color="#F59E0B" />
          </View>
          <View>
            <Text style={styles.secondaryStatNumber}>{stats.in_progress}</Text>
            <Text style={styles.secondaryStatLabel}>In Progress</Text>
          </View>
        </View>
        <View style={styles.secondaryStat}>
          <View style={[styles.secondaryStatIcon, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          </View>
          <View>
            <Text style={styles.secondaryStatNumber}>{stats.resolved}</Text>
            <Text style={styles.secondaryStatLabel}>Resolved</Text>
          </View>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Requests</Text>
          <TouchableOpacity onPress={() => setActiveTab('requests')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        
        {tickets.slice(0, 3).map((ticket) => (
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
            ticketNumber={ticket.ticket_number}
            createdAt={ticket.created_at}
            assignedTo={ticket.assignee?.full_name}
            assigneePhotoUrl={ticket.assignee?.user_photo_url}
            photoUrl={ticket.photo_before_url}
            onClick={() => router.push(`/tickets/${ticket.id}` as any)}
          />
        ))}
        
        {tickets.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="clipboard-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>No requests yet</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderRequestsTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search requests..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Status Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        {[
          { key: 'all', label: 'All', icon: 'layers' },
          { key: 'open', label: 'Open', icon: 'alert-circle' },
          { key: 'in_progress', label: 'In Progress', icon: 'time' },
          { key: 'resolved', label: 'Resolved', icon: 'checkmark-circle' },
        ].map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[styles.filterChip, statusFilter === filter.key && styles.filterChipActive]}
            onPress={() => setStatusFilter(filter.key)}
          >
            <Ionicons 
              name={filter.icon as any} 
              size={16} 
              color={statusFilter === filter.key ? '#FFF' : '#64748B'} 
            />
            <Text style={[styles.filterChipText, statusFilter === filter.key && styles.filterChipTextActive]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tickets List */}
      <View style={styles.ticketsList}>
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
            ticketNumber={ticket.ticket_number}
            createdAt={ticket.created_at}
            assignedTo={ticket.assignee?.full_name}
            assigneePhotoUrl={ticket.assignee?.user_photo_url}
            photoUrl={ticket.photo_before_url}
            onClick={() => router.push(`/tickets/${ticket.id}` as any)}
          />
        ))}
        
        {filteredTickets.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>No requests found</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderUsersTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.comingSoon}>
        <Ionicons name="people-outline" size={64} color="#CBD5E1" />
        <Text style={styles.comingSoonTitle}>User Management</Text>
        <Text style={styles.comingSoonText}>
          Manage property users, assign roles, and view activity.
        </Text>
      </View>
    </ScrollView>
  );

  const renderVisitorsTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.comingSoon}>
        <Ionicons name="person-add-outline" size={64} color="#CBD5E1" />
        <Text style={styles.comingSoonTitle}>Visitor Management</Text>
        <Text style={styles.comingSoonText}>
          Track visitors, manage check-ins, and view visitor history.
        </Text>
      </View>
    </ScrollView>
  );

  const renderProfileTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'P'}
            </Text>
          </View>
          <View style={styles.profileBadge}>
            <Text style={styles.profileBadgeText}>Property Admin</Text>
          </View>
        </View>

        <View style={styles.profileInfo}>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Full Name</Text>
            <Text style={styles.profileValue}>{user?.user_metadata?.full_name || 'Not Set'}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Phone</Text>
            <Text style={styles.profileValue}>{user?.user_metadata?.phone || 'Not Set'}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Email</Text>
            <Text style={styles.profileValue}>{user?.email || 'Not Set'}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Property</Text>
            <Text style={styles.profileValue}>{property?.name || 'Not Assigned'}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.signOutButton}
        onPress={() => setShowSignOutModal(true)}
      >
        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  if (isLoading && !property) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!property) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Unable to Load Dashboard</Text>
          <Text style={styles.errorText}>{errorMsg || 'Property not found.'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchPropertyDetails}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Top Navigation */}
      <View style={styles.topNav}>
        <View>
          <Text style={styles.topNavTitle}>Property Admin</Text>
          <Text style={styles.topNavSubtitle}>{property?.name}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowSignOutModal(true)}>
          <Ionicons name="log-out-outline" size={24} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'requests' && renderRequestsTab()}
      {activeTab === 'users' && renderUsersTab()}
      {activeTab === 'visitors' && renderVisitorsTab()}
      {activeTab === 'profile' && renderProfileTab()}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setActiveTab('overview')}
        >
          <Ionicons 
            name={activeTab === 'overview' ? 'grid' : 'grid-outline'} 
            size={24} 
            color={activeTab === 'overview' ? '#3B82F6' : '#94A3B8'} 
          />
          <Text style={[styles.navText, activeTab === 'overview' && styles.navTextActive]}>Overview</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setActiveTab('requests')}
        >
          <Ionicons 
            name={activeTab === 'requests' ? 'ticket' : 'ticket-outline'} 
            size={24} 
            color={activeTab === 'requests' ? '#3B82F6' : '#94A3B8'} 
          />
          <Text style={[styles.navText, activeTab === 'requests' && styles.navTextActive]}>Requests</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setActiveTab('users')}
        >
          <Ionicons 
            name={activeTab === 'users' ? 'people' : 'people-outline'} 
            size={24} 
            color={activeTab === 'users' ? '#3B82F6' : '#94A3B8'} 
          />
          <Text style={[styles.navText, activeTab === 'users' && styles.navTextActive]}>Users</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setActiveTab('profile')}
        >
          <Ionicons 
            name={activeTab === 'profile' ? 'person' : 'person-outline'} 
            size={24} 
            color={activeTab === 'profile' ? '#3B82F6' : '#94A3B8'} 
          />
          <Text style={[styles.navText, activeTab === 'profile' && styles.navTextActive]}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Sign Out Modal */}
      <SignOutModal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        onConfirm={signOut}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A2332',
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topNavTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2332',
  },
  topNavSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  tabContent: {
    flex: 1,
  },
  propertyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF',
    marginBottom: 12,
  },
  propertyIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  propertyInfo: {
    flex: 1,
  },
  propertyName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A2332',
  },
  propertyAddress: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  propertyCodeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  propertyCodeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A2332',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 12,
  },
  statCardLarge: {
    flex: 1.5,
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    padding: 20,
    justifyContent: 'center',
  },
  statNumberLarge: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFF',
  },
  statLabelLarge: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statsColumn: {
    flex: 1,
    gap: 12,
  },
  statCardSmall: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statCardUrgent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statNumberSmall: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A2332',
  },
  statNumberUrgent: {
    color: '#EF4444',
  },
  statLabelSmall: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  statLabelUrgent: {
    color: '#EF4444',
  },
  secondaryStats: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  secondaryStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  secondaryStatIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryStatNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A2332',
  },
  secondaryStatLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2332',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 15,
    color: '#94A3B8',
    fontWeight: '500',
  },
  ticketsList: {
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: '#1A2332',
  },
  filterScroll: {
    maxHeight: 60,
  },
  filterContainer: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  comingSoon: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 100,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A2332',
    marginTop: 16,
  },
  comingSoonText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  profileCard: {
    backgroundColor: '#FFF',
    margin: 20,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileAvatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFF',
  },
  profileBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  profileBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B82F6',
    textTransform: 'uppercase',
  },
  profileInfo: {
    gap: 16,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  profileLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  profileValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2332',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 4,
  },
  navTextActive: {
    color: '#3B82F6',
  },
});
