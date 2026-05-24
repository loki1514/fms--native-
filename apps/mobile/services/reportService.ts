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

async function resolveOrgId(userId: string): Promise<string | null> {
  const { data } = await (supabase
    .from('organization_memberships')
    .select('organization_id') as any) as { data: { organization_id: string } | null; error: unknown };
  return data?.organization_id ?? null;
}

async function resolvePropertyIdForOrg(orgId: string): Promise<string | null> {
  const { data } = await (supabase
    .from('properties')
    .select('id') as any) as { data: { id: string } | null; error: unknown };
  return data?.id ?? null;
}

async function fetchTicketStats(filters: Record<string, unknown>) {
  let query = (supabase
    .from('tickets')
    .select('status') as any) as { data: unknown[]; error: unknown };
  for (const [key, value] of Object.entries(filters)) {
    query = (query as any).eq(key, value);
  }
  const { data, error } = await query;

  if (error) return { data: null, error: (error as { message: string }).message };

  const countMap: Record<string, number> = {};
  for (const t of (data ?? []) as { status: string }[]) {
    countMap[t.status] = (countMap[t.status] ?? 0) + 1;
  }

  return {
    data: {
      total: data?.length ?? 0,
      open: countMap['open'] ?? 0,
      inProgress: countMap['in_progress'] ?? 0,
      resolved: countMap['resolved'] ?? 0,
      closed: countMap['closed'] ?? 0,
    },
    error: null,
  };
}

async function fetchVisitorStats(propertyId: string | null, orgId: string | null) {
  const today = new Date().toISOString().split('T')[0];

  if (propertyId) {
    const { data: todayRows } = await (supabase
      .from('visitor_logs')
      .select('status') as any) as { data: { status: string }[] | null; error: unknown };
    const { data: allRows } = await (supabase
      .from('visitor_logs')
      .select('status') as any) as { data: { status: string }[] | null; error: unknown };

    const todayCount = todayRows?.filter((v) => v.status === 'checked_in' && (v as any).property_id === propertyId && (v as any).expected_date === today).length ?? 0;
    const checkedInToday = todayRows?.filter((v) => v.status === 'checked_in' && (v as any).property_id === propertyId && (v as any).expected_date === today).length ?? 0;
    const totalCount = allRows?.filter((v) => (v as any).property_id === propertyId).length ?? 0;
    const checkedInAll = allRows?.filter((v) => v.status === 'checked_in' && (v as any).property_id === propertyId).length ?? 0;

    return {
      today: todayCount,
      checkedIn: checkedInAll,
      total: totalCount,
      _checkedInToday: checkedInToday,
    };
  }

  if (orgId) {
    const { data: propIds } = await (supabase
      .from('properties')
      .select('id') as any) as { data: { id: string }[] | null; error: unknown };

    const allPropIds = (propIds ?? []).map((p) => p.id);
    if (allPropIds.length === 0) {
      return { today: 0, checkedIn: 0, total: 0, _checkedInToday: 0 };
    }

    const { data: todayRows } = await (supabase
      .from('visitor_logs')
      .select('status') as any) as { data: { status: string }[] | null; error: unknown };
    const { data: allRows } = await (supabase
      .from('visitor_logs')
      .select('status') as any) as { data: { status: string }[] | null; error: unknown };

    const todayCount = todayRows?.filter((v) => v.status === 'checked_in' && allPropIds.includes((v as any).property_id) && (v as any).expected_date === today).length ?? 0;
    const checkedInToday = todayCount;
    const totalCount = allRows?.filter((v) => allPropIds.includes((v as any).property_id)).length ?? 0;
    const checkedInAll = allRows?.filter((v) => v.status === 'checked_in' && allPropIds.includes((v as any).property_id)).length ?? 0;

    return {
      today: todayCount,
      checkedIn: checkedInAll,
      total: totalCount,
      _checkedInToday: checkedInToday,
    };
  }

  return { today: 0, checkedIn: 0, total: 0, _checkedInToday: 0 };
}

