import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function DashboardPage() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  return <Redirect href={`/property/${propertyId}`} />;
}
