import { serverApi } from '@/lib/serverApi';
import { ApiResponse } from './api/client';
import type { Visitor, VisitorStatus } from '@/types';

// ---------------------------------------------------------------------------
// Date Filter Helpers
// ---------------------------------------------------------------------------

export type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export interface VisitorLog {
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

function getDateBounds(filter: DateFilter, customDate?: string): { start: string; end: string } | null {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  let start: Date;
  let end: Date;

  switch (filter) {
    case 'today':
      start = new Date(year, month, day, 0, 0, 0);
      end = new Date(year, month, day, 23, 59, 59, 999);
      break;
    case 'yesterday':
      start = new Date(year, month, day - 1, 0, 0, 0);
      end = new Date(year, month, day - 1, 23, 59, 59, 999);
      break;
    case 'week':
      start = new Date(year, month, day - 7, 0, 0, 0);
      end = new Date(year, month, day, 23, 59, 59, 999);
      break;
    case 'month':
      start = new Date(year, month, day - 30, 0, 0, 0);
      end = new Date(year, month, day, 23, 59, 59, 999);
      break;
    case 'custom':
      if (!customDate) return null;
      const [cy, cm, cd] = customDate.split('-').map(Number);
      start = new Date(cy, cm - 1, cd, 0, 0, 0);
      end = new Date(cy, cm - 1, cd, 23, 59, 59, 999);
      break;
    default:
      return null;
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

// ---------------------------------------------------------------------------
// VMS Service — routes through saas_mobile_server
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
  ): Promise<ApiResponse<{ visitors: VisitorLog[]; stats: any; property: any }>> {
    try {
      const params = new URLSearchParams();
      params.append('propertyId', propertyId);
      if (options?.status && options.status !== 'all') params.append('status', options.status);
      if (options?.search) params.append('search', options.search);

      const res = await serverApi.get<any>(`/api/visitors?${params.toString()}`);
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch visitors');

      // Apply date filtering client-side since server doesn't support date ranges
      let visitors = res.data?.visitors ?? [];
      if (options?.dateFilter && options.dateFilter !== 'custom') {
        const bounds = getDateBounds(options.dateFilter);
        if (bounds) {
          visitors = visitors.filter((v: any) => {
            const t = v.checkin_time || v.created_at;
            return t && t >= bounds.start && t <= bounds.end;
          });
        }
      } else if (options?.dateFilter === 'custom' && options.customDate) {
        const bounds = getDateBounds('custom', options.customDate);
        if (bounds) {
          visitors = visitors.filter((v: any) => {
            const t = v.checkin_time || v.created_at;
            return t && t >= bounds.start && t <= bounds.end;
          });
        }
      }

      const stats = {
        total: visitors.length,
        checked_in: visitors.filter((v: any) => v.status === 'checked_in').length,
        checked_out: visitors.filter((v: any) => v.status === 'checked_out').length,
        pending: visitors.filter((v: any) => v.status === 'pending').length,
      };

      return { success: true, data: { visitors, stats, property: res.data?.property }, status: 200 };
    } catch (err: any) {
      return { success: false, data: null as any, error: err.message, status: 500 };
    }
  },

  // ── Fetch Visitor Stats ───────────────────────────────────────────────────
  async fetchStats(propertyId: string): Promise<ApiResponse<any>> {
    return this.fetchVisitors(propertyId);
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
      const res = await serverApi.post<any>(`/api/visitors/${visitorId}/checkout`, { propertyId });
      if (res.error) throw new Error(typeof res.error === 'string' ? res.error : res.error?.message ?? 'Check-out failed');
      return { success: true, data: true, status: 200 };
    } catch (err: any) {
      return { success: false, data: false, error: err.message, status: 500 };
    }
  },

  // ── Search Hosts ──────────────────────────────────────────────────────────
  async searchHosts(propertyId: string, query: string): Promise<ApiResponse<HostResult[]>> {
    try {
      const res = await serverApi.query<HostResult[]>({
        table: 'property_memberships',
        action: 'select',
        select: 'user_id, users:user_id(full_name, email, role)',
        filters: [
          { op: 'eq', column: 'property_id', value: propertyId },
          { op: 'eq', column: 'is_active', value: true },
        ],
      });
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch hosts');

      const hosts = (res.data || [])
        .filter((m: any) => {
          const fullName = m.users?.full_name || '';
          const email = m.users?.email || '';
          const q = query.toLowerCase();
          return fullName.toLowerCase().includes(q) || email.toLowerCase().includes(q);
        })
        .map((m: any) => ({
          id: m.user_id,
          name: m.users?.full_name || '',
          full_name: m.users?.full_name || '',
          email: m.users?.email || '',
          role: m.users?.role || '',
        }));

      return { success: true, data: hosts, status: 200 };
    } catch (err: any) {
      return { success: false, data: [], error: err.message, status: 500 };
    }
  },

  // ── Upload Photo ──────────────────────────────────────────────────────────
  async uploadPhoto(uri: string, path: string): Promise<ApiResponse<string>> {
    try {
      // React Native file upload — pass the URI object that FormData can handle
      const fileObj = { uri, name: path, type: 'image/jpeg' };
      const res = await serverApi.upload('visitor-photos', path, fileObj as any, 'image/jpeg');
      if (res.error) throw new Error(res.error?.message ?? 'Upload failed');
      return { success: true, data: res.data?.path ?? '', status: 201 };
    } catch (err: any) {
      return { success: false, data: '', error: err.message, status: 500 };
    }
  },
};