async function fetchStockStats(propertyId: string | null, orgId: string | null) {
  if (propertyId) {
    const { data } = await (supabase
      .from('stock_items')
      .select('quantity, min_threshold') as any) as { data: { quantity: number; min_threshold: number }[] | null; error: unknown };

    const total = data?.length ?? 0;
    const lowStock = data?.filter((s) => s.quantity > 0 && s.quantity <= s.min_threshold).length ?? 0;
    const outOfStock = data?.filter((s) => s.quantity === 0).length ?? 0;

    return { total, lowStock, outOfStock };
  }

  if (orgId) {
    const { data: propIds } = await (supabase
      .from('properties')
      .select('id') as any) as { data: { id: string }[] | null; error: unknown };

    const allPropIds = (propIds ?? []).map((p) => p.id);
    if (allPropIds.length === 0) {
      return { total: 0, lowStock: 0, outOfStock: 0 };
    }

    const { data } = await (supabase
      .from('stock_items')
      .select('quantity, min_threshold') as any) as { data: { quantity: number; min_threshold: number }[] | null; error: unknown };

    const filteredData = data?.filter((s) => allPropIds.includes((s as any).property_id)) ?? [];
    const total = filteredData.length;
    const lowStock = filteredData.filter((s) => s.quantity > 0 && s.quantity <= s.min_threshold).length;
    const outOfStock = filteredData.filter((s) => s.quantity === 0).length;

    return { total, lowStock, outOfStock };
  }

  return { total: 0, lowStock: 0, outOfStock: 0 };
}

async function fetchUserStats(propertyId: string | null, orgId: string | null) {
  if (propertyId) {
    const { data: members } = await (supabase
      .from('property_memberships')
      .select('user_id') as any) as { data: { user_id: string }[] | null; error: unknown };

    const userIds = (members ?? []).map((m) => m.user_id);
    if (userIds.length === 0) {
      return { total: 0, active: 0 };
    }

    const { data: users } = await (supabase
      .from('users')
      .select('is_active') as any) as { data: { is_active: boolean }[] | null; error: unknown };

    const total = users?.length ?? 0;
    const active = users?.filter((u) => u.is_active).length ?? 0;

    return { total, active };
  }

  if (orgId) {
    const { data: users } = await (supabase
      .from('users')
      .select('is_active') as any) as { data: { is_active: boolean }[] | null; error: unknown };

    const total = users?.length ?? 0;
    const active = users?.filter((u) => u.is_active).length ?? 0;

    return { total, active };
  }

  return { total: 0, active: 0 };
}

async function computeResolvedToday(propertyId: string | null, orgId: string | null): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  if (propertyId) {
    const { data } = await (supabase
      .from('tickets')
      .select('id') as any) as { data: unknown[] | null; error: unknown };
    return data?.filter((t: unknown) => {
      const ticket = t as Record<string, unknown>;
      return ticket.property_id === propertyId &&
        (ticket.resolved_at as string) >= `${today}T00:00:00` &&
        (ticket.resolved_at as string) <= `${today}T23:59:59`;
    }).length ?? 0;
  }

  if (orgId) {
    const { data } = await (supabase
      .from('tickets')
      .select('id') as any) as { data: unknown[] | null; error: unknown };
    return data?.filter((t: unknown) => {
      const ticket = t as Record<string, unknown>;
      return ticket.organization_id === orgId &&
        (ticket.resolved_at as string) >= `${today}T00:00:00` &&
        (ticket.resolved_at as string) <= `${today}T23:59:59`;
    }).length ?? 0;
  }

  return 0;
}

async function computeAvgResolutionTime(propertyId: string | null, orgId: string | null): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString();

  if (propertyId) {
    const { data } = await (supabase
      .from('tickets')
      .select('created_at, resolved_at') as any) as { data: { created_at: string; resolved_at: string }[] | null; error: unknown };

    const filtered = (data ?? []).filter(
      (t) => t.resolved_at && t.resolved_at >= cutoff
    );
    if (filtered.length === 0) return 0;
    const totalMs = filtered.reduce(
      (acc, t) => acc + (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()),
      0,
    );
    return Math.round(totalMs / filtered.length / 3600000);
  }

  if (orgId) {
    const { data } = await (supabase
      .from('tickets')
      .select('created_at, resolved_at') as any) as { data: { created_at: string; resolved_at: string }[] | null; error: unknown };

    const filtered = (data ?? []).filter(
      (t) => t.resolved_at && t.resolved_at >= cutoff
    );
    if (filtered.length === 0) return 0;
    const totalMs = filtered.reduce(
      (acc, t) => acc + (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()),
      0,
    );
    return Math.round(totalMs / filtered.length / 3600000);
  }

  return 0;
}

