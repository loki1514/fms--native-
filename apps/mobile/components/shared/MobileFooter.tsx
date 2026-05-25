import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeBlurView from '@/components/ui/SafeBlurView';
import SidekickFace from '@/components/dashboard/SidekickFace';
import { useAuth } from '@/hooks/useAuth';
import CassandraSessionModal from '@/components/cassandra/CassandraSessionModal';
import { getPropertyRole } from '@/types/membership';
import { useCassandraStore } from '@/stores/cassandraStore';

const fontSans = Platform.OS === 'ios' ? 'System' : 'sans-serif';

interface MobileFooterProps {
  activeTab?: 'dashboard' | 'tickets' | 'stock' | 'more';
  onMorePress?: () => void;
  propertyId?: string;
}

export default function MobileFooter({ activeTab: propActiveTab, onMorePress, propertyId: propPropertyId }: MobileFooterProps) {
  const router = useRouter();
  const { propertyId: urlPropertyId } = useLocalSearchParams<{ propertyId: string }>();
  const pathname = usePathname();
  const propertyId = propPropertyId ?? urlPropertyId;
  const insets = useSafeAreaInsets();
  const { membership } = useAuth();
  const [showCassandraChat, setShowCassandraChat] = useState(false);

  const orgId = membership?.org_id ?? '211e1330-ad83-446d-941f-dcea48396798';

  const role = propertyId ? getPropertyRole(membership, propertyId) : null;

  // Cassandra voice state for animated orb
  const voiceState = useCassandraStore((s) => s.voiceState);
  const faceState: any = (() => {
    if (voiceState === 'recording' || voiceState === 'processing' || voiceState === 'connecting') return 'listening';
    if (voiceState === 'speaking') return 'speaking';
    if (voiceState === 'error') return 'alert';
    return 'idle';
  })();
  const isTenant = role === 'tenant' || role === 'super_tenant';

  const activeTab = propActiveTab || (pathname.includes('/tickets') ? 'tickets' : pathname.includes('/dashboard') ? 'dashboard' : 'dashboard');

  const navTo = (route: string) => {
    if (propertyId) {
      router.push(`/property/${propertyId}/${route}` as any);
    }
  };

  const handleDashboardPress = () => {
    if (propertyId) {
      router.push(`/property/${propertyId}` as any);
    } else if (pathname === '/super-admin') {
      // Already on super-admin dashboard, do nothing
      return;
    } else {
      router.push('/super-admin' as any);
    }
  };

  const handleTicketsPress = () => {
    if (propertyId) {
      router.push(`/property/${propertyId}/tickets` as any);
    } else {
      // No property selected — can't show tickets
      alert('Select a property to view tickets');
    }
  };

  return (
    <View style={styles.container}>
      <SafeBlurView intensity={90} style={[styles.blur, { paddingBottom: Math.max(insets.bottom, 8) }]} tint="dark">
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={handleDashboardPress}
        >
          <Ionicons 
            name={activeTab === 'dashboard' ? 'grid' : 'grid-outline'} 
            size={22} 
            color={activeTab === 'dashboard' ? '#FFF' : 'rgba(255,255,255,0.4)'} 
          />
          <Text style={[styles.navLabel, activeTab === 'dashboard' && styles.navLabelActive]}>Dashboard</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={handleTicketsPress}
        >
          <Ionicons 
            name={activeTab === 'tickets' ? 'ticket' : 'ticket-outline'} 
            size={22} 
            color={activeTab === 'tickets' ? '#FFF' : 'rgba(255,255,255,0.4)'} 
          />
          <Text style={[styles.navLabel, activeTab === 'tickets' && styles.navLabelActive]}>Tickets</Text>
        </TouchableOpacity>

        {/* Center Cassandra Orb */}
        <View style={[styles.navItem, styles.navItemCenter]}>
          <SidekickFace size={44} state={faceState} compact onClick={() => setShowCassandraChat(true)} />
          <Text style={styles.navLabel}>Cassandra</Text>
        </View>

        {/* Visitors (tenant) or Stock (admin/staff) */}
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navTo(isTenant ? 'visitors' : 'stock')}
        >
          <Ionicons 
            name={activeTab === 'stock' ? (isTenant ? 'people' : 'business') : (isTenant ? 'people-outline' : 'business-outline')} 
            size={22} 
            color={activeTab === 'stock' ? '#FFF' : 'rgba(255,255,255,0.4)'} 
          />
          <Text style={[styles.navLabel, activeTab === 'stock' && styles.navLabelActive]}>
            {isTenant ? 'Visitors' : 'Stock'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            if (onMorePress) {
              onMorePress();
            }
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color="rgba(255,255,255,0.4)" />
          <Text style={styles.navLabel}>More</Text>
        </TouchableOpacity>
      </SafeBlurView>

      <CassandraSessionModal
        visible={showCassandraChat}
        onClose={() => setShowCassandraChat(false)}
        orgId={orgId}
        propertyId={propertyId}
        initialMode="voice"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  blur: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: 'rgba(14, 14, 22, 0.92)',
    overflow: 'hidden',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    gap: 3,
    paddingVertical: 6,
    paddingBottom: 4,
  },
  navItemCenter: {
    position: 'relative',
  },
  navLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
    fontFamily: fontSans,
  },
  navLabelActive: {
    color: '#FFF',
  },

});
