'use client';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle } from 'react-native-svg';

type TabKey = 'home' | 'tickets' | 'rooms' | 'profile';

interface TenantBottomNavProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  style?: object;
}

const TAB_KEYS: TabKey[] = ['home', 'tickets', 'rooms', 'profile'];
const TAB_LABELS: Record<TabKey, string> = {
  home: 'Home',
  tickets: 'Tickets',
  rooms: 'Rooms',
  profile: 'Profile',
};
const TAB_POSITIONS: Record<TabKey, number> = {
  home: 0,
  tickets: 1,
  rooms: 2,
  profile: 3,
};

const HomeIcon = ({ color, active }: { color: string; active: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Path d="M9 22V12h6v10" />
  </Svg>
);

const TicketIcon = ({ color, active }: { color: string; active: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <Path d="M13 5v14" />
    <Path d="M17 9H9" />
  </Svg>
);

const RoomIcon = ({ color, active }: { color: string; active: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 21V7l9-4 9 4v14" />
    <Path d="M9 21V12h6v9" />
    <Path d="M3 21h18" />
    <Path d="M12 3v4" />
  </Svg>
);

const ProfileIcon = ({ color, active }: { color: string; active: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="8" r="4.5" />
    <Path d="M5.5 20c0-3.6 3-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
  </Svg>
);

const ICONS: Record<TabKey, typeof HomeIcon> = {
  home: HomeIcon,
  tickets: TicketIcon,
  rooms: RoomIcon,
  profile: ProfileIcon,
};

// Each tab occupies 25% of the nav width
// Indicator starts 12px in, each tab is (screenWidth - 16) / 4
const SCREEN_W = Dimensions.get('window').width;
const PILL_WIDTH = 52;
const NAV_PADDING = 8;
const TAB_AREA_WIDTH = SCREEN_W - NAV_PADDING * 2;
const TAB_WIDTH = TAB_AREA_WIDTH / 4;
const PILL_OFFSET = 12; // left inset matching container padding

export function TenantBottomNav({ activeTab, onTabChange, style }: TenantBottomNavProps) {
  const activeIndex = TAB_POSITIONS[activeTab];
  const indicatorTranslateX = useSharedValue(activeIndex * TAB_WIDTH);

  useEffect(() => {
    indicatorTranslateX.value = withSpring(activeIndex * TAB_WIDTH, {
      damping: 18,
      stiffness: 200,
      mass: 0.6,
    });
  }, [activeIndex]);

  const handleTabPress = (key: TabKey) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onTabChange(key);
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorTranslateX.value + PILL_OFFSET }],
  }));

  return (
    <View style={[styles.container, style]}>
      {/* Sliding pill indicator */}
      <Animated.View style={[styles.pill, indicatorStyle]} />

      {TAB_KEYS.map((key) => {
        const active = key === activeTab;
        const color = active ? '#667eea' : '#9CA3AF';
        const Icon = ICONS[key];

        return (
          <TouchableOpacity
            key={key}
            onPress={() => handleTabPress(key)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            activeOpacity={0.7}
          >
            <Icon color={color} active={active} />
            <Text style={[styles.label, active && styles.labelActive]}>
              {TAB_LABELS[key]}
            </Text>
            {active && <View style={styles.activeDot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 84,
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: 'rgba(250,251,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  pill: {
    position: 'absolute',
    bottom: 54,
    width: PILL_WIDTH,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(102,126,234,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 12,
  },
  label: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
    fontWeight: '500',
  },
  labelActive: {
    color: '#667eea',
    fontWeight: '700',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#667eea',
    marginTop: 3,
  },
});
