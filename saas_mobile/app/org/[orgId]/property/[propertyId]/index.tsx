'use client';

import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

/**
 * Property Detail Page — Delegates to the correct role-based dashboard
 * Route: /org/[orgId]/property/[propertyId]
 */
export default function PropertyDetailPage() {
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

  // Define role context
  const propMembership = membership.properties?.find(
    (p) => p.id.toLowerCase() === propertyId.toLowerCase()
  );
  const propRole = propMembership?.role?.trim()?.toLowerCase();
  const orgRole = (membership.org_role ?? '').trim().toLowerCase();

  const isOrgSuperAdmin = ['org_admin', 'org_super_admin', 'owner'].includes(propRole ?? '') || 
                         ['org_admin', 'org_super_admin', 'owner'].includes(orgRole);

  const isPropertyAdmin = [
    'property_admin', 
    'admin', 
    'manager', 
    'property manager', 
    'property_manager', 
    'facility_manager',
    'facility manager',
    'spoc',
    'administrator'
  ].includes(propRole ?? '');

  // Redirect based on role
  if (isOrgSuperAdmin) {
    return <Redirect href={`/property/${propertyId}/lovable-super-admin`} />;
  }

  if (isPropertyAdmin) {
    return <Redirect href={`/property/${propertyId}/lovable-admin`} />;
  }

  if (propRole === 'mst' || propRole === 'maintenance_staff' || propRole === 'staff') {
    return <Redirect href={`/property/${propertyId}/lovable-mst`} />;
  }

  if (propRole === 'tenant' || propRole === 'super_tenant') {
    return <Redirect href={`/property/${propertyId}/tenant`} />;
  }

  // Fallback to the premium apple-style dashboard if role not explicitly handled
  return <Redirect href={`/property/${propertyId}/dashboard`} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f1628',
  },
});
