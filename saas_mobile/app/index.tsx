import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { View, ActivityIndicator, Text } from 'react-native';
import { useEffect } from 'react';

export default function Index() {
  const { user, isLoading, membership, isMembershipLoading } = useAuth();

  useEffect(() => {
    if (__DEV__) {
      console.log('[Index] isLoading:', isLoading, 'isMembershipLoading:', isMembershipLoading, 'user:', user?.email, 'membership:', membership?.properties?.length);
    }
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
    return <Redirect href="/super-admin/dashboard" />;
  }

  // User is authenticated — handle property selection based on membership
  if (membership && membership.properties && membership.properties.length > 0) {
    const firstProperty = membership.properties[0];
    if (membership.properties.length === 1) {
      // Single property: redirect directly
      if (__DEV__) {
        console.log('[Index] Redirecting to single property:', firstProperty.id, firstProperty.name);
      }
      return <Redirect href={`/property/${firstProperty.id}`} />;
    } else {
      // Multiple properties: navigate to property selection screen with list
      if (__DEV__) {
        console.log('[Index] Multiple properties detected, navigating to selection');
      }
      const propsParam = encodeURIComponent(JSON.stringify(membership.properties));
      return <Redirect href={`/(auth)/property-selection?properties=${propsParam}`} />;
    }
  }

  // Onboarding check removed – onboarding will be presented only after account creation

  // User is authenticated but has no property access — send to property selection screen
  return <Redirect href="/(auth)/property-selection" />;
}
