import { serverApi } from '@/lib/serverApi';
import { ApiResponse } from './api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MaintenanceVendor {
  id: string;
  company_name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  specialization?: string[];
  is_active?: boolean;
}

export interface PPMSchedule {
  id: string;
  organization_id?: string | null;
  property_id?: string | null;
  si_no?: string;
  system_name: string;
  detail_name?: string;
  scope_of_work?: string;
  frequency: string;
  location?: string;
  maker?: string;
  checker?: string;
  vendor_name?: string;
  vendor_phone?: string;
  vendor_contact_person?: string;
  vendor_id?: string;
  planned_date: string;
  done_date?: string;
  remark?: string;
  status: 'pending' | 'done' | 'postponed' | 'skipped';
  completion_photos?: string[] | null;
  completion_doc_url?: string | null;
  invoice_url?: string | null;
  verification_status?: 'pending' | 'submitted' | 'verified' | 'rejected';
  verified_by?: string | null;
  verified_at?: string | null;
  rejection_reason?: string | null;
  attachments?: {
    photos?: string[];
    certificate?: string;
    invoice?: string;
    completed_by?: string;
    completed_by_name?: string;
    completed_at?: string;
  } | null;
  completed_by?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  maintenance_vendors?: MaintenanceVendor | null;
}

export interface AMCContract {
  id: string;
  organization_id: string;
  property_id: string | null;
  system_name: string;
  vendor_name: string;
  vendor_contact: string | null;
  contract_start_date: string;
  contract_end_date: string;
  contract_value: number | null;
  payment_terms: string | null;
  scope_of_work: string | null;
  notes: string | null;
  status: 'active' | 'expired' | 'expiring_soon' | 'renewed';
  created_at: string;
}

export interface PPMStats {
  total: number;
  done: number;
  pending: number;
  postponed: number;
  skipped: number;
  overdue: number;
}

