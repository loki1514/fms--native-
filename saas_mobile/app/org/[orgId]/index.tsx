'use client';

/**
 * OrgPropertyDashboard — Lovable Glassmorphism Design
 *
 * Route: /org/[orgId]
 * Design: Deep gradient bg with glass-effect property cards,
 *         glowing status dots, matching Property Admin dashboard style.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  Platform,
  TextInput,
  Pressable,
  Dimensions,
  ImageBackground,
  Modal,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInUp,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { createClient } from '@/utils/supabase/client';
import { useTheme } from '@/context';
import { useAuth } from '@/hooks/useAuth';
import { STATUS_COLORS, SPACING, type StatusType } from '@/constants/designSystem';
import MobileFooter from '@/components/shared/MobileFooter';
import SignOutModal from '@/components/ui/SignOutModal';
import CassandraSessionModal from '@/components/cassandra/CassandraSessionModal';

const { width: SCREEN_W } = Dimensions.get('window');
const fontSans = Platform.OS === 'ios' ? 'System' : 'sans-serif';
const fontDisplay = Platform.select({
  web: '"SF Pro Display", system-ui, -apple-system, sans-serif',
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

// ---- Sky gradients for property cards ----
const SKY_GRADIENTS = [
  ['#4A6FA5', '#6B8FC4', '#8BAFD4'],
  ['#2D4A6F', '#4A6FA5', '#7A9FC4'],
  ['#5A7A9A', '#8AAABA', '#B0C8D8'],
  ['#3A5A7A', '#5A8AAA', '#8ABACA'],
  ['#4A5A6A', '#6A8A9A', '#9ABABA'],
];

function getSkyGradient(name: string): string[] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SKY_GRADIENTS[Math.abs(hash) % SKY_GRADIENTS.length];
}

// ---- Types ----
interface OrgProperty {
  id: string;
  name: string;
  code: string;
  address?: string;
  image_url?: string | null;
  healthStatus?: 'good' | 'warning' | 'critical';
  openTickets?: number;
  resolvedTickets?: number;
  totalTickets?: number;
}

/** Map health status string to design system StatusType */
function getStatusType(healthStatus: string): StatusType {
  if (healthStatus === 'critical') return 'critical';
  if (healthStatus === 'warning') return 'watch';
  return 'optimal';
}

// ---- Glowing Status Dot ----
function StatusDot({ status }: { status: StatusType }) {
  const palette = STATUS_COLORS[status];
  return (
    <View
      style={[
        styles.statusDot,
        {
          backgroundColor: palette.bg,
          shadowColor: palette.bg,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 6,
          elevation: 4,
        },
      ]}
    />
  );
}

