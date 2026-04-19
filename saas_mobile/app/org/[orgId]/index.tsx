'use client';

/**
 * OrgPropertyDashboard — Atmospheric Glass Design
 *
 * Route: /org/[orgId]
 * Design: Deep night-sky bg with aurora orbs, glass-effect property cards,
 *         glowing status dots, Apple Weather-inspired layout.
 *         Full dark/light mode support via useTheme context.
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInUp,
} from 'react-native-reanimated';
import { createClient } from '@/utils/supabase/client';
import { useTheme } from '@/context';
import { useWeather } from '@/hooks/useWeather';
import { AuroraBackground } from '@/components/shared/AuroraBackground';

const { width: SCREEN_W } = Dimensions.get('window');
const fontSans = Platform.OS === 'ios' ? 'System' : 'sans-serif';

// ---- Sky gradients for property cards (fallback when no image) ----
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

// ---- Icons ----
const IconSearch = ({ size = 16, color = 'rgba(255,255,255,0.5)' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
    <Circle cx="11" cy="11" r="8" />
    <Path d="M21 21l-4.35-4.35" />
  </Svg>
);

const IconMic = ({ size = 16, color = 'rgba(255,255,255,0.5)' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <Path d="M12 19v4M8 23h8" />
  </Svg>
);

const IconMenu = ({ size = 20, color = 'rgba(255,255,255,0.7)' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <Path d="M4 6h16M4 12h16M4 18h16" />
  </Svg>
);

// ---- Glowing Status Dot ----
function StatusDot({ status }: { status: 'good' | 'warning' | 'critical' }) {
  const colors = { good: '#34C759', warning: '#FF9F0A', critical: '#FF3B30' };
  const color = colors[status] || colors.good;
  return (
    <View
      style={[
        styles.statusDot,
        {
          backgroundColor: color,
          shadowColor: color,
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

function WeatherPropertyCard({ property, index }: { property: OrgProperty; index: number }) {
  const router = useRouter();
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const gradient = getSkyGradient(property.name);
  const scale = useSharedValue(1);

  const open = property.openTickets ?? 0;
  const resolved = property.resolvedTickets ?? 0;

  const statusText = open > 15 ? 'Critical' : open > 5 ? 'Watch' : 'Optimal';
  const healthStatus: 'good' | 'warning' | 'critical' =
    open > 15 ? 'critical' : open > 5 ? 'warning' : 'good';

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
              colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.65)']}
              locations={[0, 0.45, 1]}
              style={styles.cardOverlay}
            >
              <CardContent
                property={property}
                open={open}
                resolved={resolved}
                statusText={statusText}
                healthStatus={healthStatus}
              />
            </LinearGradient>
          </ImageBackground>
        ) : (
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <CardContent
              property={property}
              open={open}
              resolved={resolved}
              statusText={statusText}
              healthStatus={healthStatus}
            />
          </LinearGradient>
        )}
      </AnimatedPressable>
    </Animated.View>
  );
}

function CardContent({ property, open, resolved, statusText, healthStatus }: {
  property: OrgProperty;
  open: number;
  resolved: number;
  statusText: string;
  healthStatus: 'good' | 'warning' | 'critical';
}) {
  return (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      {/* Top: Name + Code on left, large number on right */}
      <View style={styles.cardTopRow}>
        <View style={styles.cardLeft}>
          <Text style={styles.cardName} numberOfLines={1}>{property.name}</Text>
          <Text style={styles.cardSubtitle}>{property.code}</Text>
        </View>
        <Text style={styles.cardMetric}>{open}</Text>
      </View>

      {/* Bottom: Status dot + label on left, H/L on right */}
      <View style={styles.cardBottomRow}>
        <View style={styles.statusRow}>
          <StatusDot status={healthStatus} />
          <Text style={styles.cardStatus}>{statusText}</Text>
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
  const { weather } = useWeather();

  const [properties, setProperties] = useState<OrgProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
      // Also fetch ticket counts for each property
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

  // ---- Theme-aware tokens ----
  const bg = isDark ? '#060912' : '#F8FAFC';
  const textPrimary = isDark ? '#FFFFFF' : '#1D1D1F';
  const searchBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const searchBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const searchIcon = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)';
  const searchText = isDark ? '#FFFFFF' : '#1D1D1F';
  const placeholderColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
  const menuBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';
  const menuIcon = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)';
  const mutedText = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.40)';

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color="#708F96" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Aurora background — ambient animated orbs */}
      {isDark && weather && <AuroraBackground colors={weather.auroraColors} />}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? 'rgba(255,255,255,0.6)' : '#708F96'}
          />
        }
      >
        {/* Tight header — menu + title */}
        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <Pressable style={[styles.menuButton, { backgroundColor: menuBg }]}>
            <IconMenu color={menuIcon} />
          </Pressable>
          <Text style={[styles.title, { color: textPrimary }]}>Properties</Text>
        </View>

        {/* Search bar — glass style */}
        <View style={[styles.searchBar, { backgroundColor: searchBg, borderColor: searchBorder }]}>
          <IconSearch color={searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: searchText }]}
            placeholder="Search for a property"
            placeholderTextColor={placeholderColor}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <IconMic color={searchIcon} />
        </View>

        {/* Property cards */}
        <View style={styles.list}>
          {filteredProperties.map((property, i) => (
            <WeatherPropertyCard key={property.id} property={property} index={i} />
          ))}

          {filteredProperties.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: mutedText }]}>
                {searchQuery ? 'No matching properties' : 'No properties yet'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    zIndex: 10,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: fontSans,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1.4,
    lineHeight: 42,
  },

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontSans,
    fontSize: 16,
    paddingVertical: 0,
  },

  // Card list
  list: {
    paddingHorizontal: 16,
    gap: 12,
  },

  // Card
  cardContainer: {
    borderRadius: 22,
    overflow: 'hidden',
    height: 132,
    // Subtle card shadow
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
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 28,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cardSubtitle: {
    fontFamily: fontSans,
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.70)',
    marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardMetric: {
    fontFamily: fontSans,
    fontSize: 54,
    fontWeight: '200',
    color: '#FFFFFF',
    letterSpacing: -1.5,
    lineHeight: 58,
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
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardRange: {
    fontFamily: fontSans,
    fontSize: 14,
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
    paddingVertical: 80,
  },
  emptyText: {
    fontFamily: fontSans,
    fontSize: 16,
    fontWeight: '600',
  },
});
