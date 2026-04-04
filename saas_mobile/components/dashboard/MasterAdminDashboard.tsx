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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import SignOutModal from '../ui/SignOutModal';
import Skeleton from '../ui/Skeleton';

// Types
type Tab = 'overview' | 'organizations' | 'users' | 'tickets' | 'settings' | 'profile';

interface Organization {
  id: string;
  name: string;
  code: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  properties?: { count: number }[];
}

interface SystemUser {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  is_master_admin?: boolean;
}

interface DashboardStats {
  entities: number;
  activeSessions: number;
  securityAlerts: number;
  pendingDeletions: number;
}

export default function MasterAdminDashboard() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  // State
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    entities: 0,
    activeSessions: 0,
    securityAlerts: 0,
    pendingDeletions: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCode, setNewOrgCode] = useState('');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    checkMasterAdmin();
  }, [user]);

  const checkMasterAdmin = async () => {
    if (!user) return;
    
    const { data: userProfile } = await (supabase
      .from('users')
      .select('is_master_admin')
      .eq('id', user.id)
      .single() as any);

    if (userProfile?.is_master_admin) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchOrganizations(),
      fetchUsers(),
      fetchStats(),
    ]);
    setIsLoading(false);
  };

  const fetchOrganizations = async () => {
    const { data, error } = await (supabase
      .from('organizations')
      .select('*, properties(count)')
      .order('created_at', { ascending: false }) as any);

    if (error) {
      console.error('Error fetching organizations:', error);
    } else {
      setOrganizations(data ?? []);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/dashboard-stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  }, []);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim() || !newOrgCode.trim()) return;
    
    setIsCreatingOrg(true);
    try {
      const { error } = await (supabase
        .from('organizations')
        .insert([{
          name: newOrgName.trim(),
          code: newOrgCode.trim().toLowerCase(),
          is_deleted: false,
        }] as any));

      if (error) throw error;
      
      setShowCreateOrgModal(false);
      setNewOrgName('');
      setNewOrgCode('');
      fetchOrganizations();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create organization');
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const handleSoftDeleteOrg = async (orgId: string) => {
    Alert.alert(
      'Delete Organization',
      'Are you sure you want to mark this organization for deletion? It will be in a 24-hour cooling period.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await (supabase as any)
              .from('organizations')
              .update({
                is_deleted: true,
                deleted_at: new Date().toISOString()
              })
              .eq('id', orgId);
            fetchOrganizations();
          }
        }
      ]
    );
  };

  const handleRestoreOrg = async (orgId: string) => {
    await (supabase as any)
      .from('organizations')
      .update({
        is_deleted: false,
        deleted_at: null
      })
      .eq('id', orgId);
    fetchOrganizations();
  };

  const filteredOrganizations = useMemo(() => {
    if (!searchQuery) return organizations;
    const query = searchQuery.toLowerCase();
    return organizations.filter(o =>
      o.name.toLowerCase().includes(query) ||
      o.code.toLowerCase().includes(query)
    );
  }, [organizations, searchQuery]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(u =>
      u.full_name?.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const renderOverviewTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Master Control</Text>
        <Text style={styles.headerSubtitle}>System-wide oversight and governance</Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.statCardBlue]}>
          <Ionicons name="business" size={24} color="#3B82F6" />
          <Text style={styles.statNumber}>{stats.entities}</Text>
          <Text style={styles.statLabel}>Organizations</Text>
        </View>
        <View style={[styles.statCard, styles.statCardGreen]}>
          <Ionicons name="pulse" size={24} color="#10B981" />
          <Text style={styles.statNumber}>{stats.activeSessions}</Text>
          <Text style={styles.statLabel}>Active Sessions</Text>
        </View>
        <View style={[styles.statCard, styles.statCardPurple]}>
          <Ionicons name="shield-checkmark" size={24} color="#8B5CF6" />
          <Text style={styles.statNumber}>{stats.securityAlerts}</Text>
          <Text style={styles.statLabel}>Security Alerts</Text>
        </View>
        <View style={[styles.statCard, styles.statCardRed]}>
          <Ionicons name="trash" size={24} color="#EF4444" />
          <Text style={styles.statNumber}>{stats.pendingDeletions}</Text>
          <Text style={styles.statLabel}>Pending Deletions</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickActionBtn}
            onPress={() => setShowCreateOrgModal(true)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="add-circle" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.quickActionText}>New Organization</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionBtn}
            onPress={() => setActiveTab('users')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="person-add" size={24} color="#10B981" />
            </View>
            <Text style={styles.quickActionText}>Add User</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionBtn}
            onPress={() => setActiveTab('tickets')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#FDF4FF' }]}>
              <Ionicons name="ticket" size={24} color="#A855F7" />
            </View>
            <Text style={styles.quickActionText}>View Tickets</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Organizations */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Organizations</Text>
          <TouchableOpacity onPress={() => setActiveTab('organizations')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        
        {organizations.slice(0, 3).map((org) => (
          <View key={org.id} style={[styles.orgCard, org.is_deleted && styles.orgCardDeleted]}>
            <View style={styles.orgIcon}>
              <Text style={styles.orgIconText}>{org.name.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View style={styles.orgInfo}>
              <Text style={[styles.orgName, org.is_deleted && styles.orgNameDeleted]}>
                {org.name}
              </Text>
              <Text style={styles.orgCode}>/{org.code}</Text>
            </View>
            <View style={styles.orgMeta}>
              {org.is_deleted ? (
                <View style={styles.deletedBadge}>
                  <Text style={styles.deletedBadgeText}>Cooling Down</Text>
                </View>
              ) : (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
              )}
            </View>
          </View>
        ))}
        
        {organizations.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>No organizations yet</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderOrganizationsTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search organizations..."
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

      {/* Create Button */}
      <TouchableOpacity 
        style={styles.createButton}
        onPress={() => setShowCreateOrgModal(true)}
      >
        <Ionicons name="add" size={20} color="#FFF" />
        <Text style={styles.createButtonText}>Create Organization</Text>
      </TouchableOpacity>

      {/* Organizations List */}
      <View style={styles.listContainer}>
        {filteredOrganizations.map((org) => (
          <View key={org.id} style={[styles.orgCard, org.is_deleted && styles.orgCardDeleted]}>
            <View style={styles.orgIcon}>
              <Text style={styles.orgIconText}>{org.name.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View style={styles.orgInfo}>
              <Text style={[styles.orgName, org.is_deleted && styles.orgNameDeleted]}>
                {org.name}
              </Text>
              <Text style={styles.orgCode}>/{org.code}</Text>
              <Text style={styles.orgProperties}>
                {org.properties?.[0]?.count || 0} Properties
              </Text>
            </View>
            <View style={styles.orgActions}>
              {org.is_deleted ? (
                <TouchableOpacity 
                  style={styles.restoreButton}
                  onPress={() => handleRestoreOrg(org.id)}
                >
                  <Ionicons name="refresh" size={18} color="#3B82F6" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => handleSoftDeleteOrg(org.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        
        {filteredOrganizations.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>No organizations found</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderUsersTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
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

      {/* Users List */}
      <View style={styles.listContainer}>
        {filteredUsers.map((user) => (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {user.full_name?.substring(0, 2).toUpperCase() || user.email.substring(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.full_name || 'Unknown User'}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              {user.is_master_admin && (
                <View style={styles.masterBadge}>
                  <Text style={styles.masterBadgeText}>MASTER</Text>
                </View>
              )}
            </View>
          </View>
        ))}
        
        {filteredUsers.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>No users found</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderTicketsTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.comingSoon}>
        <Ionicons name="ticket-outline" size={64} color="#CBD5E1" />
        <Text style={styles.comingSoonTitle}>Support Tickets</Text>
        <Text style={styles.comingSoonText}>
          View and manage all support tickets across the platform.
        </Text>
      </View>
    </ScrollView>
  );

  const renderProfileTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={[styles.profileAvatar, { backgroundColor: '#7C3AED' }]}>
            <Text style={styles.profileAvatarText}>
              {user?.email?.[0].toUpperCase() || 'M'}
            </Text>
          </View>
          <View style={[styles.profileBadge, { backgroundColor: '#7C3AED' }]}>
            <Text style={[styles.profileBadgeText, { color: '#FFF' }]}>Master Admin</Text>
          </View>
        </View>

        <View style={styles.profileInfo}>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Email</Text>
            <Text style={styles.profileValue}>{user?.email || 'Not Set'}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Role</Text>
            <Text style={styles.profileValue}>Platform Administrator</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Access Level</Text>
            <Text style={styles.profileValue}>Full System Access</Text>
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading master dashboard...</Text>
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
          <Text style={styles.topNavTitle}>Master Control</Text>
          <Text style={styles.topNavSubtitle}>System Administration</Text>
        </View>
        <TouchableOpacity onPress={() => setShowSignOutModal(true)}>
          <Ionicons name="log-out-outline" size={24} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'organizations' && renderOrganizationsTab()}
      {activeTab === 'users' && renderUsersTab()}
      {activeTab === 'tickets' && renderTicketsTab()}
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
          onPress={() => setActiveTab('organizations')}
        >
          <Ionicons 
            name={activeTab === 'organizations' ? 'business' : 'business-outline'} 
            size={24} 
            color={activeTab === 'organizations' ? '#3B82F6' : '#94A3B8'} 
          />
          <Text style={[styles.navText, activeTab === 'organizations' && styles.navTextActive]}>Orgs</Text>
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

      {/* Create Organization Modal */}
      <Modal
        visible={showCreateOrgModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateOrgModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Organization</Text>
              <TouchableOpacity onPress={() => setShowCreateOrgModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Organization Name</Text>
            <TextInput
              style={styles.input}
              value={newOrgName}
              onChangeText={setNewOrgName}
              placeholder="e.g., Acme Corporation"
            />

            <Text style={styles.inputLabel}>Organization Code</Text>
            <TextInput
              style={styles.input}
              value={newOrgCode}
              onChangeText={setNewOrgCode}
              placeholder="e.g., acme-corp"
              autoCapitalize="none"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowCreateOrgModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, (!newOrgName.trim() || !newOrgCode.trim()) && styles.saveButtonDisabled]}
                onPress={handleCreateOrg}
                disabled={!newOrgName.trim() || !newOrgCode.trim() || isCreatingOrg}
              >
                {isCreatingOrg ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Create</Text>
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statCardBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  statCardGreen: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  statCardPurple: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  statCardRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A2332',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 4,
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
  quickActions: {
    flexDirection: 'row',
    gap: 12,
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
  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  orgCardDeleted: {
    opacity: 0.6,
    backgroundColor: '#F9FAFB',
  },
  orgIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orgIconText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  orgInfo: {
    flex: 1,
  },
  orgName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2332',
  },
  orgNameDeleted: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  orgCode: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  orgProperties: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  orgMeta: {
    alignItems: 'flex-end',
  },
  activeBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    textTransform: 'uppercase',
  },
  deletedBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deletedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
    textTransform: 'uppercase',
  },
  orgActions: {
    marginLeft: 12,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  restoreButton: {
    padding: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 14,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  listContainer: {
    padding: 20,
    paddingTop: 0,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2332',
  },
  userEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  masterBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  masterBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
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
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
});
