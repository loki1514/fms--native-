import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context';
import { Colors } from '@/constants/Colors';
import SidekickFace from '@/components/dashboard/SidekickFace';

const fontSans = Platform.OS === 'ios' ? 'System' : 'sans-serif';

export type TabKey = 'overview' | 'requests' | 'loggers' | 'profile' | 'stock' | 'checklist';

interface AppBottomNavProps {
  activeTab: TabKey;
  propertyId: string;
  onLoggersPress: () => void;
  onCreateRequestPress?: () => void;
  /** Base route prefix for navigation (default: '/mst') */
  baseRoute?: string;
  /** Show Loggers button (MST/Electricity/Diesel) or Stock button (Staff). Default: true (Loggers) */
  showLoggers?: boolean;
  /** Show Checklist button instead of Loggers/Stock. Default: false */
  showChecklist?: boolean;
}

export function AppBottomNav({
  activeTab,
  propertyId,
  onLoggersPress,
  onCreateRequestPress,
  baseRoute = '/mst',
  showLoggers = true,
  showChecklist = false,
}: AppBottomNavProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const isDark = theme === 'dark';

  const navigate = (tab: TabKey) => {
    switch (tab) {
      case 'overview':
        router.push(`/property/${propertyId}${baseRoute}` as any);
        break;
      case 'requests':
        router.push(`/property/${propertyId}${baseRoute}?tab=requests` as any);
        break;
      case 'profile':
        router.push(`/property/${propertyId}/profile` as any);
        break;
      case 'stock':
        router.push(`/property/${propertyId}/stock` as any);
        break;
      case 'checklist':
        router.push(`/property/${propertyId}/checklist` as any);
        break;
    }
  };

  const activeColor = colors.primary;
  const inactiveColor = isDark ? colors.textTertiary : colors.textSecondary;

  const NavItem = ({ tab, icon, label }: { tab: TabKey; icon: keyof typeof Ionicons.glyphMap; label: string }) => {
    const isActive = activeTab === tab;
    return (
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => tab === 'loggers' ? onLoggersPress() : navigate(tab)}
        activeOpacity={0.7}
      >
        <View style={[styles.navIconWrapper, isActive && { backgroundColor: colors.primary + '1A' }]}>
          <Ionicons
            name={isActive ? (icon.replace('-outline', '') as any) : icon}
            size={24}
            color={isActive ? activeColor : inactiveColor}
          />
        </View>
        <Text style={[styles.navText, { color: isActive ? activeColor : inactiveColor }]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  // Determine the 4th nav item: Checklist, Loggers (MST), or Stock (Staff)
  const FourthNav = () => {
    if (showChecklist) {
      const isChecklistActive = activeTab === 'checklist';
      return (
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigate('checklist')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconWrapper, isChecklistActive && { backgroundColor: colors.primary + '1A' }]}>
            <Ionicons
              name={isChecklistActive ? 'clipboard' : 'clipboard-outline'}
              size={24}
              color={isChecklistActive ? activeColor : inactiveColor}
            />
          </View>
          <Text style={[styles.navText, { color: isChecklistActive ? activeColor : inactiveColor }]}>CHECKLIST</Text>
        </TouchableOpacity>
      );
    }
    if (showLoggers) {
      return (
        <TouchableOpacity
          style={styles.navItem}
          onPress={onLoggersPress}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconWrapper]}>
            <Ionicons name="options-outline" size={24} color={inactiveColor} />
          </View>
          <Text style={[styles.navText, { color: inactiveColor }]}>LOGGERS</Text>
        </TouchableOpacity>
      );
    }
    // Stock button for Staff/SoftService roles
    const isStockActive = activeTab === 'stock';
    return (
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigate('stock')}
        activeOpacity={0.7}
      >
        <View style={[styles.navIconWrapper, isStockActive && { backgroundColor: colors.primary + '1A' }]}>
          <Ionicons
            name={isStockActive ? 'cube' : 'cube-outline'}
            size={24}
            color={isStockActive ? activeColor : inactiveColor}
          />
        </View>
        <Text style={[styles.navText, { color: isStockActive ? activeColor : inactiveColor }]}>STOCK</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[
      styles.bottomNav,
      {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        paddingBottom: Math.max(insets.bottom, 16)
      }
    ]}>
      <NavItem tab="overview" icon="grid-outline" label="OVERVIEW" />
      <NavItem tab="requests" icon="ticket-outline" label="REQUESTS" />

      {/* Center Cassandra Orb */}
      <TouchableOpacity
        style={styles.navItemCenter}
        onPress={() => router.push(`/cassandra?propertyId=${propertyId}` as any)}
        activeOpacity={0.8}
      >
        <View style={styles.askPill}>
          <Text style={styles.askPillText}>ASK CASSANDRA</Text>
        </View>
        <View style={styles.orbContainer}>
          <View style={styles.orbGlow}>
            <SidekickFace size={32} state="idle" compact />
          </View>
        </View>
        <Text style={styles.navText}>CASSANDRA</Text>
      </TouchableOpacity>

      <FourthNav />
      <NavItem tab="profile" icon="person-outline" label="PROFILE" />
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: 'rgba(14, 14, 22, 0.92)',
    borderTopColor: 'rgba(255,255,255,0.08)',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    paddingVertical: 6,
    paddingBottom: 4,
  },
  navIconWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  navText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: fontSans,
  },
  navItemCenter: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1.2,
    gap: 2,
    paddingBottom: 4,
    position: 'relative',
  },
  askPill: {
    position: 'absolute',
    top: -14,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  askPillText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 8,
    fontWeight: '800',
    fontFamily: fontSans,
    letterSpacing: 0.5,
  },
  orbContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
  },
  orbGlow: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
});