export interface PPMUpdatePayload {
  id: string;
  status: 'pending' | 'done' | 'postponed' | 'skipped';
  done_date?: string;
  remark?: string;
  verification_status?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeDate(value?: string | null): string {
  if (!value) return '';
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return '';
}

function normalizeFrequency(value?: string | null): string {
  const normalized = (value ?? '').toLowerCase().trim();
  if (normalized === 'annual') return 'yearly';
  if (['yearly', 'quarterly', 'monthly', 'weekly'].includes(normalized)) return normalized;
  return 'monthly';
}

function normalizeStatus(value?: string | null): PPMSchedule['status'] {
  const normalized = (value ?? '').toLowerCase().trim();
  if (normalized === 'completed') return 'done';
  if (['pending', 'done', 'postponed', 'skipped'].includes(normalized)) return normalized as PPMSchedule['status'];
  return 'pending';
}

function normalizeSchedule(row: any): PPMSchedule {
  return {
    ...row,
    organization_id: row.organization_id ?? null,
    property_id: row.property_id ?? null,
    system_name: row.system_name ?? row.asset_name ?? row.detail_name ?? 'PPM Task',
    detail_name: row.detail_name ?? row.description ?? null,
    scope_of_work: row.scope_of_work ?? row.description ?? null,
    frequency: normalizeFrequency(row.frequency ?? row.schedule_type),
    planned_date: normalizeDate(row.planned_date ?? row.next_due),
    done_date: normalizeDate(row.done_date ?? row.last_completed) || undefined,
    status: normalizeStatus(row.status),
  };
}

function daysUntil(dateStr: string): number {
  const normalized = normalizeDate(dateStr);
  if (!normalized) return 999;
  const target = new Date(normalized + 'T12:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function computeAMCStatus(endDate: string): AMCContract['status'] {
  const days = daysUntil(endDate);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring_soon';
  return 'active';
}

// ---------------------------------------------------------------------------
// PPM Service — routes through saas_mobile_server
// ---------------------------------------------------------------------------

export const ppmService = {
  // ── Fetch Schedules ───────────────────────────────────────────────────────
  async fetchSchedules(propertyId: string): Promise<ApiResponse<PPMSchedule[]>> {
    try {
      if (__DEV__) console.log('[PPM] fetchSchedules start, propertyId:', propertyId);
      const res = await serverApi.get<any>(`/api/ppm?propertyId=${propertyId}`);
      if (__DEV__) console.log('[PPM] fetchSchedules raw response:', JSON.stringify({ data: res.data, error: res.error }));
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch PPM');
      const schedules = (res.data?.schedules ?? []).map(normalizeSchedule).filter((s: PPMSchedule) => s.planned_date);
      if (__DEV__) console.log('[PPM] fetchSchedules parsed:', schedules.length, 'schedules');
      return { success: true, data: schedules, status: 200 };
    } catch (err: any) {
      console.error('[PPM] fetchSchedules error:', err);
      return { success: false, data: [], error: err.message, status: 500 };
    }
  },

  // ── Fetch AMC Contracts ───────────────────────────────────────────────────
  async fetchContracts(propertyId: string): Promise<ApiResponse<AMCContract[]>> {
    try {
      const res = await serverApi.get<any>(`/api/ppm/contracts?propertyId=${propertyId}`);
      if (res.error) throw new Error(res.error.message || 'Unknown error');
      const contracts = (res.data?.contracts ?? []).map((c: any) => ({ ...c, status: computeAMCStatus(c.contract_end_date) }));
      return { success: true, data: contracts, status: 200 };
    } catch (err: any) {
      console.error('ppmService.fetchContracts:', err);
      return { success: false, data: [], error: err.message, status: 500 };
    }
  },

  // ── Fetch Stats ───────────────────────────────────────────────────────────
  async fetchStats(propertyId: string): Promise<ApiResponse<PPMStats>> {
    try {
      if (__DEV__) console.log('[PPM] fetchStats start, propertyId:', propertyId);
      const res = await serverApi.get<any>(`/api/ppm/stats?propertyId=${propertyId}`);
      if (__DEV__) console.log('[PPM] fetchStats raw response:', JSON.stringify({ data: res.data, error: res.error }));
      if (res.error) throw new Error(res.error.message || 'Unknown error');
      return { success: true, data: res.data?.stats as PPMStats, status: 200 };
    } catch (err: any) {
      console.error('[PPM] fetchStats error:', err);
      return { success: false, data: { total: 0, done: 0, pending: 0, postponed: 0, skipped: 0, overdue: 0 }, error: err.message, status: 500 };
    }
  },

  // ── Lookup Asset (for scanner) ────────────────────────────────────────────
  async lookupAsset(propertyId: string, searchTerm: string): Promise<ApiResponse<PPMSchedule[]>> {
    try {
      const res = await serverApi.get<any>(`/api/ppm/search?propertyId=${propertyId}&q=${encodeURIComponent(searchTerm)}`);
      if (res.error) throw new Error(res.error.message || 'Unknown error');
      return { success: true, data: (res.data?.schedules ?? []).map(normalizeSchedule), status: 200 };
    } catch (err: any) {
      console.error('ppmService.lookupAsset:', err);
      return { success: false, data: [], error: err.message, status: 500 };
    }
  },

  // ── Update Schedule Status ────────────────────────────────────────────────
  async updateSchedule(payload: PPMUpdatePayload, currentUserId: string): Promise<ApiResponse<PPMSchedule>> {
    try {
      const res = await serverApi.post<any>('/api/ppm/status', {
        scheduleId: payload.id,
        status: payload.status,
        done_date: payload.done_date,
        remark: payload.remark,
        verification_status: payload.verification_status,
        updatedBy: currentUserId,
      });
      if (res.error) throw new Error(typeof res.error === 'string' ? res.error : res.error?.message ?? 'Update failed');
      return { success: true, data: normalizeSchedule(res.data?.schedule ?? res.data), status: 200 };
    } catch (err: any) {
      console.error('ppmService.updateSchedule:', err);
      return { success: false, data: null as any, error: err.message, status: 500 };
    }
  },

  // ── Create Schedule ───────────────────────────────────────────────────────
  async createSchedule(payload: {
    organization_id?: string | null;
    property_id?: string | null;
    system_name: string;
    detail_name?: string | null;
    scope_of_work?: string | null;
    frequency?: string;
    location?: string | null;
    vendor_name?: string | null;
    vendor_phone?: string | null;
    vendor_contact_person?: string | null;
    planned_date: string;
    status?: string;
    remark?: string | null;
  }): Promise<ApiResponse<PPMSchedule>> {
    try {
      const res = await serverApi.post<any>('/api/ppm', {
        organization_id: payload.organization_id,
        property_id: payload.property_id,
        system_name: payload.system_name?.trim(),
        detail_name: payload.detail_name?.trim() || null,
        scope_of_work: payload.scope_of_work?.trim() || null,
        frequency: payload.frequency || 'monthly',
        location: payload.location?.trim() || null,
        vendor_name: payload.vendor_name?.trim() || null,
        vendor_phone: payload.vendor_phone?.trim() || null,
        vendor_contact_person: payload.vendor_contact_person?.trim() || null,
        planned_date: payload.planned_date,
        status: payload.status || 'pending',
        remark: payload.remark || null,
      });
      if (res.error) throw new Error(typeof res.error === 'string' ? res.error : res.error?.message ?? 'Create failed');
      return { success: true, data: normalizeSchedule(res.data?.schedule ?? res.data), status: 201 };
    } catch (err: any) {
      console.error('ppmService.createSchedule:', err);
      return { success: false, data: null as any, error: err.message, status: 500 };
    }
  },

  // ── Upload Attachment ─────────────────────────────────────────────────────
  async uploadAttachment(propertyId: string, scheduleId: string, uri: string, type: 'photo' | 'certificate' | 'invoice'): Promise<ApiResponse<string>> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = uri.split('.').pop() || 'jpg';
      const path = `${propertyId}/${scheduleId}/${type}-${Date.now()}.${ext}`;

      const uploadRes = await serverApi.upload('ppm-attachments', path, blob, ext === 'webp' ? 'image/webp' : 'image/jpeg');
      if (uploadRes.error) throw new Error(uploadRes.error?.message ?? 'Upload failed');

      const urlRes = await serverApi.getPublicUrl('ppm-attachments', path);
      const publicUrl = urlRes.data?.publicUrl || '';

      const existingRes = await serverApi.get<any>(`/api/ppm?propertyId=${propertyId}`);
      const schedules = existingRes.data?.schedules ?? [];
      const existing = schedules.find((s: any) => s.id === scheduleId) ?? {};
      const attachments = existing.attachments || {};
      const updates: any = { attachments: { ...attachments } };

      if (type === 'photo') {
        updates.attachments.photos = [...(attachments.photos || []), publicUrl];
        updates.completion_photos = [...(existing.completion_photos || []), publicUrl];
      } else if (type === 'certificate') {
        updates.attachments.certificate = publicUrl;
        updates.completion_doc_url = publicUrl;
      } else if (type === 'invoice') {
        updates.attachments.invoice = publicUrl;
        updates.invoice_url = publicUrl;
      }

      await serverApi.patch(`/api/ppm/${scheduleId}/attachments`, updates);

      return { success: true, data: publicUrl, status: 200 };
    } catch (err: any) {
      console.error('ppmService.uploadAttachment:', err);
      return { success: false, data: '', error: err.message, status: 500 };
    }
  },

