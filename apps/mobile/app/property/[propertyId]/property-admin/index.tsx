import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function LegacyPropertyAdminDashboard() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { membership } = useAuth();

  if (!propertyId) {
    return <Redirect href="/" />;
  }

  // Role guard — only allow actual property admins through
  const propMembership = membership?.properties?.find(
    (p) => p.id?.toLowerCase() === propertyId.toLowerCase()
  );
  const propRole = propMembership?.role?.trim()?.toLowerCase() ?? '';
  const orgRole = (membership?.org_role ?? '').trim().toLowerCase();

  const isPropertyAdmin = [
    'property_admin', 'admin', 'manager', 'property_manager',
    'facility_manager', 'spoc', 'administrator'
  ].includes(propRole);

  const isOrgAdmin = ['org_admin', 'org_super_admin', 'owner'].includes(orgRole);

  if (!isPropertyAdmin && !isOrgAdmin) {
    return <Redirect href={`/property/${propertyId}/dashboard`} />;
  }

  return <Redirect href={`/property/${propertyId}/lovable-admin`} />;
}
