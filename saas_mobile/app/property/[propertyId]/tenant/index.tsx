import React, { useMemo } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import TenantDashboard from '@/components/tenant/TenantDashboard';

export default function TenantPage() {
  console.log('[TenantPage] Rendering...');
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { user, membership, isLoading } = useAuth();
  const router = useRouter();

  // DEFENSE-IN-DEPTH: Guard against undefined propertyId
  if (!propertyId) {
    console.log('[TenantPage] propertyId is undefined — redirecting to index');
    return null;
  }

  // Check if user is tenant or super_tenant for this property
  const roleInfo = useMemo(() => {
    console.log('[TenantPage] useMemo running, membership:', !!membership, 'user:', !!user, 'propertyId:', propertyId);
    if (!membership || !user) {
      console.log('[TenantPage] No membership or user yet — returning null (layout will show loading)');
      return null;
    }

    console.log('[TenantPage] membership.properties:', JSON.stringify(membership.properties?.map(p => ({ id: p.id, name: p.name, role: p.role }))));
    console.log('[TenantPage] propertyId from route:', propertyId);
    console.log('[TenantPage] membership.org_role:', membership.org_role);

    // Check property membership
    const propMembership = membership.properties?.find((p: { id: string }) => p.id === propertyId);
    if (propMembership) {
      console.log('[TenantPage] Found property membership, role:', propMembership.role);
      const isST = propMembership.role === 'super_tenant';
      return {
        role: propMembership.role,
        isSuperTenant: isST,
      };
    }

    // Check org-level roles for super_tenant
    if (['org_admin', 'org_super_admin', 'owner', 'super_tenant'].includes(membership.org_role ?? '')) {
      console.log('[TenantPage] Org-level role, isSuperTenant: true');
      return { role: membership.org_role, isSuperTenant: true };
    }

    // Org-level super_tenant (not assigned to a specific property)
    if (membership.org_role === 'super_tenant') {
      console.log('[TenantPage] Org-level super_tenant, isSuperTenant: true');
      return { role: membership.org_role, isSuperTenant: true };
    }

    console.log('[TenantPage] No role match — redirecting');
    return null;
  }, [membership, propertyId]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  if (!roleInfo) {
    // Redirect to dashboard if not authorized
    router.replace(`/property/${propertyId}/dashboard`);
    return null;
  }

  return (
    <TenantDashboard
      propertyId={propertyId}
      isSuperTenant={roleInfo.isSuperTenant}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});
