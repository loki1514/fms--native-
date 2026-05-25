import { serverApi } from '@/lib/serverApi';
import { supabase } from '@/utils/supabase';
import type { DashboardStats } from '@/types';
import { ApiResponse } from './api/client';
export type { DashboardStats } from '@/types';

export const reportService = {
  getDashboardStats,
  getTicketStats,
};

type TicketStatus = 'open' | 'in_progress' | 'on_hold' | 'resolved' | 'closed' | 'escalated';
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

interface TicketStats {
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
  total: number;
}

async function resolveOrgId(_userId: string): Promise<string | null> {
  const res = await serverApi.query<{ organization_id: string }>({
    table: 'organization_memberships',
    action: 'select',
    select: 'organization_id',
    single: true,
  });
  return res.data?.organization_id ?? null;
}

async function resolvePropertyIdForOrg(orgId: string): Promise<string | null> {
  const res = await serverApi.query<{ id: string }>({
    table: 'properties',
    action: 'select',
    select: 'id',
    filters: [{ op: 'eq', column: 'organization_id', value: orgId }],
    single: true,
  });
  return res.data?.id ?? null;
}

// Removed local stat fetching functions as they are now handled by the backend API routes

export async function getDashboardStats(propertyId?: string): Promise<ApiResponse<DashboardStats>> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return { data: null, error: 'User not authenticated' };

    let orgId: string | null = null;
    let resolvedPropertyId: string | null = propertyId ?? null;

    if (!propertyId) {
      orgId = await resolveOrgId(userId);
      if (!orgId) return { data: null, error: 'No organization found' };
      resolvedPropertyId = await resolvePropertyIdForOrg(orgId);
    }

    const qs = resolvedPropertyId ? `propertyId=${resolvedPropertyId}` : `orgId=${orgId}`;
    
    const [dashRes, visRes] = await Promise.all([
      serverApi.get<any>(`/api/reports/dashboard-stats?${qs}`),
      serverApi.get<any>(`/api/reports/visitor-stats?${qs}`)
    ]);

    if (dashRes.error) return { data: null, error: dashRes.error.message || 'Failed to fetch dashboard stats' };
    if (visRes.error) return { data: null, error: visRes.error.message || 'Failed to fetch visitor stats' };

    const ds = dashRes.data.stats;
    const vs = visRes.data.stats;

    const stats: DashboardStats = {
      tickets: ds.tickets,
      visitors: vs,
      stock: ds.stock,
      users: ds.users,
      resolvedToday: ds.resolvedToday || 0,
      avgResolutionTime: ds.avgResolutionTime || 0,
      slaCompliance: ds.slaCompliance || 100,
    };

    return { data: stats, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: null, error: message };
  }
}

export async function getTicketStats(propertyId?: string): Promise<ApiResponse<TicketStats>> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return { data: null, error: 'User not authenticated' };

    let orgId: string | null = null;
    let resolvedPropertyId: string | null = propertyId ?? null;

    if (!propertyId) {
      orgId = await resolveOrgId(userId);
      if (!orgId) return { data: null, error: 'No organization found' };
      resolvedPropertyId = await resolvePropertyIdForOrg(orgId);
    }

    const qs = resolvedPropertyId ? `propertyId=${resolvedPropertyId}` : `orgId=${orgId}`;
    const res = await serverApi.get<any>(`/api/reports/ticket-stats?${qs}`);
    
    if (res.error) return { data: null, error: res.error.message || 'Failed to fetch ticket stats' };

    return { data: res.data.stats, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: null, error: message };
  }
}
