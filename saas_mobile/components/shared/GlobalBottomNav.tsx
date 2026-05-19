'use client';

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import SafeBlurView from '@/components/ui/SafeBlurView';
import SidekickFace from '@/components/dashboard/SidekickFace';
import CassandraSessionModal from '@/components/cassandra/CassandraSessionModal';
import GlobalNavigationDrawer from '@/components/shared/GlobalNavigationDrawer';
import { useCassandraStore } from '@/stores/cassandraStore';
import { useAuth } from '@/hooks/useAuth';

const fontSans = Platform.OS === 'ios' ? 'System' : 'sans-serif';

export default function GlobalBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const insets = useSafeAreaInsets();
  const { membership } = useAuth();

  const [showChat, setShowChat] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  // Cassandra voice state
  const voiceState = useCassandraStore((s) => s.voiceState);
  const faceState: any = (() => {
    if (voiceState === 'recording' || voiceState === 'processing' || voiceState === 'connecting') return 'listening';
    if (voiceState === 'speaking') return 'speaking';
    if (voiceState === 'error') return 'alert';
    return 'idle';
  })();

  const orgId = membership?.org_id ?? '';

  // Detect active tab from current pathname
  const activeTab = useMemo(() => {
    if (!pathname) return 'more';
    const p = pathname.toLowerCase();
    if (p.endsWith('/dashboard') || p.endsWith('/property/' + propertyId?.toLowerCase()) || p.match(/\/property\/[^\/]+$/)) return 'dashboard';
    if (p.includes('/tickets')) return 'tickets';
    if (p.includes('/stock')) return 'assets';
    return 'more';
  }, [pathname, propertyId]);

  const navigate = (route: string) => {
    router.push(`/property/${propertyId}/${route}` as any);
  };

  return (
    <>
      <View style={[styles.container, { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }]}>
        <SafeBlurView intensity={80} style={styles.navPill} tint="dark">
          <TouchableOpacity
            style={[styles.navItem, activeTab === 'dashboard' && styles.navItemActive]}
            onPress={() => navigate('dashboard')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'dashboard' ? 'grid' : 'grid-outline'}
              size={22}
              color={activeTab === 'dashboard' ? '#FFF' : 'rgba(255,255,255,0.4)'}
            />
            <Text style={[styles.navLabel, activeTab === 'dashboard' && styles.navLabelActive]}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, activeTab === 'tickets' && styles.navItemActive]}
            onPress={() => navigate('tickets')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'tickets' ? 'ticket' : 'ticket-outline'}
              size={22}
              color={activeTab === 'tickets' ? '#FFF' : 'rgba(255,255,255,0.4)'}
            />
            <Text style={[styles.navLabel, activeTab === 'tickets' && styles.navLabelActive]}>Tickets</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItemCenter} onPress={() => setShowChat(true)} activeOpacity={0.8}>
            <View style={styles.orb}>
              <SidekickFace state={faceState} size={32} onClick={() => setShowChat(true)} />
            </View>
            <Text style={styles.navLabel}>Cassandra</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, activeTab === 'assets' && styles.navItemActive]}
            onPress={() => navigate('stock')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'assets' ? 'business' : 'business-outline'}
              size={22}
              color={activeTab === 'assets' ? '#FFF' : 'rgba(255,255,255,0.4)'}
            />
            <Text style={[styles.navLabel, activeTab === 'assets' && styles.navLabelActive]}>Assets</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, activeTab === 'more' && styles.navItemActive]}
            onPress={() => setShowDrawer(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={22}
              color={activeTab === 'more' ? '#FFF' : 'rgba(255,255,255,0.4)'}
            />
            <Text style={[styles.navLabel, activeTab === 'more' && styles.navLabelActive]}>More</Text>
          </TouchableOpacity>
        </SafeBlurView>
      </View>

      <CassandraSessionModal
        visible={showChat}
        onClose={() => setShowChat(false)}
        orgId={orgId}
        initialMode="voice"
      />

      <GlobalNavigationDrawer
        visible={showDrawer}
        onClose={() => setShowDrawer(false)}
        propertyId={propertyId ?? ''}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  navPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(14, 14, 22, 0.92)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  navItemActive: {
    // subtle highlight if needed
  },
  navItemCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1.2,
    gap: 3,
    marginTop: -6,
  },
  navLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: fontSans,
    marginTop: 2,
  },
  navLabelActive: {
    color: '#FFF',
  },
  orb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
});
