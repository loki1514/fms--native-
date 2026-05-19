import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

// All roles now use the unified sidebar dashboard with capability-based module filtering.
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
    (p) => p.id.toLowerCase() === propertyId.toLowerCase()
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

  // Lovable test dashboards — email-gated override
  const userEmail = user.email?.toLowerCase() ?? '';
  if (userEmail === 'srustikarta2022@gmail.com') {
    return <Redirect href={`/property/${propertyId}/lovable-mst`} />;
  }
  if (userEmail === 'lohitexplores@gmail.com') {
    return <Redirect href={`/property/${propertyId}/lovable-admin`} />;
  }

  if (isOrgSuperAdmin) {
    return <Redirect href={`/property/${propertyId}/lovable-super-admin`} />;
  }

  if (isPropertyAdmin) {
    return <Redirect href={`/property/${propertyId}/lovable-admin`} />;
  }

  if (isMst) {
    return <Redirect href={`/property/${propertyId}/lovable-mst`} />;
  }

  if (isTenant) {
    return <Redirect href={`/property/${propertyId}/tenant`} />;
  }

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
