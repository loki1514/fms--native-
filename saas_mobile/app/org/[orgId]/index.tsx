'use client';

/**
 * OrgPropertyDashboard — Org-scoped property list (first admin screen)
 *
 * Route: /org/[orgId]
 * Role: org_super_admin / org_admin / owner
 *
 * Design:
 * - Pure black background
 * - "Autopilot FMS" bold header
 * - Search bar: dark rounded rect with search + mic icons
 * - Large full-bleed image cards with overlaid text and status badges
 * - Footer text: "Learn more about system data and map data"
 * - Bottom navigation with Original Orb (from SuperAdminDashboard)
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Animated,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Polygon, Defs, Mask, Rect } from 'react-native-svg';
import { createClient } from '@/utils/supabase/client';
import PropertyCardApple from '@/components/dashboard/PropertyCardApple';
import ParticleOrb from '@/components/dashboard/ParticleOrb';
import CassandraSessionModal from '@/components/cassandra/CassandraSessionModal';

// ---- System fonts ----
const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const display = Platform.OS === 'ios' ? 'System' : 'sans-serif';

// ---- Types ----
interface OrgProperty {
  id: string;
  name: string;
  code: string;
  address?: string;
  image_url?: string | null;
  healthStatus?: 'good' | 'warning' | 'critical';
}

// ---- Icons ----
function IconSearch({ size = 18, color = 'rgba(255,255,255,0.5)' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="8" />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  );
}

function IconMic({ size = 18, color = 'rgba(255,255,255,0.5)' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <Path d="M12 19v4M8 23h8" />
    </Svg>
  );
}

function IconCloud({ size = 48, color = 'rgba(255,255,255,0.25)' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <Path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </Svg>
  );
}

const HomeIcon = ({ size = 22, color = '#888' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Path d="M9 22V12h6v10" />
  </Svg>
);

const BuildingIcon = ({ size = 22, color = '#888' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <Path d="M3 21h18" />
    <Path d="M5 21V7l8-4 8 4v14" />
    <Path d="M9 21v-6h6v6" />
  </Svg>
);

const ChartIcon = ({ size = 22, color = '#888' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <Path d="M18 20V10M12 20V4M6 20v-6" />
  </Svg>
);

const UserIcon = ({ size = 22, color = '#888' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <Circle cx="12" cy="7" r="4" />
  </Svg>
);

// ==================== BOTTOM NAV ====================
const BottomNav = () => {
  const insets = useSafeAreaInsets();
  const [sessionOpen, setSessionOpen] = React.useState(false);
  return (
    <>
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
          <HomeIcon color="#FF6B9D" />
          <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
          <BuildingIcon />
          <Text style={styles.navLabel}>Properties</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.orbNavItem} activeOpacity={0.9} onPress={() => setSessionOpen(true)}>
          <ParticleOrb size={72} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
          <ChartIcon />
          <Text style={styles.navLabel}>Analytics</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
          <UserIcon />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
      <CassandraSessionModal visible={sessionOpen} onClose={() => setSessionOpen(false)} />
    </>
  );
};

// ---- Main Component ----
export default function OrgPropertyDashboard() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const insets = useSafeAreaInsets();

  const [properties, setProperties] = useState<OrgProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch properties for this org
  const fetchProperties = useCallback(async () => {
    if (!orgId) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('properties')
      .select('id, name, code, address, image_url')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[OrgPropertyDashboard] fetch error:', error.message);
    }

    if (!error && data) {
      const mapped: OrgProperty[] = data.map((p: any) => ({
        ...p,
        healthStatus:
          p.health_status ??
          (Math.random() > 0.85 ? 'warning' : Math.random() > 0.95 ? 'critical' : 'good'),
      }));
      setProperties(mapped);
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }, [orgId]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchProperties();
  };

  const filteredProperties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.address ?? '').toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q)
    );
  }, [properties, searchQuery]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="rgba(255,255,255,0.7)" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="rgba(255,255,255,0.6)"
            progressBackgroundColor="rgba(255,255,255,0.08)"
          />
        }
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.title}>Autopilot FMS</Text>

          {/* Search bar */}
          <View style={styles.searchBar}>
            <IconSearch />
            <TextInput
              style={styles.searchInput}
              placeholder="Search mission sites..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <IconMic />
          </View>
        </View>

        {/* Property list */}
        <View style={styles.list}>
          {filteredProperties.map((property) => (
            <PropertyCardApple key={property.id} property={property} orgId={orgId ?? ''} />
          ))}

          {filteredProperties.length === 0 && (
            <View style={styles.emptyState}>
              <IconCloud size={48} color="rgba(255,255,255,0.25)" />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No matching sites' : 'No properties yet'}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery
                  ? 'Try a different search term'
                  : 'Properties will appear here once added'}
              </Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>
          Learn more about <Text style={styles.footerLink}>system data</Text> and{' '}
          <Text style={styles.footerLink}>map data</Text>
        </Text>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav />
    </View>
  );
}

// ---- Styles ----
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontFamily: display,
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    marginBottom: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: display,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  list: {
    paddingTop: 8,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    fontFamily: display,
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
  },
  emptySubtext: {
    fontFamily: display,
    fontSize: 13,
    color: 'rgba(255,255,255,0.30)',
  },
  footerText: {
    fontFamily: display,
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginTop: 24,
  },
  footerLink: {
    color: 'rgba(255,255,255,0.65)',
    textDecorationLine: 'underline',
  },

  // Bottom Nav
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(10,10,15,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 10,
    paddingHorizontal: 8,
    zIndex: 50,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  navLabel: {
    fontFamily: display,
    fontSize: 10,
    color: '#888',
  },
  navLabelActive: {
    color: '#FF6B9D',
    fontWeight: '600',
  },
  orbNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
  },

  // Orb
  orbWrapper: {
    shadowColor: '#ffbf48',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 20,
  },
});
