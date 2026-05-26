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
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useWeather } from '@/hooks/useWeather';
import WeatherBackground from '@/components/dashboard/WeatherBackground';
import WeatherBadge from '@/components/dashboard/WeatherBadge';
import SafeBlurView from '@/components/ui/SafeBlurView';
import SignOutModal from '@/components/ui/SignOutModal';
import CassandraSessionModal from '@/components/cassandra/CassandraSessionModal';
import SidekickFace from '@/components/dashboard/SidekickFace';
import MobileFooter from '@/components/shared/MobileFooter';
import useOrgData from '@/hooks/useOrgData';
import { useCassandraStore } from '@/stores/cassandraStore';
import {
  SPACING,
  TYPOGRAPHY,
  STATUS_COLORS,
} from '@/constants/designSystem';
import {
  GlassTile,
  StatColumns,
  ComplianceGauge,
} from './DashboardComponents';

const { width } = Dimensions.get('window');
const fontSans = Platform.select({ web: 'system-ui, -apple-system, sans-serif', ios: 'System', android: 'sans-serif', default: 'System' });
const fontDisplay = Platform.select({ web: '"SF Pro Display", system-ui, -apple-system, sans-serif', ios: 'System', android: 'sans-serif', default: 'System' });

interface Props {
  propertyId: string;
}

type OrgSubTab = 'overview' | 'properties' | 'users' | 'visitors' | 'vendors' | 'super-tenants' | 'analytics';

