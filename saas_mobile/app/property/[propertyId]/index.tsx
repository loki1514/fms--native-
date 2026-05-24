import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

/**
 * Property Index — Role-based dashboard routing
 * All property admin roles now use LovablePropertyAdminDashboard
 */
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

  // Role-based dashboard routing
  const propMembership = membership.properties?.find(
    (p) => p.id?.toLowerCase() === propertyId.toLowerCase()
  );
  const propRole = propMembership?.role?.trim()?.toLowerCase();
  const orgRole = (membership.org_role ?? '').trim().toLowerCase();

  const isOrgSuperAdmin = ['org_admin', 'org_super_admin', 'owner'].includes(propRole ?? '') ||
                         ['org_admin', 'org_super_admin', 'owner'].includes(orgRole);

  const isPropertyAdmin = [
    'property_admin', 'admin', 'manager', 'property manager',
    'property_manager', 'facility_manager', 'facility manager',
    'spoc', 'administrator'
  ].includes(propRole ?? '');

  const isMst = ['mst', 'maintenance_staff', 'staff'].includes(propRole ?? '');

  const isTenant = ['tenant', 'super_tenant'].includes(propRole ?? '');

  if (isOrgSuperAdmin) {
    return <Redirect href={`/property/${propertyId}/lovable-super-admin`} />;
  }

  if (isPropertyAdmin) {
    return <Redirect href={`/property/${propertyId}/dashboard`} />;
  }

  // Unified dashboard router at /dashboard handles MST, Staff, and unmapped roles
  if (isMst) {
    return <Redirect href={`/property/${propertyId}/dashboard`} />;
  }

  if (isTenant) {
    return <Redirect href={`/property/${propertyId}/tenant`} />;
  }

  // Fallback to unified dashboard for unhandled roles (vendor, technician, etc.)
  return <Redirect href={`/property/${propertyId}/dashboard`} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});