  // ── Delete Attachment ─────────────────────────────────────────────────────
  async deleteAttachment(scheduleId: string, url: string, type: 'photo' | 'certificate' | 'invoice'): Promise<ApiResponse<boolean>> {
    try {
      const pathMatch = url.match(/ppm-attachments\/(.+)$/);
      const path = pathMatch ? pathMatch[1] : null;
      if (path) await serverApi.removeFile('ppm-attachments', path);

      // Wait, deleteAttachment doesn't have propertyId, we might need to get it or fetch the specific schedule first.
      // But we can just use the schedule endpoint via GET without propertyId or require it?
      // Since it's a PATCH to an id, the backend checks auth and applies the change.
      // To get the existing attachments, we should fetch the specific schedule.
      // Actually we'll just get the existing by calling the API if possible.
      // Since we don't have propertyId passed to deleteAttachment easily here without changing signature,
      // and we just need existing attachments, let's let the backend handle the fetch and update!
      // But wait, the logic requires fetching existing attachments to filter them out.
      
      const updates: any = {};
      if (type === 'photo') {
        // This is a bit tricky, the safest way is passing the URL to delete to the backend, 
        // but since we must maintain the same signature, let's just use serverApi.query just for reading if we have to, 
        // OR better yet, fetch the specific schedule through serverApi.query since it's just a select.
      }
      
      const existingRes = await serverApi.query<any>({
        table: 'ppm_schedules',
        action: 'select',
        select: 'attachments, completion_photos, completion_doc_url, invoice_url',
        filters: [{ op: 'eq', column: 'id', value: scheduleId }],
        single: true,
      });
      const existing = existingRes.data ?? {};
      const attachments = existing.attachments || {};
      const actualUpdates: any = { attachments: { ...attachments } };

      if (type === 'photo') {
        actualUpdates.attachments.photos = (attachments.photos || []).filter((u: string) => u !== url);
        actualUpdates.completion_photos = (existing.completion_photos || []).filter((u: string) => u !== url);
      } else if (type === 'certificate') {
        actualUpdates.attachments.certificate = null;
        actualUpdates.completion_doc_url = null;
      } else if (type === 'invoice') {
        actualUpdates.attachments.invoice = null;
        actualUpdates.invoice_url = null;
      }

      await serverApi.patch(`/api/ppm/${scheduleId}/attachments`, actualUpdates);

      return { success: true, data: true, status: 200 };
    } catch (err: any) {
      console.error('ppmService.deleteAttachment:', err);
      return { success: false, data: false, error: err.message, status: 500 };
    }
  },

  // ── Fetch Maintenance Vendors ─────────────────────────────────────────────
  async fetchVendors(_propertyId: string): Promise<ApiResponse<MaintenanceVendor[]>> {
    try {
      const res = await serverApi.get<any>('/api/ppm/vendors');
      if (res.error) throw new Error(res.error.message || 'Unknown error');
      return { success: true, data: res.data?.vendors ?? [], status: 200 };
    } catch (err: any) {
      console.error('ppmService.fetchVendors:', err);
      return { success: false, data: [], error: err.message, status: 500 };
    }
  },
};
