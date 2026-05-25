/**
 * useChatScopeProperties — resolves the property list that powers the
 * Cassandra PropertyScopeToggle for the *current* user.
 *
 * Why this exists:
 *   `membership.properties` (from useAuth) is sourced from
 *   `property_memberships`. That covers regular roles (member, MST,
 *   manager, tenant) just fine, but TWO important populations have
 *   multi-property access WITHOUT explicit property_memberships rows:
 *
 *     1. Super Tenants — tracked separately via /api/super-tenant.
 *     2. Org-level admins (org_admin / org_super_admin / owner /
 *        super_admin / master_admin) — granted access to every property
 *        in the org via RLS policy on the `organization_id` foreign
 *        key, with zero rows in property_memberships.
 *
 *   Without this hook, an org admin would open Cassandra, see no toggle,
 *   and Cassandra would silently fall back to whatever single
 *   property_id is on their JWT — usually the first one their session
 *   happened to land on.
 *
 * What it does:
 *   - For regular users: returns `membership.properties` unchanged.
 *   - For Super Tenants: fetches /api/super-tenant and merges.
 *   - For Org-level admins: fetches every property where
 *     `organization_id === membership.org_id` and merges.
 *   - Fallback: if `membership.org_id` is missing but the user has an
 *     `organization_memberships` row, we resolve it directly (mirrors
 *     the fallback already used in LovableSuperAdminDashboard).
 *
 *   De-duped by property id (membership entry wins on collision so the
 *   per-property role is preserved), alphabetised so chips don't
 *   reshuffle between fetches.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/utils/supabase/client';
import { getSuperTenantProperties } from '@/utils/api/mobileApi';
import type { PropertyInfo } from '@/types/membership';

/** Roles that grant org-wide property access via RLS, not via property_memberships.
 *  MUST match the Database["public"]["Enums"]["app_role"] type exactly.
 */
const ORG_ADMIN_ROLES = new Set([
  'master_admin',
  'org_super_admin',
  'property_admin',
  'super_tenant',
]);