export default function LovableOrgSuperAdminDashboard({ propertyId }: Props) {
  const { user, signOut, membership } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { weather } = useWeather();

  const orgId = membership?.org_id || '';
  const { data: orgData, isLoading: isOrgLoading, refetch: refetchOrgData } = useOrgData(orgId);

  const [activeTab, setActiveTab] = useState<OrgSubTab>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [manualCondition, setManualCondition] = useState<import('@/hooks/useWeather').WeatherCondition | null>(null);

  // AI voice/face state
  const voiceState = useCassandraStore((s) => s.voiceState);
  const faceState: any = (() => {
    if (voiceState === 'recording' || voiceState === 'processing' || voiceState === 'connecting') return 'listening';
    if (voiceState === 'speaking') return 'speaking';
    if (voiceState === 'error') return 'alert';
    return 'idle';
  })();

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetchOrgData();
    setIsRefreshing(false);
  }, [refetchOrgData]);

  // Derived ticket counts
  const ticketStats = useMemo(() => {
    const tickets = orgData.tickets || [];
    const open = tickets.filter(t => t.status === 'open' || t.status === 'opened').length;
    const progress = tickets.filter(t => t.status === 'in_progress' || t.status === 'progress').length;
    const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    return { open, progress, resolved };
  }, [orgData.tickets]);

  if (isOrgLoading && !isRefreshing) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 12, }}>Synchronizing Organization Vault...</Text>
      </View>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            {/* Core Operations Header */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderLabel}>ORGANIZATION VAULT</Text>
              <Text style={styles.sectionHeaderValue}>{orgData.properties.length} Properties Connected</Text>
            </View>

            <View style={styles.dashboardGrid}>
              {/* Tickets Tile */}
              <GlassTile label="Total Tickets" icon="ticket-outline" delay={100} onPress={() => setActiveTab('analytics')}>
                <StatColumns
                  data={[
                    { label: 'Open', value: ticketStats.open, color: '#EF4444' },
                    { label: 'Progress', value: ticketStats.progress, color: '#F5A000' },
                    { label: 'Resolved', value: ticketStats.resolved, color: '#1FC26E' },
                  ]}
                />
              </GlassTile>

              {/* Checklist Compliance */}
              <GlassTile label="Checklist Compliance" icon="checkbox-outline" delay={200}>
                <ComplianceGauge value={orgData.sopTotal > 0 ? Math.round((orgData.sopCount / orgData.sopTotal) * 100) : 100} total={100} />
              </GlassTile>

              {/* Entity Flow/Properties Tile */}
              <GlassTile label="Entity Manager" icon="business-outline" delay={300} onPress={() => setActiveTab('properties')}>
                <View style={styles.tileTopRow}>
                  <View>
                    <Text style={styles.tileMetricBig}>{orgData.properties.length.toString().padStart(2, '0')}</Text>
                    <Text style={styles.tileSubtext}>Active Entities Managed</Text>
                  </View>
                  <View style={styles.propertyPillContainer}>
                    {orgData.properties.slice(0, 3).map((p, idx) => (
                      <View key={p.id} style={[styles.avatarOverlap, { zIndex: 10 - idx, left: -idx * 12 }]}>
                        <Text style={styles.avatarOverlapText}>{p.name[0]}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </GlassTile>

              {/* VMS Statistics */}
              <GlassTile label="Visitor Log Flow" icon="people-outline" delay={400} onPress={() => setActiveTab('visitors')}>
                <View style={styles.tileTopRow}>
                  <View>
                    <Text style={styles.tileMetricMid}>{orgData.vmsStats.total}</Text>
                    <Text style={styles.tileSubtext}>Total Registrations</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#1FC26E', fontSize: 16, fontWeight: '800' }}>{orgData.vmsStats.in} IN</Text>
                    <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '800' }}>{orgData.vmsStats.out} OUT</Text>
                  </View>
                </View>
              </GlassTile>

              {/* Cafeteria Revenue */}
              <GlassTile label="Cafeteria Commision" icon="fast-food-outline" delay={500} onPress={() => setActiveTab('vendors')}>
                <View style={styles.tileTopRow}>
                  <View>
                    <Text style={styles.tileMetricMid}>₹{Math.round(orgData.vendorStats.revenue).toLocaleString()}</Text>
                    <Text style={styles.tileSubtext}>Cafeteria Revenue</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#F59E0B', fontSize: 16, fontWeight: '800' }}>₹{Math.round(orgData.vendorStats.commission).toLocaleString()}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>COMMISSION</Text>
                  </View>
                </View>
              </GlassTile>

              {/* Health Score */}
              <GlassTile label="Overall Health Score" icon="shield-checkmark-outline" delay={600}>
                <View style={styles.healthScoreContainer}>
                  <Text style={styles.healthScoreValue}>{orgData.healthScore}%</Text>
                  <View style={styles.healthScorePill}>
                    <Text style={styles.healthScorePillText}>EXCELLENT</Text>
                  </View>
                </View>
              </GlassTile>
            </View>

            {/* Recent Incidents/Requests */}
            <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
              <Text style={styles.sectionHeaderLabel}>LIVE REQUESTS FEED</Text>
              <TouchableOpacity onPress={() => router.push(`/property/${propertyId}/tickets` as any)}>
                <Text style={styles.sectionHeaderLink}>View All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.incidentList}>
              {orgData.tickets.slice(0, 3).map((ticket, i) => (
                <View key={ticket.id || i} style={styles.incidentCard}>
                  <View style={[styles.incidentBadge, { backgroundColor: ticket.priority === 'high' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 160, 0, 0.15)' }]}>
                    <Text style={[styles.incidentBadgeText, { color: ticket.priority === 'high' ? '#EF4444' : '#F5A000' }]}>
                      {(ticket.priority || 'NORMAL').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.incidentInfo}>
                    <Text style={styles.incidentTitle} numberOfLines={1}>{ticket.title}</Text>
                    <Text style={styles.incidentMeta}>{ticket.category?.toUpperCase() || 'MAINTENANCE'} · {new Date(ticket.created_at).toLocaleDateString()}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
                </View>
              ))}
              {orgData.tickets.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No live requests in progress</Text>
                </View>
              )}
            </View>
          </>
        );

      case 'properties':
        return (
          <View style={styles.tabContentContainer}>
            <Text style={styles.tabTitle}>Entity Manager</Text>
            <Text style={styles.tabSubtitle}>Total managed assets and properties across the organization.</Text>
            {orgData.properties.map((p) => (
              <TouchableOpacity 
                key={p.id} 
                style={styles.entityCard}
                onPress={() => router.push(`/property/${p.id}` as any)}
              >
                <View style={styles.entityIconWrapper}>
                  <Ionicons name="business" size={24} color="#FFF" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.entityName}>{p.name}</Text>
                  <Text style={styles.entityCode}>{p.code || 'NO-CODE'} · Active</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'users':
        return (
          <View style={styles.tabContentContainer}>
            <Text style={styles.tabTitle}>User Directory</Text>
            <Text style={styles.tabSubtitle}>Manage tenant credentials, administrative rights, and staff.</Text>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="person-add-outline" size={18} color="#000" />
              <Text style={styles.actionBtnText}>INVITE NEW MEMBER</Text>
            </TouchableOpacity>
            <View style={styles.directoryList}>
              <View style={styles.directoryItem}>
                <View style={styles.dirAvatar}><Text style={styles.dirAvatarText}>A</Text></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.dirName}>{user?.user_metadata?.full_name || 'Admin User'}</Text>
                  <Text style={styles.dirMeta}>{user?.email} · Organization Super Admin</Text>
                </View>
              </View>
            </View>
          </View>
        );

      case 'visitors':
        return (
          <View style={styles.tabContentContainer}>
            <Text style={styles.tabTitle}>Visitor Logs Flow</Text>
            <Text style={styles.tabSubtitle}>Integrated registry system tracking guest authorizations.</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxNumber}>{orgData.vmsStats.total}</Text>
                <Text style={styles.statBoxLabel}>Total Logs</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statBoxNumber, { color: '#1FC26E' }]}>{orgData.vmsStats.in}</Text>
                <Text style={styles.statBoxLabel}>Checked In</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statBoxNumber, { color: '#EF4444' }]}>{orgData.vmsStats.out}</Text>
                <Text style={styles.statBoxLabel}>Checked Out</Text>
              </View>
            </View>
          </View>
        );

      case 'vendors':
        return (
          <View style={styles.tabContentContainer}>
            <Text style={styles.tabTitle}>Cafeteria Commissions</Text>
            <Text style={styles.tabSubtitle}>Revenue generation reports from cafeteria systems.</Text>
            <View style={styles.revenueCard}>
              <Text style={styles.revLabel}>AGGREGATE REVENUE</Text>
              <Text style={styles.revValue}>₹{Math.round(orgData.vendorStats.revenue).toLocaleString()}</Text>
              <View style={styles.revDivider} />
              <Text style={styles.revLabel}>ESTIMATED COMMISION (10%)</Text>
              <Text style={[styles.revValue, { color: '#F59E0B' }]}>₹{Math.round(orgData.vendorStats.commission).toLocaleString()}</Text>
            </View>
          </View>
        );

      case 'super-tenants':
        return (
          <View style={styles.tabContentContainer}>
            <Text style={styles.tabTitle}>Super Tenants</Text>
            <Text style={styles.tabSubtitle}>Analytics credential assignment for properties.</Text>
            <View style={styles.emptyContainer}>
              <Ionicons name="key-outline" size={40} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>No cross-property analytics accounts delegated.</Text>
            </View>
          </View>
        );

      case 'analytics':
        return (
          <View style={styles.tabContentContainer}>
            <Text style={styles.tabTitle}>SLA Performance</Text>
            <Text style={styles.tabSubtitle}>Response latency metrics and ticket completion stats.</Text>
            <View style={styles.chartPlaceholder}>
              <Ionicons name="analytics" size={32} color="rgba(255,255,255,0.4)" />
              <Text style={{ color: '#FFF', fontWeight: '700', marginTop: 10 }}>SLA Standard: 95% Optimal</Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>Response speed has increased by 12% this cycle.</Text>
            </View>
          </View>
        );
    }
  };

  const currentTemp = String(weather?.temperature ?? '22°');
  const currentCondition = weather?.condition ?? 'clear-night';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />
      {weather && <WeatherBackground condition={manualCondition || currentCondition} />}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
      >
        {/* ─── Header ─────────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.duration(500)} style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity style={styles.hamburgerBtn} onPress={() => setShowDrawer(true)} activeOpacity={0.7}>
            <Ionicons name="menu" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <TouchableOpacity 
              style={styles.profileRow} 
              activeOpacity={0.7}
              onPress={() => router.push(`/property/${propertyId}/profile` as any)}
            >
              <View style={styles.avatar}>
                {user?.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.avatarImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.avatarText}>
                    {user?.user_metadata?.full_name ? user.user_metadata.full_name.split(' ').map((n: any) => n[0]).join('').toUpperCase().slice(0, 2) : 'SU'}
                  </Text>
                )}
              </View>
              <View style={[styles.nameContainer, { flex: 1 }]}>
                <Text style={styles.greetingText} numberOfLines={1}>Hey, {user?.user_metadata?.full_name?.split(' ')[0] || 'Super'}</Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>{orgData.orgName}</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.headerRight}>
            {weather && (
              <WeatherBadge
                condition={manualCondition || currentCondition}
                temperature={currentTemp}
                locationName={weather.locationName}
                onChange={setManualCondition}
              />
            )}
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push(`/property/${propertyId}/tickets` as any)}>
              <Ionicons name="add-circle-outline" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconBtn}>
              <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
              <View style={styles.notificationBadge} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ─── Hero Overview Card ─────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(100).duration(600)} style={styles.heroHeroContainer}>
          <View style={styles.heroLeft}>
            <Text style={styles.welcomeText}>SUPER ADMINISTRATION</Text>
            <Text style={styles.propertyName}>{orgData.orgName}</Text>
            <Text style={styles.propertyCode}>Active Portfolio Dashboard</Text>
          </View>
          <View style={styles.heroRight}>
            <View style={styles.tempContainer}>
              <Text style={styles.tempText}>{currentTemp}°</Text>
            </View>
            <View style={styles.weatherStatusRow}>
              <Text style={styles.weatherStatusText}>{currentCondition.replace('-', ' ').toUpperCase()}</Text>
            </View>
          </View>
        </Animated.View>

        {/* ─── Tabs Navigator Grid ─── */}
        <View style={styles.tabsScroller}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContent} showsVerticalScrollIndicator={false}>
            {(['overview', 'properties', 'users', 'visitors', 'vendors', 'super-tenants', 'analytics'] as OrgSubTab[]).map((tab) => (
              <TouchableOpacity 
                key={tab} 
                style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabButtonLabel, activeTab === tab && styles.tabButtonLabelActive]}>
                  {tab.replace('-', ' ').toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={{ marginTop: SPACING.md }}>
          {renderTabContent()}
        </View>
      </ScrollView>

      {/* ─── Bottom Navigation ─────────────────────────────────────────────── */}
      <MobileFooter activeTab="dashboard" />

      <SignOutModal visible={showSignOut} onClose={() => setShowSignOut(false)} onSignOut={signOut} />
      <CassandraSessionModal visible={showChat} onClose={() => setShowChat(false)} orgId={orgId} initialMode="chat" />
      
      {/* ─── Side Menu Drawer ─────────────────────────────────────────────── */}
      <Modal visible={showDrawer} transparent animationType="fade" onRequestClose={() => setShowDrawer(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={[styles.drawerPanel, { paddingTop: insets.top + 16 }]}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerLogoContainer}>
                <Ionicons name="key" size={32} color="#FFF" style={{ marginRight: 8 }} />
                <View>
                  <Text style={styles.drawerLogoText}>UTOPILOT</Text>
                  <Text style={styles.drawerSubtitle}>ORGANIZATION CONTROL</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowDrawer(false)} style={styles.drawerCloseBtn}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.drawerSectionLabel}>CORE OPERATIONS</Text>
              {[
                { label: 'Overview Dashboard', route: 'overview', icon: 'grid-outline' },
                { label: 'Request Feed', route: 'analytics', icon: 'ticket-outline' },
                { label: 'Quick Actions', route: 'overview', icon: 'flash-outline' },
              ].map((item, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={[styles.drawerItem, activeTab === item.route && styles.drawerItemActive]} 
                  onPress={() => { setShowDrawer(false); setActiveTab(item.route as any); }}
                >
                  <Ionicons name={item.icon as any} size={20} color={activeTab === item.route ? '#FFF' : 'rgba(255,255,255,0.6)'} />
                  <Text style={[styles.drawerItemLabel, activeTab === item.route && styles.drawerItemLabelActive]}>{item.label}</Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.drawerSectionLabel, { marginTop: 20 }]}>MANAGEMENT HUB</Text>
              {[
                { label: 'Entity Manager', route: 'properties', icon: 'business-outline' },
                { label: 'User Management', route: 'users', icon: 'people-outline' },
                { label: 'Super Tenants', route: 'super-tenants', icon: 'key-outline' },
                { label: 'Visitors (VMS)', route: 'visitors', icon: 'walk-outline' },
                { label: 'Cafeteria Revenue', route: 'vendors', icon: 'fast-food-outline' },
                { label: 'SLA Analytics', route: 'analytics', icon: 'analytics-outline' },
              ].map((item, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={[styles.drawerItem, activeTab === item.route && styles.drawerItemActive]} 
                  onPress={() => { setShowDrawer(false); setActiveTab(item.route as any); }}
                >
                  <Ionicons name={item.icon as any} size={20} color={activeTab === item.route ? '#FFF' : 'rgba(255,255,255,0.6)'} />
                  <Text style={[styles.drawerItemLabel, activeTab === item.route && styles.drawerItemLabelActive]}>{item.label}</Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.drawerSectionLabel, { marginTop: 20 }]}>SYSTEM</Text>
              <TouchableOpacity 
                style={styles.drawerItem} 
                onPress={() => { setShowDrawer(false); setShowSignOut(true); }}
              >
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                <Text style={[styles.drawerItemLabel, { color: '#EF4444' }]}>Sign Out</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
          <TouchableOpacity style={styles.drawerBackdrop} onPress={() => setShowDrawer(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20, 
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  hamburgerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  nameContainer: {
    marginLeft: 8,
  },
  greetingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '500',
      },
  headerSubtitle: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
      },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  notificationBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  heroHeroContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 15,
    marginBottom: 10,
  },
  heroLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  welcomeText: {
        fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
  },
  propertyName: {
        fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
    letterSpacing: -1,
  },
  propertyCode: {
        fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  heroRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  tempContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tempText: {
        fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  weatherStatusRow: {
    marginTop: 2,
  },
  weatherStatusText: {
        fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  tabsScroller: {
    marginVertical: 10,
  },
  tabsScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabButtonActive: {
    backgroundColor: '#FFF',
    borderColor: '#FFF',
  },
  tabButtonLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '800',
        letterSpacing: 0.5,
  },
  tabButtonLabelActive: {
    color: '#000',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionHeaderLabel: {
        fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
  },
  sectionHeaderValue: {
        fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  sectionHeaderLink: {
        fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
  },
  dashboardGrid: {
    paddingHorizontal: 20,
    gap: 12,
  },
  tileTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tileMetricBig: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '800',
      },
  tileMetricMid: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
      },
  tileSubtext: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 2,
      },
  propertyPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarOverlap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6B7280',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#111',
  },
  avatarOverlapText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  healthScoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthScoreValue: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '800',
      },
  healthScorePill: {
    backgroundColor: 'rgba(31, 194, 110, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(31, 194, 110, 0.25)',
  },
  healthScorePillText: {
    color: '#1FC26E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  incidentList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  incidentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  incidentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  incidentBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  incidentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  incidentTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
      },
  incidentMeta: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 2,
  },
  tabContentContainer: {
    paddingHorizontal: 20,
  },
  tabTitle: {
        fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  tabSubtitle: {
        fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 16,
  },
  entityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  entityIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  entityName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  entityCode: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 16,
    gap: 8,
  },
  actionBtnText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  directoryList: {
    gap: 8,
  },
  directoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dirAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dirAvatarText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  dirName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dirMeta: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statBoxNumber: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
      },
  statBoxLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  revenueCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  revLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  revValue: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 16,
      },
  revDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  chartPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
      },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawerPanel: { width: 280, height: '100%', backgroundColor: '#111', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20 },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  drawerLogoContainer: { flexDirection: 'row', alignItems: 'center' },
  drawerLogoText: {  fontSize: 20, fontWeight: '800', color: '#FFF' },
  drawerSubtitle: {  fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  drawerCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  drawerSectionLabel: {  fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, marginBottom: 8, marginTop: 12 },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4 },
  drawerItemActive: { backgroundColor: 'rgba(255,255,255,0.08)' },
  drawerItemLabel: {  fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  drawerItemLabelActive: { color: '#FFF' },
});
