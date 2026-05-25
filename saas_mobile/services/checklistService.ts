import { serverApi } from '@/lib/serverApi';
import { ApiResponse } from './api/client';

// ---------------------------------------------------------------------------
// Types (aligned with saas_one schema)
// ---------------------------------------------------------------------------

export interface SOPTemplate {
  id: string;
  property_id: string;
  organization_id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  frequency: 'daily' | 'weekly' | 'monthly' | 'on_demand' | string;
  assigned_to?: string[] | null;
  is_active: boolean;
  is_running?: boolean;
  start_time?: string | null;
  end_time?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  items?: SOPChecklistItem[];
}

export interface SOPChecklistItem {
  id: string;
  template_id: string;
  title: string;
  description?: string | null;
  order_index: number;
  requires_photo?: boolean;
  requires_comment?: boolean;
  is_mandatory?: boolean;
  type?: 'checkbox' | 'text' | 'number' | 'yes_no';
  is_optional?: boolean;
  start_time?: string | null;
  end_time?: string | null;
  created_at?: string;
}

export interface SOPCompletion {
  id: string;
  template_id: string;
  property_id: string;
  organization_id: string;
  completed_by?: string | null;
  completion_date?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'partial' | 'missed';
  notes?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  due_at?: string | null;
  is_late?: boolean;
  slot_time?: string | null;
  started_at?: string | null;
  template?: SOPTemplate;
  items?: SOPCompletionItem[];
  completed_by_user?: { full_name: string; email: string } | null;
}

export interface SOPCompletionItem {
  id: string;
  completion_id: string;
  checklist_item_id: string;
  is_checked?: boolean;
  photo_url?: string | null;
  video_url?: string | null;
  comment?: string | null;
  checked_at?: string | null;
  value?: string | null;
  checked_by?: string | null;
  updated_at?: string | null;
}

export interface ChecklistFilters {
  propertyId: string;
  templateId?: string;
  completionDate?: string;
  userId?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Checklist Service — routes through saas_mobile_server dedicated APIs
// ---------------------------------------------------------------------------

export const checklistService = {
  // ── Fetch all checklist data for a property ───────────────────────────────
  async fetchChecklistData(propertyId: string) {
    const res = await serverApi.get<any>(`/api/checklist?propertyId=${propertyId}`);
    if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch checklist');
    return res.data;
  },

  // ── Fetch template completions ────────────────────────────────────────────
  async fetchTemplateCompletions(propertyId: string, templateId: string, limit = 50) {
    const res = await serverApi.get<any>(`/api/checklist/template-completions?propertyId=${propertyId}&templateId=${templateId}&limit=${limit}`);
    if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch completions');
    return res.data;
  },

  // ── Create template ───────────────────────────────────────────────────────
  async createTemplate(payload: any) {
    const res = await serverApi.post<any>('/api/checklist/templates', payload);
    if (res.error) throw new Error(res.error?.message ?? 'Failed to create template');
    return res.data;
  },

  // ── Update template ───────────────────────────────────────────────────────
  async updateTemplate(templateId: string, payload: any) {
    const res = await serverApi.patch<any>(`/api/checklist/templates/${templateId}`, payload);
    if (res.error) throw new Error(res.error?.message ?? 'Failed to update template');
    return res.data;
  },

  // ── Soft-delete template ──────────────────────────────────────────────────
  async deleteTemplate(templateId: string) {
    const res = await serverApi.patch<any>(`/api/checklist/templates/${templateId}`, { is_active: false });
    if (res.error) throw new Error(res.error?.message ?? 'Failed to delete template');
    return res.data;
  },

  // ── Start completion ──────────────────────────────────────────────────────
  async startCompletion(payload: any) {
    const res = await serverApi.post<any>('/api/checklist/completions', payload);
    if (res.error) throw new Error(res.error?.message ?? 'Failed to start completion');
    return res.data;
  },

  // ── Update completion ─────────────────────────────────────────────────────
  async updateCompletion(completionId: string, payload: any) {
    const res = await serverApi.patch<any>(`/api/checklist/completions/${completionId}`, payload);
    if (res.error) throw new Error(res.error?.message ?? 'Failed to update completion');
    return res.data;
  },

  // ── Upload media ──────────────────────────────────────────────────────────
  async uploadMedia(formData: FormData) {
    // Media upload uses multipart form — we use the generic storage proxy
    const bucket = formData.get('bucket') as string || 'sop-photos';
    const path = formData.get('path') as string;
    const file = formData.get('file') as File;
    if (!path || !file) throw new Error('Missing file or path');

    const res = await serverApi.upload(bucket, path, file, file.type);
    if (res.error) throw new Error(res.error?.message ?? 'Failed to upload media');

    // Get public URL for the uploaded file
    const urlRes = await serverApi.getPublicUrl(bucket, res.data!.path);
    if (urlRes.error) throw new Error(urlRes.error?.message ?? 'Failed to get public URL');

    return { url: urlRes.data!.publicUrl };
  },

  // ── Delete media ──────────────────────────────────────────────────────────
  async deleteMedia(type: string, url: string, completionId?: string) {
    const res = await serverApi.delete<any>(`/api/checklist/media?type=${type}&url=${encodeURIComponent(url)}&completionId=${completionId ?? ''}`);
    if (res.error) throw new Error(res.error?.message ?? 'Failed to delete media');
    return res.data;
  },
};