export function useChatScopeProperties(): PropertyInfo[] {
  const { user, membership } = useAuth();

  // ── Detect role classes ───────────────────────────────────────────────
  const isSuperTenant = useMemo(() => {
    if (!membership) return false;
    if (membership.org_role === 'super_tenant') return true;
    return (membership.properties ?? []).some((p) => p.role === 'super_tenant');
  }, [membership]);

  const isOrgAdmin = useMemo(() => {
    if (!membership) return false;
    const orgRole = (membership.org_role ?? '').toLowerCase();
    return ORG_ADMIN_ROLES.has(orgRole);
  }, [membership]);

  // ── Resolve org_id fallback when membership cache is incomplete ────────
  // AuthContext's fetchMembership uses `membership.org_id` from the org
  // membership query. If that row is missing or inactive, the dashboard
  // (LovableSuperAdminDashboard) has its own fallback that queries
  // organization_memberships directly. We mirror that here so the toggle
  // doesn't disappear just because the cached membership is stale.
  const [resolvedOrgId, setResolvedOrgId] = useState<string | null>(
    membership?.org_id ?? null
  );

  useEffect(() => {
    let cancelled = false;

    async function resolveOrgId() {
      // If membership already has an org_id, use it directly
      if (membership?.org_id) {
        if (!cancelled) setResolvedOrgId(membership.org_id);
        return;
      }

      // No org_id in membership — try to resolve from organization_memberships
      // directly, matching the fallback in LovableSuperAdminDashboard
      if (!user?.id) {
        if (!cancelled) setResolvedOrgId(null);
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from('organization_memberships')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .in('role', ['master_admin', 'org_super_admin', 'property_admin', 'super_tenant'])
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (__DEV__) {
        console.log('[useChatScopeProperties] org_id fallback query:', {
          userId: user.id.slice(0, 8),
          found: !!data,
          orgId: (data as any)?.organization_id ?? null,
          role: (data as any)?.role ?? null,
          error: error?.message ?? null,
        });
      }

      if (error || !data) {
        setResolvedOrgId(null);
        return;
      }

      setResolvedOrgId((data as any).organization_id ?? null);
    }

    resolveOrgId();

    return () => {
      cancelled = true;
    };
  }, [membership?.org_id, user?.id]);

  // ── Super Tenant extra properties (from /api/super-tenant) ───────────
  const [superTenantExtra, setSuperTenantExtra] = useState<PropertyInfo[]>([]);

  useEffect(() => {
    if (!isSuperTenant || !user?.id) {
      setSuperTenantExtra([]);
      return;
    }

    let cancelled = false;
    getSuperTenantProperties(user.id)
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          if (__DEV__) console.log('[useChatScopeProperties] super-tenant fetch error:', result.error);
          setSuperTenantExtra([]);
          return;
        }
        const mapped: PropertyInfo[] = [];
        for (const p of result.properties ?? []) {
          if (!p.property_id) continue;
          mapped.push({
            id: p.property_id,
            name: p.properties?.name ?? 'Unknown Property',
            code: p.properties?.code ?? '',
            role: 'super_tenant',
          });
        }
        if (__DEV__) console.log('[useChatScopeProperties] super-tenant extras:', mapped.length);
        setSuperTenantExtra(mapped);
      })
      .catch((err) => {
        if (!cancelled) {
          if (__DEV__) console.log('[useChatScopeProperties] super-tenant fetch exception:', err);
          setSuperTenantExtra([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isSuperTenant, user?.id]);

  // ── Org-admin extra properties (from `properties` table by org_id) ────
  const [orgAdminExtra, setOrgAdminExtra] = useState<PropertyInfo[]>([]);

  useEffect(() => {
    const effectiveOrgId = resolvedOrgId ?? membership?.org_id ?? null;

    if (__DEV__) {
      console.log('[useChatScopeProperties] org-admin check:', {
        isOrgAdmin,
        resolvedOrgId,
        membershipOrgId: membership?.org_id ?? null,
        effectiveOrgId,
        orgRole: membership?.org_role ?? null,
      });
    }

    if (!isOrgAdmin || !effectiveOrgId) {
      setOrgAdminExtra([]);
      return;
    }

    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name, code')
        .eq('organization_id', effectiveOrgId)
        .order('name', { ascending: true });

      if (cancelled) return;

      if (__DEV__) {
        console.log('[useChatScopeProperties] org properties query result:', {
          count: data?.length ?? 0,
          error: error?.message ?? null,
          orgId: effectiveOrgId,
        });
      }

      if (error || !data) {
        if (__DEV__) {
          console.warn('[useChatScopeProperties] org properties fetch failed:', error?.message);
        }
        setOrgAdminExtra([]);
        return;
      }

      const orgRoleLabel = (membership?.org_role ?? 'org_admin').toLowerCase();
      const mapped: PropertyInfo[] = data
        .filter((p: any) => p?.id)
        .map((p: any) => ({
          id: p.id as string,
          name: (p.name as string) ?? 'Unknown Property',
          code: (p.code as string) ?? '',
          role: orgRoleLabel,
        }));

      if (__DEV__) {
        console.log('[useChatScopeProperties] org-admin extras mapped:', mapped.length);
      }

      setOrgAdminExtra(mapped);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOrgAdmin, resolvedOrgId, membership?.org_id, membership?.org_role]);

  // ── Merge + dedupe + alphabetise ──────────────────────────────────────
  // Precedence: membership.properties wins (preserves per-property role),
  // then super-tenant extra, then org-admin extra fills in the rest.
  return useMemo<PropertyInfo[]>(() => {
    const base = membership?.properties ?? [];
    const map = new Map<string, PropertyInfo>();
    for (const p of base) map.set(p.id, p);
    for (const p of superTenantExtra) if (!map.has(p.id)) map.set(p.id, p);
    for (const p of orgAdminExtra) if (!map.has(p.id)) map.set(p.id, p);
    const result = Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    if (__DEV__) {
      console.log('[useChatScopeProperties] FINAL merge:', {
        base: base.length,
        superTenant: superTenantExtra.length,
        orgAdmin: orgAdminExtra.length,
        total: result.length,
      });
    }

    return result;
  }, [membership?.properties, superTenantExtra, orgAdminExtra]);
}
