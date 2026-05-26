import { serverApi } from '@/lib/serverApi';
import { ApiResponse } from './api/client';
import type { Visitor, VisitorStatus } from '@/types';

// ---------------------------------------------------------------------------
// Date Filter Helpers
// ---------------------------------------------------------------------------

export type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export interface VisitorLog {
  id: string;
  visitor_id: string;
  name: string;
  mobile?: string;
  category: string;
  whom_to_meet: string;
  coming_from?: string;
  purpose?: string;
  photo_url?: string;
  checkin_time: string;
  checkout_time?: string;
  status: string;
}

export interface HostResult {
  id: string;
  name: string;
  full_name?: string;
  email?: string;
  role?: string;
}

export interface VisitorStats {
  total_today: number;
  checked_in: number;
  checked_out: number;
}

// ---------------------------------------------------------------------------
// VMS Service — routes through saas_mobile_server (aligned with saas_one)
// ---------------------------------------------------------------------------

export const vmsService = {
  // ── Fetch Visitors ────────────────────────────────────────────────────────
  async fetchVisitors(
    propertyId: string,
    options?: {
      dateFilter?: DateFilter;
      customDate?: string;
      status?: VisitorStatus | 'all';
      search?: string;
    }
  ): Promise<ApiResponse<{ visitors: VisitorLog[]; stats: VisitorStats }>> {
    try {
      const params = new URLSearchParams();
      params.append('propertyId', propertyId);
      if (options?.status && options.status !== 'all') params.append('status', options.status);
      if (options?.search) params.append('search', options.search);

      // Pass date filter to server for IST-bound server-side filtering
      if (options?.dateFilter) {
        if (options.dateFilter === 'custom' && options.customDate) {
          params.append('date', options.customDate);
        } else if (options.dateFilter !== 'custom') {
          params.append('date', options.dateFilter);
        }
      }

      const res = await serverApi.get<any>(`/api/visitors?${params.toString()}`);
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch visitors');

      return {
        success: true,
        data: {
          visitors: res.data?.visitors ?? [],
          stats: res.data?.stats ?? { total_today: 0, checked_in: 0, checked_out: 0 },
        },
        status: 200,
      };
    } catch (err: any) {
      return { success: false, data: null as any, error: err.message, status: 500 };
    }
  },

  // ── Fetch Visitor Stats ───────────────────────────────────────────────────
  async fetchStats(propertyId: string): Promise<ApiResponse<VisitorStats>> {
    try {
      const res = await serverApi.get<any>(`/api/visitors?propertyId=${propertyId}`);
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch stats');
      return {
        success: true,
        data: res.data?.stats ?? { total_today: 0, checked_in: 0, checked_out: 0 },
        status: 200,
      };
    } catch (err: any) {
      return { success: false, data: null as any, error: err.message, status: 500 };
    }
  },

  // ── Check In ──────────────────────────────────────────────────────────────
  async checkIn(payload: {
    propertyId: string;
    name: string;
    mobile?: string;
    category: string;
    whom_to_meet: string;
    whom_to_meet_uid?: string;
    coming_from?: string;
    purpose?: string;
    photo_url?: string;
  }): Promise<ApiResponse<{ visitor: Visitor; visitorId: string }>> {
    try {
      const res = await serverApi.post<any>('/api/visitors', {
        propertyId: payload.propertyId,
        name: payload.name,
        mobile: payload.mobile,
        category: payload.category,
        whom_to_meet: payload.whom_to_meet,
        whom_to_meet_uid: payload.whom_to_meet_uid,
        coming_from: payload.coming_from,
        purpose: payload.purpose,
        photo_url: payload.photo_url,
      });
      if (res.error) throw new Error(typeof res.error === 'string' ? res.error : res.error?.message ?? 'Check-in failed');
      return { success: true, data: { visitor: res.data?.visitor, visitorId: res.data?.visitorId }, status: 201 };
    } catch (err: any) {
      return { success: false, data: null as any, error: err.message, status: 500 };
    }
  },

  // ── Check Out ─────────────────────────────────────────────────────────────
  async checkOut(visitorId: string, propertyId: string): Promise<ApiResponse<boolean>> {
    try {
      const res = await serverApi.patch<any>(`/api/visitors/${visitorId}/checkout?propertyId=${propertyId}`, {});
      if (res.error) throw new Error(typeof res.error === 'string' ? res.error : res.error?.message ?? 'Check-out failed');
      return { success: true, data: true, status: 200 };
    } catch (err: any) {
      return { success: false, data: false, error: err.message, status: 500 };
    }
  },

  // ── Force Check Out (admin) ───────────────────────────────────────────────
  async forceCheckout(
    visitorLogId: string,
    propertyId: string,
    reason?: string
  ): Promise<ApiResponse<{ visitor: VisitorLog }>> {
    try {
      const res = await serverApi.post<any>(`/api/visitors/force-checkout?propertyId=${propertyId}`, {
        visitor_log_id: visitorLogId,
        reason,
      });
      if (res.error) throw new Error(typeof res.error === 'string' ? res.error : res.error?.message ?? 'Force checkout failed');
      return { success: true, data: { visitor: res.data?.visitor }, status: 200 };
    } catch (err: any) {
      return { success: false, data: null as any, error: err.message, status: 500 };
    }
  },

  // ── Search Hosts ──────────────────────────────────────────────────────────
  async searchHosts(propertyId: string, query: string): Promise<ApiResponse<HostResult[]>> {
    try {
      const res = await serverApi.get<any>(
        `/api/visitors/hosts?propertyId=${propertyId}&query=${encodeURIComponent(query)}`
      );
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch hosts');

      const hosts = (res.data?.hosts || []).map((h: any) => ({
        id: h.id,
        name: h.full_name || h.name || 'Unknown',
        full_name: h.full_name || h.name || 'Unknown',
        email: h.email || '',
        role: h.role || '',
      }));

      return { success: true, data: hosts, status: 200 };
    } catch (err: any) {
      return { success: false, data: [], error: err.message, status: 500 };
    }
  },

  // ── Upload Photo ──────────────────────────────────────────────────────────
  async uploadPhoto(
    uri: string,
    visitorId: string,
    propertyId: string
  ): Promise<ApiResponse<string>> {
    try {
      const formData = new FormData();
      // React Native file object
      formData.append('file', { uri, name: `${visitorId}.jpg`, type: 'image/jpeg' } as any);
      formData.append('visitor_id', visitorId);

      const res = await serverApi.post<any>(
        `/api/visitors/photos?propertyId=${propertyId}`,
        formData as any
      );
      if (res.error) throw new Error(res.error?.message ?? 'Upload failed');
      return { success: true, data: res.data?.url ?? '', status: 201 };
    } catch (err: any) {
      return { success: false, data: '', error: err.message, status: 500 };
    }
  },
};
