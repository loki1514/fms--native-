import React, { useMemo } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

// Routes tenant and super_tenant to the full-screen mobile dashboard.
// All other roles go to the sidebar-based dashboard.
export default function PropertyIndex() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { user, membership, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  if (!propertyId) {
    return <Redirect href="/" />;
  }

  if (!membership || !user) {
    return <Redirect href="/login" />;
  }

  // Check property-level membership
  const propMembership = membership.properties?.find((p) => p.id === propertyId);
  const propRole = propMembership?.role?.toLowerCase();

  // Check org-level for super_tenant
  const orgRole = (membership.org_role ?? '').toLowerCase();

  // Route tenant and super_tenant to the full-screen mobile dashboard
  if (propRole === 'tenant' || propRole === 'super_tenant') {
    return <Redirect href={`/property/${propertyId}/tenant`} />;
  }

  // Route MST (Maintenance Staff) to the premium MST dashboard
  if (propRole === 'mst' || propRole === 'maintenance_staff' || propRole === 'staff') {
    return <Redirect href={`/property/${propertyId}/mst`} />;
  }

  if (['org_admin', 'org_super_admin', 'owner'].includes(orgRole)) {
    return <Redirect href={`/property/${propertyId}/tenant`} />;
  }

  // All other roles → sidebar-based dashboard
  return <Redirect href={`/property/${propertyId}/dashboard`} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
  },
});
