'use client';
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTenantTickets } from '@/hooks/tenant/useTenantTickets';
import { useWeather } from '@/hooks/useWeather';
import { VoicePipelineConfig } from '@/services/ai/voiceAgentPipeline';

import { OverviewTab } from './tabs/OverviewTab';
import { RequestsTab } from './tabs/RequestsTab';
import { RoomBookingTab } from './tabs/RoomBookingTab';
import { ProfileTab } from './tabs/ProfileTab';
import { TenantBottomNav } from './TenantBottomNav';
import { VoiceOrbWrapper } from '../voice/VoiceOrbWrapper';
import { TenantTicketModal } from './TenantTicketModal';
import { AuroraBackground } from '../shared/AuroraBackground';
import { useSuperTenantProperties, SuperTenantProperty } from '@/hooks/tenant/useSuperTenantProperties';

type TabKey = 'home' | 'tickets' | 'rooms' | 'profile';

interface TenantDashboardProps {
  propertyId: string;
  isSuperTenant?: boolean;
  // Optional override for initial selected property
  forcePropertyId?: string;
}

export default function TenantDashboard({
  propertyId,
  isSuperTenant = false,
  forcePropertyId,
}: TenantDashboardProps) {
  console.log('[TenantDashboard] Mounting — propertyId:', propertyId, 'isSuperTenant:', isSuperTenant, 'forcePropertyId:', forcePropertyId);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, membership } = useAuth();
  const { weather } = useWeather();
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    forcePropertyId ?? propertyId
  );
  const [refreshing, setRefreshing] = useState(false);
  const [ticketModalVisible, setTicketModalVisible] = useState(false);

  // DEFENSE-IN-DEPTH: Guard against undefined propertyId
  if (!propertyId) {
    console.error('[TenantDashboard] CRASH GUARD — propertyId is undefined!');
    return (
      <View style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#EF4444', fontSize: 16 }}>Error: property ID is missing</Text>
        </View>
      </View>
    );
  }

  // Fetch super tenant properties via web API (mirrors GET /api/super-tenant)
  const { properties: fetchedSuperTenantProperties } = useSuperTenantProperties(
    isSuperTenant ? user?.id : undefined
  );

  // Map fetched properties to { id, name }
  const superTenantProperties: Array<{ id: string; name: string }> = useMemo(() => {
    return fetchedSuperTenantProperties.map((p: SuperTenantProperty) => ({
      id: p.id,
      name: p.name,
    }));
  }, [fetchedSuperTenantProperties]);

  const { tickets, loading, error, stats, refetch } = useTenantTickets(
    selectedPropertyId,
    user?.id
  );

  console.log('[TenantDashboard] selectedPropertyId:', selectedPropertyId, 'tickets count:', tickets.length, 'stats:', JSON.stringify(stats), 'loading:', loading, 'error:', error);

  const userName = user?.full_name ?? user?.user_metadata?.full_name ?? 'Tenant';
  const propertyName = useMemo(() => {
    if (isSuperTenant && superTenantProperties.length > 0) {
      return (
        superTenantProperties.find((p) => p.id === selectedPropertyId)?.name ??
        'Property'
      );
    }
    return membership?.properties?.[0]?.name ?? 'Property';
  }, [isSuperTenant, selectedPropertyId, superTenantProperties, membership]);

  const voiceConfig: VoicePipelineConfig = useMemo(
    () => ({
      userId: user?.id ?? '',
      propertyId: selectedPropertyId,
      organizationId: membership?.org_id ?? '',
      userRole: isSuperTenant ? 'super_tenant' : 'tenant',
      userName,
      propertyName,
    }),
    [user?.id, selectedPropertyId, membership?.org_id, isSuperTenant, userName, propertyName]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleSignOut = useCallback(() => {
    router.replace('/login');
  }, [router]);

  const handleTicketPress = useCallback(
    (ticket: { id: string }) => {
      router.push(`/tickets/${ticket.id}` as never);
    },
    [router]
  );

  const handleCreateTicket = useCallback(() => {
    setTicketModalVisible(true);
  }, []);

  const handleTicketCreated = useCallback(
    async (_ticketNumber: string, _ticketId: string) => {
      // Refresh ticket list after creation
      await refetch();
    },
    [refetch]
  );

  // Property picker for super tenant
  const propertyPicker = isSuperTenant && superTenantProperties.length > 1 ? (
    <View style={superTenantPickerStyles.container}>
      {superTenantProperties.map((p) => (
        <View
          key={p.id}
          style={[
            superTenantPickerStyles.chip,
            p.id === selectedPropertyId && superTenantPickerStyles.chipActive,
          ]}
          onTouchEnd={() => setSelectedPropertyId(p.id)}
        >
          <View style={superTenantPickerStyles.dot} />
          <Text style={superTenantPickerStyles.name}>{p.name}</Text>
        </View>
      ))}
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      {/* Ambient aurora background */}
      {weather && <AuroraBackground colors={weather.auroraColors} />}

      {/* Tab content */}
      {activeTab === 'home' && (
        <OverviewTab
          propertyName={propertyName}
          stats={stats}
          recentTickets={tickets}
          isSuperTenant={isSuperTenant}
          propertyPicker={propertyPicker}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onTicketPress={handleTicketPress}
          weather={weather}
        />
      )}
      {activeTab === 'tickets' && (
        <RequestsTab
          tickets={tickets}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onTicketPress={handleTicketPress}
          onCreateTicket={handleCreateTicket}
        />
      )}
      {activeTab === 'rooms' && (
        <RoomBookingTab
          propertyId={selectedPropertyId}
          userId={user?.id ?? ''}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
      {activeTab === 'profile' && (
        <ProfileTab onSignOut={handleSignOut} />
      )}

      {/* Voice Orb — anchored above bottom nav */}
      <VoiceOrbWrapper config={voiceConfig} />

      {/* Ticket Creation Modal (mirrors POST /api/tickets from web app) */}
      <TenantTicketModal
        visible={ticketModalVisible}
        propertyId={selectedPropertyId}
        organizationId={membership?.org_id ?? ''}
        userId={user?.id ?? ''}
        userName={userName}
        propertyName={propertyName}
        onClose={() => setTicketModalVisible(false)}
        onSuccess={handleTicketCreated}
      />

      {/* Bottom Navigation */}
      <TenantBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: insets.bottom,
        }}
      />
    </View>
  );
}

const superTenantPickerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  chipActive: {
    backgroundColor: '#667eea',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#667eea',
  },
  name: {
    fontSize: 13,
    color: '#1a1a1a',
    fontWeight: '500',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
});
