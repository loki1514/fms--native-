import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

export default function Index() {
  const { user, isLoading, membership, isMembershipLoading } = useAuth();

  const isReady = !isLoading && !isMembershipLoading;

  if (!isReady) {
    return null; // The global splash screen in _layout.tsx handles this phase
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  // Lovable Super Admin — email-gated redirect
  if (user?.email?.toLowerCase() === 'sanyog@gmail.com') {
    return <Redirect href="/super-admin" />;
  }

  // Lovable test dashboards — email-gated redirect
  if (membership && membership.properties && membership.properties.length > 0) {
    const firstProperty = membership.properties[0];
    const email = user?.email?.toLowerCase() ?? '';
    if (email === 'srustikarta2022@gmail.com') {
      return <Redirect href={`/property/${firstProperty.id}/lovable-mst`} />;
    }
    if (email === 'lohitexplores@gmail.com') {
      return <Redirect href={`/property/${firstProperty.id}/lovable-admin`} />;
    }
  }

  // User is authenticated — redirect to their first property's index (which has role-based routing)
  if (membership && membership.properties && membership.properties.length > 0) {
    const firstProperty = membership.properties[0];
    console.log('[Index] Redirecting to property:', firstProperty.id, firstProperty.name);
    return <Redirect href={`/property/${firstProperty.id}`} />;
  }

  // User has no properties but already completed onboarding — send to property selection
  if (user?.user_metadata?.onboarding_completed) {
    return <Redirect href="/(auth)/property-selection" />;
  }

  // User is authenticated but has no property access — send to onboarding to complete setup
  return <Redirect href="/onboarding" />;
}
