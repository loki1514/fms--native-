/**
 * useChatScopeProperties — resolves the property list that powers the
 * Cassandra PropertyScopeToggle for the *current* user.
 *
 * Why this exists:
 *   `membership.properties` (from useAuth) is sourced from
 *   `property_memberships`. That covers regular roles (member, MST,
 *   manager, tenant) just fine, but Super Tenants frequently have access
 *   to many properties that are NOT in `property_memberships` — they're
 *   tracked separately via /api/super-tenant (see useSuperTenantProperties
 *   for the Tenant Dashboard's own picker that uses the same source).
 *
 *   Without this hook, a Super Tenant who manages 5 sites would open
 *   Cassandra, see no toggle, and Cassandra would silently fall back to
 *   whatever single property_id is on their JWT — usually wrong.
 *
 * What it does:
 *   - For regular users: returns `membership.properties` unchanged.
 *   - For Super Tenants (detected via `org_role === 'super_tenant'` OR any
 *     property_membership with `role === 'super_tenant'`): fetches the
 *     super-tenant API and merges into the list, de-duped by property id.
 *     The existing membership entry wins for role display when both
 *     sources contain the same property.
 *
 * The list is alphabetised so toggle chips don't reshuffle between
 * fetches.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getSuperTenantProperties } from '@/utils/api/mobileApi';
import type { PropertyInfo } from '@/types/membership';

export function useChatScopeProperties(): PropertyInfo[] {
  const { user, membership } = useAuth();

  // Detect "is this user a super tenant?" — org-level role OR any
  // per-property role marks them as such.
  const isSuperTenant = useMemo(() => {
    if (!membership) return false;
    if (membership.org_role === 'super_tenant') return true;
    return (membership.properties ?? []).some((p) => p.role === 'super_tenant');
  }, [membership]);

  // Lazily fetch the super-tenant property list (only for super tenants).
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
        setSuperTenantExtra(mapped);
      })
      .catch(() => {
        // Non-fatal — we still have membership.properties to fall back on.
        if (!cancelled) setSuperTenantExtra([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isSuperTenant, user?.id]);

  // Merge + dedupe (membership entry wins on id collision) + alphabetise.
  return useMemo<PropertyInfo[]>(() => {
    const base = membership?.properties ?? [];
    const map = new Map<string, PropertyInfo>();
    for (const p of base) map.set(p.id, p);
    for (const p of superTenantExtra) if (!map.has(p.id)) map.set(p.id, p);
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [membership?.properties, superTenantExtra]);
}
