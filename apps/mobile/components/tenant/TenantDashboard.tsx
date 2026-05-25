import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ScrollView,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useWeather } from '@/hooks/useWeather';
import { useTenantTickets } from '@/hooks/tenant/useTenantTickets';
import { useSuperTenantProperties } from '@/hooks/tenant/useSuperTenantProperties';
import SignOutModal from '@/components/ui/SignOutModal';
import CassandraSessionModal from '@/components/cassandra/CassandraSessionModal';
import TenantBottomNav from '@/components/tenant/TenantBottomNav';
import WeatherBackground from '@/components/dashboard/WeatherBackground';
import SafeBlurView from '@/components/ui/SafeBlurView';
import { TicketCreateModal } from '../tickets/TicketCreateModal';
import { AutopilotLogo } from '@/components/ui/AutopilotLogo';
import { createClient } from '@/utils/supabase/client';

const FONT_DISPLAY = Platform.select({
  web: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
  ios: 'Poppins',
  android: 'Poppins',
  default: 'Poppins',
});
const FONT_BODY = Platform.select({
  web: 'Urbanist, -apple-system, BlinkMacSystemFont, sans-serif',
  ios: 'Urbanist',
  android: 'Urbanist',
  default: 'Urbanist',
});

interface TenantDashboardProps {
  propertyId: string;
  isSuperTenant?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function TenantDashboard({ propertyId, isSuperTenant }: TenantDashboardProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut, membership } = useAuth();
  const { weather } = useWeather();

  const [showChat, setShowChat] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState(propertyId);
  const [propertyName, setPropertyName] = useState('Property');

  const { tickets, loading: ticketsLoading, refetch: refetchTickets } = useTenantTickets(selectedPropertyId, user?.id);
  const { properties: superTenantProperties } = useSuperTenantProperties(isSuperTenant ? user?.id : undefined);

  useEffect(() => {
    if (!selectedPropertyId) return;
    const supabase = createClient();
    supabase.from('properties').select('name, code').eq('id', selectedPropertyId).single().then(({ data }) => {
      if (data) {
        setPropertyName(data.name || 'Property');
      }
    });
  }, [selectedPropertyId]);

  const ticketStats = useMemo(() => {
    const open = tickets.filter((t: any) => !['resolved', 'closed'].includes(t.status)).length;
    const completed = tickets.filter((t: any) => ['resolved', 'closed'].includes(t.status)).length;
    return { open, completed, total: tickets.length };
  }, [tickets]);

  const onRefresh = useCallback(async () => {
    await refetchTickets();
  }, [refetchTickets]);

  const fullName = user?.user_metadata?.full_name || 'Tenant';
  const firstName = fullName.split(' ')[0];
  const initials = getInitials(fullName);

  const handleTicketCreated = () => {
    setShowTicketModal(false);
    refetchTickets();
  };

