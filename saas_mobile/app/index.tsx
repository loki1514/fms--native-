import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { View, ActivityIndicator, Text } from 'react-native';
import { useEffect } from 'react';

export default function Index() {
  const { user, isLoading, membership, isMembershipLoading } = useAuth();

  useEffect(() => {
    console.log('[Index] isLoading:', isLoading, 'isMembershipLoading:', isMembershipLoading, 'user:', user?.email, 'membership:', membership?.properties?.length);
  }, [isLoading, isMembershipLoading, user, membership]);

  // Wait for both Auth and Membership to finish loading
  if (isLoading || isMembershipLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#708F96" />
        <Text style={{ marginTop: 16, color: '#666', fontSize: 14 }}>Loading Session...</Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  // Super Admin — master admin check
  if (user?.user_metadata?.is_master_admin) {
    return <Redirect href="/master" />;
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
