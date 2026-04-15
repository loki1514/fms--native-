import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context';
import { Colors } from '@/constants/Colors';

export type TabKey = 'overview' | 'requests' | 'loggers' | 'profile';

interface AppBottomNavProps {
  activeTab: TabKey;
  propertyId: string;
  onLoggersPress: () => void;
  onCreateRequestPress?: () => void;
}

export function AppBottomNav({ 
  activeTab, 
  propertyId, 
  onLoggersPress,
  onCreateRequestPress 
}: AppBottomNavProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const isDark = theme === 'dark';

  const navigate = (tab: TabKey) => {
    switch (tab) {
      case 'overview':
        router.push(`/property/${propertyId}/mst` as any);
        break;
      case 'requests':
        // If we are already on MstDashboard, we might want to just set a filter, 
        // but for consistency across screens, we'll navigate to MST with a param or just to MST
        router.push(`/property/${propertyId}/mst?tab=requests` as any);
        break;
      case 'profile':
        router.push(`/property/${propertyId}/profile` as any);
        break;
    }
  };

  const NavItem = ({ tab, icon, label }: { tab: TabKey; icon: keyof typeof Ionicons.glyphMap; label: string }) => {
    const isActive = activeTab === tab;
    // Premium Blue for active, Slate for inactive
    const activeColor = '#3B82F6'; 
    const inactiveColor = isDark ? '#94A3B8' : '#64748B';

    return (
      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => tab === 'loggers' ? onLoggersPress() : navigate(tab)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.navIconWrapper, 
          isActive && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF' }
        ]}>
          <Ionicons 
            name={isActive ? (icon.replace('-outline', '') as any) : icon} 
            size={24} 
            color={isActive ? activeColor : inactiveColor} 
          />
        </View>
        <Text style={[
          styles.navText, 
          { color: isActive ? activeColor : inactiveColor }
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[
      styles.bottomNav, 
      { 
        backgroundColor: isDark ? '#1A2332' : '#FFF', 
        borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
        paddingBottom: Math.max(insets.bottom, 16)
      }
    ]}>
      <NavItem tab="overview" icon="grid-outline" label="OVERVIEW" />
      <NavItem tab="requests" icon="ticket-outline" label="REQUESTS" />
      
      <TouchableOpacity 
        style={styles.navItemCenter} 
        onPress={() => {
          if (onCreateRequestPress) {
            onCreateRequestPress();
          } else {
            // Default behavior if not on MST dashboard
            router.push(`/property/${propertyId}/mst` as any);
            // We can't easily trigger the modal from here if we are navigating, 
            // so we'll just go home or show an alert
            Alert.alert('New Request', 'To create a new request, please use the "+" button on the main dashboard.');
          }
        }}
        activeOpacity={0.8}
      >
        <View style={styles.centerFab}>
          <Ionicons name="add" size={32} color="#FFF" />
        </View>
      </TouchableOpacity>

      <NavItem tab="loggers" icon="options-outline" label="LOGGERS" />
      <NavItem tab="profile" icon="person-outline" label="PROFILE" />
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
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
  },
  navItemCenter: {
    alignItems: 'center',
    flex: 1,
    height: 60,
    justifyContent: 'center',
  },
  centerFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -30, // Lift it up
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 4,
    borderColor: '#FFF',
  },
});
