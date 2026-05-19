'use client';

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import LovablePropertyAdminDashboard from '@/components/dashboard/LovablePropertyAdminDashboard';

export default function DashboardScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  return <LovablePropertyAdminDashboard propertyId={propertyId ?? ''} />;
}
