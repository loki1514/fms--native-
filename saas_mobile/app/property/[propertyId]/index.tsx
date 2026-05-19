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

  // Lovable test dashboards — email-gated redirect (before role logic)
  const userEmail = user.email?.toLowerCase() ?? '';
  if (userEmail === 'srustikarta2022@gmail.com') {
    return <Redirect href={`/property/${propertyId}/lovable-mst`} />;
  }
  if (userEmail === 'lohitexplores@gmail.com') {
    return <Redirect href={`/property/${propertyId}/lovable-admin`} />;
  }

  return <Redirect href={`/property/${propertyId}/dashboard`} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
  },
});