// ---- Animated Property Card ----
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function GlassPropertyCard({ property, index }: { property: OrgProperty; index: number }) {
  const router = useRouter();
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const gradient = getSkyGradient(property.name);
  const scale = useSharedValue(1);

  const open = property.openTickets ?? 0;
  const resolved = property.resolvedTickets ?? 0;

  const statusType = getStatusType(property.healthStatus ?? 'good');
  const statusText = statusType === 'critical' ? 'Critical' : statusType === 'watch' ? 'Watch' : 'Optimal';

  const hasImage = !!property.image_url;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.975, { damping: 15, stiffness: 200 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  return (
    <Animated.View entering={FadeInUp.delay(index * 60).duration(400)}>
      <AnimatedPressable
        style={[styles.cardContainer, animatedStyle]}
        onPress={() => router.push(`/org/${orgId}/property/${property.id}`)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        {hasImage ? (
          <ImageBackground
            source={{ uri: property.image_url! }}
            style={styles.cardImageBg}
            resizeMode="cover"
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.00)', 'rgba(0,0,0,0.40)', 'rgba(0,0,0,0.70)']}
              locations={[0, 0.5, 1]}
              style={styles.cardOverlay}
            >
              <CardContent
                property={property}
                open={open}
                resolved={resolved}
                statusText={statusText}
                statusType={statusType}
              />
            </LinearGradient>
          </ImageBackground>
        ) : (
          <LinearGradient
            colors={gradient as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <CardContent
              property={property}
              open={open}
              resolved={resolved}
              statusText={statusText}
              statusType={statusType}
            />
          </LinearGradient>
        )}
      </AnimatedPressable>
    </Animated.View>
  );
}

function CardContent({ property, open, resolved, statusText, statusType }: {
  property: OrgProperty;
  open: number;
  resolved: number;
  statusText: string;
  statusType: StatusType;
}) {
  const palette = STATUS_COLORS[statusType];
  return (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardLeft}>
          <Text style={styles.cardName} numberOfLines={1}>{property.name}</Text>
          <Text style={styles.cardSubtitle}>{property.code}</Text>
        </View>
        <Text style={styles.cardMetric}>{open}</Text>
      </View>
      <View style={styles.cardBottomRow}>
        <View style={styles.statusRow}>
          <StatusDot status={statusType} />
          <Text style={[styles.cardStatus, { color: palette.text }]}>{statusText}</Text>
        </View>
        <Text style={styles.cardRange}>H:{resolved}  L:{open}</Text>
      </View>
    </View>
  );
}

// ---- Main Component ----
export default function OrgPropertyDashboard() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { user, signOut, membership } = useAuth();
  const router = useRouter();

  const [properties, setProperties] = useState<OrgProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDrawer, setShowDrawer] = useState(false);

  const [showSignOut, setShowSignOut] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const orgName = membership?.org_name || 'Organization';

  const fetchProperties = useCallback(async () => {
    if (!orgId) { setIsLoading(false); setIsRefreshing(false); return; }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('properties')
      .select('id, name, code, address, image_url')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true });

    if (error) console.error('[OrgPropertyDashboard] fetch error:', error.message);

    if (!error && data) {
      const propertyIds = data.map((p: any) => p.id);
      const { data: ticketData } = await supabase
        .from('tickets')
        .select('property_id, status')
        .in('property_id', propertyIds);

      const ticketMap = new Map<string, { open: number; resolved: number; total: number }>();
      propertyIds.forEach((id: string) => ticketMap.set(id, { open: 0, resolved: 0, total: 0 }));

      ticketData?.forEach((t: any) => {
        const counts = ticketMap.get(t.property_id) || { open: 0, resolved: 0, total: 0 };
        counts.total++;
        if (['open', 'blocked', 'client_raised'].includes(t.status)) counts.open++;
        else if (['resolved', 'closed', 'satisfied'].includes(t.status)) counts.resolved++;
        ticketMap.set(t.property_id, counts);
      });

      const mapped: OrgProperty[] = data.map((p: any) => {
        const counts = ticketMap.get(p.id) || { open: 0, resolved: 0, total: 0 };
        return {
          ...p,
          openTickets: counts.open,
          resolvedTickets: counts.resolved,
          totalTickets: counts.total,
          healthStatus: counts.open > 15 ? 'critical' : counts.open > 5 ? 'warning' : 'good',
        };
      });
      setProperties(mapped);
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }, [orgId]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const onRefresh = () => { setIsRefreshing(true); fetchProperties(); };

  const filteredProperties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.address ?? '').toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q)
    );
  }, [properties, searchQuery]);

  const totalOpen = properties.reduce((sum, p) => sum + (p.openTickets || 0), 0);
  const totalResolved = properties.reduce((sum, p) => sum + (p.resolvedTickets || 0), 0);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient colors={['#1a1a1a', '#121212', '#0a0a0a']} style={StyleSheet.absoluteFillObject} />
        <ActivityIndicator size="large" color="#708F96" />
        <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 16, fontFamily: fontSans }}>Loading organization...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a1a1a', '#121212', '#0a0a0a']} style={StyleSheet.absoluteFillObject} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="rgba(255,255,255,0.6)" />
        }
      >
        {/* ─── Header ─────────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.duration(500)} style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity style={styles.hamburgerBtn} onPress={() => setShowDrawer(true)} activeOpacity={0.7}>
            <Ionicons name="menu" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <TouchableOpacity style={styles.profileRow} activeOpacity={0.7}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.user_metadata?.full_name ? user.user_metadata.full_name.split(' ').map((n: any) => n[0]).join('').toUpperCase().slice(0, 2) : 'SU'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.greetingText} numberOfLines={1}>Hey, {user?.user_metadata?.full_name?.split(' ')[0] || 'Super'}</Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>{orgName}</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.headerRight}>

            <TouchableOpacity style={styles.headerIconBtn}>
              <Ionicons name="add-circle-outline" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconBtn}>
              <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
              <View style={styles.notificationBadge} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ─── Hero Overview ──────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(100).duration(600)} style={styles.overviewHeader}>
          <Text style={styles.overviewTitle}>ORGANIZATION{'\n'}OVERVIEW</Text>
        </Animated.View>

        {/* ─── Stats Row ──────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(150).duration(500)} style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statPillValue}>{properties.length}</Text>
            <Text style={styles.statPillLabel}>Properties</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={[styles.statPillValue, { color: '#FCA5A5' }]}>{totalOpen}</Text>
            <Text style={styles.statPillLabel}>Open Tickets</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={[styles.statPillValue, { color: '#6EE7B7' }]}>{totalResolved}</Text>
            <Text style={styles.statPillLabel}>Resolved</Text>
          </View>
        </Animated.View>

        {/* ─── Search bar ─────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search properties..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* ─── Property Cards ─────────────────────────────────────────────────── */}
        <View style={styles.list}>
          {filteredProperties.map((property, i) => (
            <GlassPropertyCard key={property.id} property={property} index={i} />
          ))}

          {filteredProperties.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="business-outline" size={48} color="rgba(255,255,255,0.15)" />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No matching properties' : 'No properties yet'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── Bottom Navigation ──────────────────────────────────────────────── */}
      <MobileFooter activeTab="dashboard" />

      <SignOutModal visible={showSignOut} onClose={() => setShowSignOut(false)} onSignOut={signOut} />
      <CassandraSessionModal visible={showChat} onClose={() => setShowChat(false)} orgId={orgId} />

      {/* ─── Side Drawer ────────────────────────────────────────────────────── */}
      <Modal visible={showDrawer} transparent animationType="fade" onRequestClose={() => setShowDrawer(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={[styles.drawerPanel, { paddingTop: insets.top + 16 }]}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerLogoContainer}>
                <Image
                  source={require('@/assets/images/autopilot-logo-new.png')}
                  style={[styles.drawerLogo, { tintColor: '#FFFFFF' }]}
                  resizeMode="contain"
                />
                <Text style={styles.drawerSubtitle}>ORGANIZATION ADMIN</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDrawer(false)} style={styles.drawerCloseBtn}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.drawerSectionLabel}>OPERATIONS</Text>
              {[
                { label: 'Dashboard', icon: 'grid-outline' },
                { label: 'Properties', icon: 'business-outline' },
                { label: 'Users', icon: 'people-outline' },
                { label: 'Visitors', icon: 'walk-outline' },
              ].map((item) => (
                <TouchableOpacity key={item.label} style={styles.drawerItem} onPress={() => setShowDrawer(false)}>
                  <Ionicons name={item.icon as any} size={20} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.drawerItemLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.drawerSectionLabel, { marginTop: 20 }]}>SYSTEM</Text>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setShowDrawer(false); setShowSignOut(true); }}>
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                <Text style={[styles.drawerItemLabel, { color: '#EF4444' }]}>Logout</Text>
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
  scrollView: { flex: 1 },

  // Header (matches Property Admin)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  hamburgerBtn: { padding: 4 },
  headerCenter: { flex: 1, paddingHorizontal: 12 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  avatarText: { color: '#FFF', fontSize: 13, fontWeight: '700', fontFamily: fontSans },
  greetingText: { color: '#FFF', fontSize: 14, fontWeight: '700', fontFamily: fontSans },
  headerSubtitle: { color: 'rgba(255,255,255,0.40)', fontSize: 11, fontFamily: fontSans, marginTop: 1 },
  headerRight: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  headerIconBtn: { position: 'relative' },
  notificationBadge: { position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },

  // Hero
  overviewHeader: { paddingHorizontal: 20, marginTop: 8, marginBottom: 16 },
  overviewTitle: { fontFamily: fontDisplay, fontSize: 26, fontWeight: '800', color: '#FFFFFF', lineHeight: 28, letterSpacing: -0.5 },

  // Stats
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 18 },
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  statPillValue: { fontFamily: fontDisplay, fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  statPillLabel: { fontFamily: fontSans, fontSize: 10, color: 'rgba(255,255,255,0.40)', marginTop: 4, fontWeight: '600' },

  // Search
  searchWrap: { paddingHorizontal: 20, marginBottom: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  searchInput: {
    flex: 1,
    fontFamily: fontSans,
    fontSize: 14,
    color: '#FFFFFF',
    paddingVertical: 0,
  },

  // Card list
  list: { paddingHorizontal: 20, gap: 12 },

  // Card
  cardContainer: {
    borderRadius: 22,
    overflow: 'hidden',
    height: 132,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 5,
  },
  cardGradient: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  cardImageBg: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
  },
  cardOverlay: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLeft: {
    flex: 1,
    paddingRight: 12,
  },
  cardName: {
    fontFamily: fontSans,
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 26,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cardSubtitle: {
    fontFamily: fontSans,
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.80)',
    marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardMetric: {
    fontFamily: fontDisplay,
    fontSize: 48,
    fontWeight: '200',
    color: '#FFFFFF',
    letterSpacing: -1.5,
    lineHeight: 52,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardStatus: {
    fontFamily: fontSans,
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardRange: {
    fontFamily: fontSans,
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontFamily: fontSans,
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.40)',
  },

  // Drawer
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawerPanel: { width: 280, height: '100%', backgroundColor: '#111', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20 },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 10 },
  drawerLogoContainer: { flex: 1 },
  drawerLogo: { width: 140, height: 35, marginLeft: -5 },
  drawerSubtitle: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginTop: 4, marginLeft: 2 },
  drawerCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  drawerSectionLabel: { fontFamily: fontSans, fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, marginBottom: 8, paddingHorizontal: 4 },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 14 },
  drawerItemLabel: { fontFamily: fontSans, fontSize: 15, color: '#FFF', fontWeight: '600' },
});