async function computeSlaCompliance(propertyId: string | null, orgId: string | null): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString();

  const slaHours: Record<string, number> = {
    urgent: 4,
    high: 24,
    medium: 72,
    low: 168,
  };

  if (propertyId) {
    const { data } = await (supabase
      .from('tickets')
      .select('id, status, created_at, resolved_at, closed_at, priority') as any) as { data: { created_at: string; resolved_at: string | null; closed_at: string | null; priority: string }[] | null; error: unknown };

    let compliant = 0;
    let total = 0;
    for (const t of (data ?? []).filter((t) => t.created_at >= cutoff)) {
      total++;
      const deadline = new Date(t.created_at).getTime() + (slaHours[t.priority] ?? 72) * 3600000;
      const resolvedAt = t.resolved_at ?? t.closed_at;
      if (resolvedAt && new Date(resolvedAt).getTime() <= deadline) {
        compliant++;
      }
    }
    return total > 0 ? Math.round((compliant / total) * 100) : 100;
  }

  if (orgId) {
    const { data } = await (supabase
      .from('tickets')
      .select('id, status, created_at, resolved_at, closed_at, priority') as any) as { data: { created_at: string; resolved_at: string | null; closed_at: string | null; priority: string }[] | null; error: unknown };

    let compliant = 0;
    let total = 0;
    for (const t of (data ?? []).filter((t) => t.created_at >= cutoff)) {
      total++;
      const deadline = new Date(t.created_at).getTime() + (slaHours[t.priority] ?? 72) * 3600000;
      const resolvedAt = t.resolved_at ?? t.closed_at;
      if (resolvedAt && new Date(resolvedAt).getTime() <= deadline) {
        compliant++;
      }
    }
    return total > 0 ? Math.round((compliant / total) * 100) : 100;
  }

  return 100;
}

export async function getDashboardStats(
  propertyId?: string,
): Promise<ApiResponse<DashboardStats>> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (!userId) {
      return { data: null, error: 'User not authenticated' };
    }

    let orgId: string | null = null;
    let resolvedPropertyId: string | null = propertyId ?? null;

    if (!propertyId) {
      orgId = await resolveOrgId(userId);
      if (!orgId) {
        return { data: null, error: 'No organization found' };
      }
      resolvedPropertyId = await resolvePropertyIdForOrg(orgId);
    }

    const ticketFilters: Record<string, unknown> = {};
    if (resolvedPropertyId) {
      ticketFilters.property_id = resolvedPropertyId;
    } else if (orgId) {
      ticketFilters.organization_id = orgId;
    }

    const ticketResult = await fetchTicketStats(ticketFilters);
    if (ticketResult.error) {
      return { data: null, error: ticketResult.error };
    }

    const [visitorStats, stockStats, userStats] = await Promise.all([
      fetchVisitorStats(resolvedPropertyId, orgId),
      fetchStockStats(resolvedPropertyId, orgId),
      fetchUserStats(resolvedPropertyId, orgId),
    ]);

    const [resolvedToday, avgResolutionTime, slaCompliance] = await Promise.all([
      computeResolvedToday(resolvedPropertyId, orgId),
      computeAvgResolutionTime(resolvedPropertyId, orgId),
      computeSlaCompliance(resolvedPropertyId, orgId),
    ]);

    const stats: DashboardStats = {
      tickets: ticketResult.data!,
      visitors: {
        today: visitorStats.today,
        total: visitorStats.total,
        checkedIn: visitorStats.checkedIn,
      },
      stock: {
        total: stockStats.total,
        lowStock: stockStats.lowStock,
        outOfStock: stockStats.outOfStock,
      },
      users: {
        total: userStats.total,
        active: userStats.active,
      },
      resolvedToday,
      avgResolutionTime,
      slaCompliance,
    };

    return { data: stats, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: null, error: message };
  }
}

export async function getTicketStats(
  propertyId?: string,
): Promise<ApiResponse<TicketStats>> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (!userId) {
      return { data: null, error: 'User not authenticated' };
    }

    let orgId: string | null = null;
    let resolvedPropertyId: string | null = propertyId ?? null;

    if (!propertyId) {
      orgId = await resolveOrgId(userId);
      if (!orgId) {
        return { data: null, error: 'No organization found' };
      }
      resolvedPropertyId = await resolvePropertyIdForOrg(orgId);
    }

    const filters: Record<string, unknown> = {};
    if (resolvedPropertyId) {
      filters.property_id = resolvedPropertyId;
    } else if (orgId) {
      filters.organization_id = orgId;
    }

    const { data, error } = await (supabase
      .from('tickets')
      .select('status, priority') as any) as { data: unknown[] | null; error: unknown };

    if (error) {
      return { data: null, error: (error as { message: string }).message };
    }

    const byStatus: Record<TicketStatus, number> = {
      open: 0,
      in_progress: 0,
      on_hold: 0,
      resolved: 0,
      closed: 0,
      escalated: 0,
    };

    const byPriority: Record<TicketPriority, number> = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };

    for (const t of (data ?? []) as { status: string; priority: string }[]) {
      if (t.status in byStatus) {
        byStatus[t.status as TicketStatus]++;
      }
      if (t.priority in byPriority) {
        byPriority[t.priority as TicketPriority]++;
      }
    }

    return {
      data: {
        byStatus,
        byPriority,
        total: data?.length ?? 0,
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: null, error: message };
  }
}

