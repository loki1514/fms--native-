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
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import TicketCard from '../shared/TicketCard';
import SignOutModal from '../ui/SignOutModal';
import Skeleton from '../ui/Skeleton';

// Types
type Tab = 'dashboard' | 'requests' | 'create_request' | 'visitors' | 'settings' | 'profile';

interface Property {
  id: string;
  name: string;
  code: string;
  address: string;
  organization_id?: string;
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
  internal?: boolean;
  property_id?: string;
  ticket_escalation_logs?: {
    from_level: number;
    to_level: number | null;
    escalated_at: string;
    from_employee?: { full_name: string; user_photo_url?: string | null } | null;
    to_employee?: { full_name: string; user_photo_url?: string | null } | null;
  }[];
}

interface MstDashboardProps {
  propertyId: string;
}

export default function MstDashboard({ propertyId }: MstDashboardProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();

  // State
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [property, setProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [incomingTickets, setIncomingTickets] = useState<Ticket[]>([]);
  const [completedTickets, setCompletedTickets] = useState<Ticket[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [userRole, setUserRole] = useState('MST Professional');
  const [searchQuery, setSearchQuery] = useState('');
  const [requestFilter, setRequestFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Edit Modal State
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (propertyId) {
      fetchPropertyDetails();
      fetchTickets();
      fetchUserRole();
    }
  }, [propertyId, user?.id]);

  const fetchUserRole = async () => {
    if (!user) return;
    const { data: member } = await (supabase
      .from('property_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('property_id', propertyId)
      .single() as any);

    if (member) {
      setUserRole(member.role.replace('_', ' '));
    } else {
      const { data: orgMember } = await (supabase
        .from('organization_memberships')
        .select('role')
        .eq('user_id', user.id)
        .single() as any);
      if (orgMember) setUserRole(orgMember.role.replace('_', ' '));
    }
  };

  const fetchTickets = async () => {
    if (!user || !propertyId) return;
    setIsFetching(true);

    const { data, error } = await (supabase
      .from('tickets')
      .select(`
        *,
        assignee:users!assigned_to(id, full_name, email, user_photo_url),
        ticket_escalation_logs(from_level, to_level, escalated_at, from_employee:users!from_employee_id(full_name, user_photo_url), to_employee:users!to_employee_id(full_name, user_photo_url))
      `)
      .eq('property_id', propertyId)
      .eq('internal', false)
      .order('created_at', { ascending: false }) as any);

    if (error) {
      console.error('Error fetching tickets:', error);
    } else {
      const active = (data || []).filter((t: any) => !['resolved', 'closed'].includes(t.status));
      const completed = (data || []).filter((t: any) => ['resolved', 'closed'].includes(t.status));
      setIncomingTickets(active);
      setCompletedTickets(completed);
    }
    setIsFetching(false);
  };

  const fetchPropertyDetails = async () => {
    setIsLoading(true);
    setErrorMsg('');

    const { data, error } = await (supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .maybeSingle() as any);

    if (error || !data) {
      console.error('Property fetch error:', error);
      setErrorMsg(`Property not found (ID: ${propertyId})`);
    } else {
      setProperty(data);
    }
    setIsLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchPropertyDetails(), fetchTickets()]);
    setIsRefreshing(false);
  }, [propertyId, user?.id]);

  const handleUpdateTicket = async () => {
    if (!editingTicket || !editTitle.trim()) return;
    setIsUpdating(true);
    try {
      const { error } = await (supabase.from('tickets') as any)
        .update({ title: editTitle, description: editDescription })
        .eq('id', editingTicket.id);

      if (error) throw error;
      setEditingTicket(null);
      fetchTickets();
    } catch (error) {
      console.error('Update ticket error:', error);
      Alert.alert('Error', 'Failed to update ticket');
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredIncomingTickets = useMemo(() => {
    if (!searchQuery) return incomingTickets;
    const query = searchQuery.toLowerCase();
    return incomingTickets.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.ticket_number.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query)
    );
  }, [incomingTickets, searchQuery]);

  const filteredCompletedTickets = useMemo(() => {
    if (!searchQuery) return completedTickets;
    const query = searchQuery.toLowerCase();
    return completedTickets.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.ticket_number.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query)
    );
  }, [completedTickets, searchQuery]);

  const totalTickets = incomingTickets.length + completedTickets.length;
  const activeCount = incomingTickets.filter(t => 
    t.status === 'in_progress' || t.status === 'assigned' || t.status === 'open'
  ).length;

  const renderDashboardTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Maintenance Dashboard</Text>
        <Text style={styles.headerSubtitle}>
          {property?.name || 'Property'} • MST: {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'MST'}
        </Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <TouchableOpacity 
          style={styles.statCard}
          onPress={() => setRequestFilter('all')}
        >
          <Text style={styles.statNumber}>{totalTickets}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.statCard, styles.activeStatCard]}
          onPress={() => setRequestFilter('active')}
        >
          <Text style={[styles.statNumber, styles.activeStatNumber]}>{activeCount}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.statCard}
          onPress={() => setRequestFilter('completed')}
        >
          <Text style={[styles.statNumber, styles.completedStatNumber]}>{completedTickets.length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </TouchableOpacity>
      </View>

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

      {/* Property Requests */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Property Requests</Text>
        <Text style={styles.sectionSubtitle}>All requests for this property</Text>
        
        {isFetching ? (
          <View style={styles.skeletonContainer}>
            {[1, 2, 3].map(i => (
              <Skeleton key={i} height={120} borderRadius={16} style={styles.skeletonCard} />
            ))}
          </View>
        ) : filteredIncomingTickets.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="clipboard-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>No requests found</Text>
          </View>
        ) : (
          <View style={styles.ticketsList}>
            {filteredIncomingTickets
              .sort((a, b) => {
                if (a.assigned_to === user?.id && b.assigned_to !== user?.id) return -1;
                if (a.assigned_to !== user?.id && b.assigned_to === user?.id) return 1;
                return 0;
              })
              .map((ticket) => (
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
                  assignedTo={ticket.assignee?.full_name || 'Unassigned'}
                  assigneePhotoUrl={ticket.assignee?.user_photo_url}
                  photoUrl={ticket.photo_before_url}
                  escalationChain={(() => {
                    const logs = ticket.ticket_escalation_logs;
                    if (!logs || logs.length === 0) return undefined;
                    const sorted = [...logs].sort((a, b) => 
                      new Date(a.escalated_at).getTime() - new Date(b.escalated_at).getTime()
                    );
                    const chain: { name: string; avatar?: string | null }[] = [];
                    sorted.forEach((log, i) => {
                      if (i === 0 && log.from_employee?.full_name) {
                        chain.push({ name: log.from_employee.full_name, avatar: log.from_employee.user_photo_url });
                      }
                      if (log.to_employee?.full_name) {
                        chain.push({ name: log.to_employee.full_name, avatar: log.to_employee.user_photo_url });
                      }
                    });
                    return chain.length > 0 ? chain : undefined;
                  })()}
                  onClick={() => router.push(`/tickets/${ticket.id}` as any)}
                  onEdit={() => {
                    setEditingTicket(ticket);
                    setEditTitle(ticket.title);
                    setEditDescription(ticket.description);
                  }}
                />
              ))}
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
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['all', 'active', 'completed'] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterTab, requestFilter === filter && styles.filterTabActive]}
            onPress={() => setRequestFilter(filter)}
          >
            <Text style={[styles.filterTabText, requestFilter === filter && styles.filterTabTextActive]}>
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tickets List */}
      <View style={styles.ticketsList}>
        {(requestFilter === 'all' || requestFilter === 'active') && filteredIncomingTickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            id={ticket.id}
            title={ticket.title}
            priority={(ticket.priority?.toUpperCase() as any) || 'MEDIUM'}
            status={
              ticket.status === 'in_progress' ? 'IN_PROGRESS' :
              ticket.assigned_to ? 'ASSIGNED' : 'OPEN'
            }
            ticketNumber={ticket.ticket_number}
            createdAt={ticket.created_at}
            assignedTo={ticket.assignee?.full_name || 'Unassigned'}
            assigneePhotoUrl={ticket.assignee?.user_photo_url}
            photoUrl={ticket.photo_before_url}
            onClick={() => router.push(`/tickets/${ticket.id}` as any)}
            onEdit={() => {
              setEditingTicket(ticket);
              setEditTitle(ticket.title);
              setEditDescription(ticket.description);
            }}
          />
        ))}
        {(requestFilter === 'all' || requestFilter === 'completed') && filteredCompletedTickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            id={ticket.id}
            title={ticket.title}
            priority={(ticket.priority?.toUpperCase() as any) || 'MEDIUM'}
            status="COMPLETED"
            ticketNumber={ticket.ticket_number}
            createdAt={ticket.created_at}
            assignedTo={ticket.assignee?.full_name || 'Unassigned'}
            assigneePhotoUrl={ticket.assignee?.user_photo_url}
            photoUrl={ticket.photo_before_url}
            onClick={() => router.push(`/tickets/${ticket.id}` as any)}
          />
        ))}
        {((requestFilter === 'active' && filteredIncomingTickets.length === 0) ||
          (requestFilter === 'completed' && filteredCompletedTickets.length === 0)) && (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>No {requestFilter} requests</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderProfileTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.profileBadge}>
            <Text style={styles.profileBadgeText}>{userRole}</Text>
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
          <Text style={styles.errorTitle}>Error Loading Dashboard</Text>
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
        <Text style={styles.topNavTitle}>MST Portal</Text>
        <TouchableOpacity onPress={() => setShowSignOutModal(true)}>
          <Ionicons name="log-out-outline" size={24} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {activeTab === 'dashboard' && renderDashboardTab()}
      {activeTab === 'requests' && renderRequestsTab()}
      {activeTab === 'profile' && renderProfileTab()}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setActiveTab('dashboard')}
        >
          <Ionicons 
            name={activeTab === 'dashboard' ? 'grid' : 'grid-outline'} 
            size={24} 
            color={activeTab === 'dashboard' ? '#3B82F6' : '#94A3B8'} 
          />
          <Text style={[styles.navText, activeTab === 'dashboard' && styles.navTextActive]}>Dashboard</Text>
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
          onPress={() => router.push('/tickets/create' as any)}
        >
          <View style={styles.createButton}>
            <Ionicons name="add" size={28} color="#FFF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setActiveTab('visitors')}
        >
          <Ionicons 
            name={activeTab === 'visitors' ? 'people' : 'people-outline'} 
            size={24} 
            color={activeTab === 'visitors' ? '#3B82F6' : '#94A3B8'} 
          />
          <Text style={[styles.navText, activeTab === 'visitors' && styles.navTextActive]}>Visitors</Text>
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

      {/* Edit Ticket Modal */}
      <Modal
        visible={!!editingTicket}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingTicket(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Request</Text>
              <TouchableOpacity onPress={() => setEditingTicket(null)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Request title"
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Detailed description..."
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setEditingTicket(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleUpdateTicket}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  tabContent: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#FFF',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A2332',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeStatCard: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A2332',
  },
  activeStatNumber: {
    color: '#3B82F6',
  },
  completedStatNumber: {
    color: '#10B981',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 16,
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
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2332',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 16,
  },
  skeletonContainer: {
    gap: 12,
  },
  skeletonCard: {
    marginBottom: 12,
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
  filterContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#FFF',
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
  createButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -24,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A2332',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#1A2332',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
});
