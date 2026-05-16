import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import LovableOrgSuperAdminDashboard from '@/components/dashboard/LovableOrgSuperAdminDashboard';

export default function LovableSuperAdminRoute() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  return <LovableOrgSuperAdminDashboard propertyId={propertyId} />;
}
