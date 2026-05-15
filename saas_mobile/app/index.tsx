import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { View, ActivityIndicator, Text } from 'react-native';
import { useEffect } from 'react';

export default function Index() {
  const { user, isLoading, membership } = useAuth();

  useEffect(() => {
    console.log('[Index] isLoading:', isLoading, 'user:', user?.email, 'membership:', membership?.properties?.length);
  }, [isLoading, user, membership]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#708F96" />
        <Text style={{ marginTop: 16, color: '#666', fontSize: 14 }}>Loading...</Text>
      </View>
    );
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

  // User is authenticated but has no property access — send to onboarding to complete setup
  return <Redirect href="/onboarding" />;
}
