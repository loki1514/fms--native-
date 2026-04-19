import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import PropertyAdminDashboard from '@/components/dashboard/PropertyAdminDashboard';

export default function PropertyAdminRoute() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  if (!propertyId) return null;
  return <PropertyAdminDashboard propertyId={propertyId} />;
}
