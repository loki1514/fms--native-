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
        <ActivityIndicator size="large" color="#708F96" />
      </View>
    );
  }

  if (!propertyId) {
    return <Redirect href="/" />;
  }

  if (!membership || !user) {
    return <Redirect href="/login" />;
  }

  // Lovable test dashboards — email-gated redirect (before role logic)
  const userEmail = user.email?.toLowerCase() ?? '';
  if (userEmail === 'srustikarta2022@gmail.com') {
    return <Redirect href={`/property/${propertyId}/lovable-mst`} />;
  }
  if (userEmail === 'lohitexplores@gmail.com') {
    return <Redirect href={`/property/${propertyId}/lovable-admin`} />;
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

  // Route org_super_admin / org_admin to the Apple Weather Super Admin dashboard
  if (['org_admin', 'org_super_admin', 'owner', 'super_tenant'].includes(orgRole)) {
    const orgId = membership.org_id;
    if (orgId) {
      return <Redirect href={`/org/${orgId}`} />;
    }
    // Fallback if no org_id — use first property's org (last resort)
    const firstProperty = membership.properties?.[0];
    if (firstProperty) {
      return <Redirect href={`/org/${propertyId}`} />;
    }
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