  const drawerItems = [
    { label: 'Dashboard', route: 'tenant', icon: 'grid-outline' as const },
    { label: 'My Tickets', route: 'tenant/requests', icon: 'ticket-outline' as const },
    { label: 'Meeting Rooms', route: 'tenant/rooms', icon: 'calendar-outline' as const },
    { label: 'Visitors', route: 'tenant/visitors', icon: 'people-outline' as const },
    { label: 'Communities', route: 'tenant/communities', icon: 'chatbubbles-outline' as const },
    { label: 'Cassandra AI', route: 'cassandra', icon: 'sparkles-outline' as const },
    { label: 'Profile', route: 'profile', icon: 'person-outline' as const },
    { label: 'Settings', route: 'settings', icon: 'settings-outline' as const },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a1a1a', '#121212', '#0a0a0a']} style={StyleSheet.absoluteFillObject} />
      {weather && <WeatherBackground condition={weather.condition} />}

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={ticketsLoading} onRefresh={onRefresh} tintColor="rgba(255,255,255,0.6)" />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
      >
        {/* Header — EXACT match to screenshot */}
        <Animated.View entering={FadeInUp.duration(500)} style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.iconPill} onPress={() => setShowDrawer(true)} activeOpacity={0.8}>
              <Ionicons name="menu" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            <View style={{ flexShrink: 1 }}>
              <Text style={styles.headerGreeting} numberOfLines={1}>
                Hey, {firstName}
              </Text>
              <Text style={styles.headerProperty} numberOfLines={1}>
                {propertyName}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconPill} onPress={() => setShowTicketModal(true)} activeOpacity={0.8}>
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconPill} activeOpacity={0.8}>
              <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
              {ticketStats.open > 0 && <View style={styles.notificationDot} />}
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Super Tenant Property Picker */}
        {isSuperTenant && superTenantProperties && superTenantProperties.length > 1 && (
          <Animated.View entering={FadeInUp.delay(100).duration(500)} style={styles.propertyPicker}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propertyChips}>
              {superTenantProperties.map((prop) => (
                <TouchableOpacity
                  key={prop.id}
                  style={[styles.propertyChip, selectedPropertyId === prop.property_id && styles.propertyChipActive]}
                  onPress={() => setSelectedPropertyId(prop.property_id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.propertyChipText, selectedPropertyId === prop.property_id && styles.propertyChipTextActive]}>
                    {prop.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Module Cards — Glass Style */}
        <View style={styles.cardsContainer}>
          <GlassModuleCard
            icon="chatbubble-ellipses-outline"
            title="Helpdesk & Ticketing"
            description="Report issues, track requests & get support instantly."
            badge={ticketStats.open > 0 ? ticketStats.open : undefined}
            statusLine={`${ticketStats.open} ACTIVE · ${ticketStats.completed} COMPLETED`}
            delay={120}
            onPress={() => router.push(`/property/${propertyId}/tenant/requests` as any)}
          />

          <GlassModuleCard
            icon="people-outline"
            title="Visitor Management"
            description="Secure building access & visitor check-in system."
            statusLine="ACCESS CONTROL"
            delay={200}
            onPress={() => router.push(`/property/${propertyId}/tenant/visitors` as any)}
          />

          <GlassModuleCard
            icon="calendar-outline"
            title="Meeting Rooms"
            description="Reserve meeting spaces & conference rooms with ease."
            statusLine="ROOM BOOKING"
            delay={280}
            onPress={() => router.push(`/property/${propertyId}/tenant/rooms` as any)}
          />
        </View>
      </ScrollView>

      <TenantBottomNav />

      {/* Modals */}
      <SignOutModal visible={showSignOut} onClose={() => setShowSignOut(false)} onSignOut={signOut} />
      <CassandraSessionModal visible={showChat} onClose={() => setShowChat(false)} orgId={membership?.org_id || ''} propertyId={selectedPropertyId} />

      <TicketCreateModal
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        propertyId={selectedPropertyId}
        organizationId={membership?.org_id ?? ''}
        role="tenant"
        onSuccess={handleTicketCreated}
      />

      {/* Drawer */}
      <Modal visible={showDrawer} transparent animationType="fade" onRequestClose={() => setShowDrawer(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <SafeBlurView intensity={80} tint="dark" style={[styles.drawerPanel, { paddingTop: insets.top + 16 }]}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerLogoContainer}>
                <AutopilotLogo size="md" variant="dark" />
                <Text style={styles.drawerSubtitle}>TENANT PORTAL</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDrawer(false)} style={styles.drawerCloseBtn}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <Text style={styles.drawerSectionLabel}>MENU</Text>
              {drawerItems.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.drawerItem}
                  onPress={() => {
                    setShowDrawer(false);
                    if (item.route === 'cassandra') {
                      router.push(`/cassandra?propertyId=${selectedPropertyId}` as any);
                    } else {
                      router.push(`/property/${propertyId}/${item.route}` as any);
                    }
                  }}
                >
                  <Ionicons name={item.icon} size={20} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.drawerItemLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.drawerFooter}>
              <TouchableOpacity
                style={styles.signOutBtn}
                onPress={() => {
                  setShowDrawer(false);
                  setShowSignOut(true);
                }}
              >
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </SafeBlurView>
          <TouchableOpacity style={styles.drawerBackdrop} onPress={() => setShowDrawer(false)} />
        </View>
      </Modal>
    </View>
  );
}

// ------------------------------------------------------------------
// GlassModuleCard — Dark glass card for tenant modules
// ------------------------------------------------------------------
function GlassModuleCard({
  icon,
  title,
  description,
  badge,
  statusLine,
  delay = 0,
  onPress,
}: {
  icon: string;
  title: string;
  description: string;
  badge?: number;
  statusLine: string;
  delay?: number;
  onPress?: () => void;
}) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(500)} style={{ width: '100%' }}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} disabled={!onPress} style={styles.cardTouchable}>
        <SafeBlurView intensity={40} tint="dark" style={styles.card}>
          <LinearGradient
            colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.1)']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.cardContent}>
            <View style={styles.cardTopRow}>
              <View style={styles.iconCircle}>
                <Ionicons name={icon as any} size={28} color="#A5A5B5" />
              </View>
              {typeof badge === 'number' && badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              )}
            </View>

            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardDescription}>{description}</Text>
            <Text style={styles.cardStatus}>{statusLine}</Text>
          </View>
        </SafeBlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scroll: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerGreeting: {
    fontFamily: FONT_DISPLAY,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  headerProperty: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 1,
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  propertyPicker: {
    marginBottom: 16,
  },
  propertyChips: {
    paddingHorizontal: 16,
    gap: 8,
  },
  propertyChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  propertyChipActive: {
    backgroundColor: '#5A8A8F',
    borderColor: '#5A8A8F',
  },
  propertyChipText: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  propertyChipTextActive: {
    color: '#FFFFFF',
  },
  cardsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  cardTouchable: {
    width: '100%',
  },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cardContent: {
    padding: 20,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  cardDescription: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
    marginTop: 4,
  },
  cardStatus: {
    fontFamily: FONT_BODY,
    fontSize: 11,
    fontWeight: '700',
    color: '#B8956A',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 12,
  },
  drawerPanel: {
    width: 280,
    height: '100%',
    paddingHorizontal: 20,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  drawerLogoContainer: {
    flexDirection: 'column',
  },
  drawerSubtitle: {
    fontFamily: FONT_BODY,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
    marginTop: 6,
  },
  drawerCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerSectionLabel: {
    fontFamily: FONT_BODY,
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingVertical: 14,
  },
  drawerItemLabel: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 16,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  signOutText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
});
