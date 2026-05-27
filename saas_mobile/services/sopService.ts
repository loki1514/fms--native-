import { serverApi } from '@/lib/serverApi';
import { ApiResponse } from './api/client';
import { getCurrentUserId } from '@/utils/api/mobileApi';
import type { SOP, SOPStep, SOPChecklistRun, StepResult } from '@/types';

export const sopService = {
  // ---------------------------------------------------------------------------
  // SOP Templates
  // ---------------------------------------------------------------------------

  async getSOPs(filters?: { propertyId?: string; search?: string; category?: string }): Promise<ApiResponse<SOP[]>> {
    try {
      const params = new URLSearchParams();
      if (filters?.propertyId) params.append('propertyId', filters.propertyId);
      if (filters?.category) params.append('category', filters.category);
      if (filters?.search) params.append('search', filters.search);

      const res = await serverApi.get<any>(`/api/sop?${params.toString()}`);
      if (res.error) throw new Error(res.error.message || 'Unknown error');

      const sops: SOP[] = (res.data?.sops ?? []).map((row: any) => ({
        id: row.id as string,
        propertyId: row.property_id as string,
        organizationId: row.organization_id as string,
        title: row.title as string,
        description: row.description as string | undefined,
        category: row.category as string,
        frequency: row.frequency as SOP['frequency'],
        assignedRoles: (row.assigned_to ?? []) as string[],
        isActive: row.is_active as boolean,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        steps: [],
      }));

      return { data: sops, error: null };
    } catch (err) {
      console.error('sopService.getSOPs error:', err);
      return { data: [], error: err as Error | string | null };
    }
  },

  async getSOP(id: string): Promise<ApiResponse<SOP>> {
    try {
      const res = await serverApi.get<any>(`/api/sop/${id}`);
      if (res.error) throw new Error(res.error.message || 'Unknown error');

      const template = res.data?.sop;
      const stepsRaw = res.data?.steps ?? [];

      const steps: SOPStep[] = stepsRaw.map((row: any) => ({
        id: row.id as string,
        sopId: row.template_id as string,
        order: row.order_index as number,
        title: row.title as string,
        description: row.description as string | undefined,
        requiresPhoto: row.requires_photo as boolean,
        requiresSignature: false,
        requiresNote: false,
        section: undefined,
      }));

      const row = template as Record<string, unknown>;
      const sop: SOP = {
        id: row.id as string,
        propertyId: row.property_id as string,
        organizationId: row.organization_id as string,
        title: row.title as string,
        description: row.description as string | undefined,
        category: row.category as string,
        frequency: row.frequency as SOP['frequency'],
        assignedRoles: (row.assigned_to ?? []) as string[],
        isActive: row.is_active as boolean,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        steps,
      };

      return { data: sop, error: null };
    } catch (err) {
      console.error('sopService.getSOP error:', err);
      return { data: null, error: err as Error | string | null };
    }
  },

  async createSOP(data: Partial<SOP>): Promise<ApiResponse<SOP>> {
    try {
      const res = await serverApi.post<any>('/api/sop', data);
      if (res.error) throw new Error(res.error.message || 'Unknown error');

      const row = res.data?.sop as Record<string, unknown>;
      return { data: { id: row.id as string, propertyId: row.property_id as string, organizationId: row.organization_id as string, title: row.title as string, description: row.description as string | undefined, category: row.category as string, frequency: row.frequency as SOP['frequency'], assignedRoles: (row.assigned_to ?? []) as string[], isActive: row.is_active as boolean, createdAt: row.created_at as string, updatedAt: row.updated_at as string, steps: [] } as SOP, error: null };
    } catch (err) {
      console.error('sopService.createSOP error:', err);
      return { data: null, error: err as Error | string | null };
    }
  },

  async updateSOP(id: string, data: Partial<SOP>): Promise<ApiResponse<SOP>> {
    try {
      const res = await serverApi.patch<any>(`/api/sop/${id}`, data);
      if (res.error) throw new Error(res.error.message || 'Unknown error');

      const row = res.data?.sop as Record<string, unknown>;
      return { data: { id: row.id as string, propertyId: row.property_id as string, organizationId: row.organization_id as string, title: row.title as string, description: row.description as string | undefined, category: row.category as string, frequency: row.frequency as SOP['frequency'], assignedRoles: (row.assigned_to ?? []) as string[], isActive: row.is_active as boolean, createdAt: row.created_at as string, updatedAt: row.updated_at as string, steps: [] } as SOP, error: null };
    } catch (err) {
      console.error('sopService.updateSOP error:', err);
      return { data: null, error: err as Error | string | null };
    }
  },

  async deleteSOP(id: string): Promise<ApiResponse<void>> {
    try {
      const res = await serverApi.delete<any>(`/api/sop/${id}`);
      if (res.error) throw new Error(res.error.message || 'Unknown error');
      return { data: undefined, error: null };
    } catch (err) {
      console.error('sopService.deleteSOP error:', err);
      return { data: null, error: err as Error | string | null };
    }
  },

  // ---------------------------------------------------------------------------
  // Checklist Runs
  // ---------------------------------------------------------------------------

  async startChecklistRun(templateId: string, propertyId: string): Promise<ApiResponse<SOPChecklistRun>> {
    try {
      const res = await serverApi.post<any>('/api/sop/runs', { templateId, propertyId });
      if (res.error) throw new Error(res.error.message || 'Unknown error');

      const row = res.data?.run as Record<string, unknown>;
      return { data: { id: row.id as string, sopId: row.template_id as string, propertyId: row.property_id as string, startedBy: undefined as any, startedAt: undefined as any, completedAt: row.completed_at as string | undefined, status: row.status as SOPChecklistRun['status'], createdAt: row.created_at as string | undefined } as SOPChecklistRun, error: null };
    } catch (err) {
      console.error('sopService.startChecklistRun error:', err);
      return { data: null, error: err as Error | string | null };
    }
  },

  async completeStep(_runId: string, _stepId: string, _result: StepResult): Promise<ApiResponse<StepResult>> {
    return { data: null, error: 'sop_step_results table does not exist' };
  },

  async completeChecklistRun(runId: string): Promise<ApiResponse<SOPChecklistRun>> {
    try {
      const res = await serverApi.patch<any>(`/api/sop/runs/${runId}`, { status: 'completed' });
      if (res.error) throw new Error(res.error.message || 'Unknown error');

      const row = res.data?.run as Record<string, unknown>;
      return { data: { id: row.id as string, sopId: row.template_id as string, propertyId: row.property_id as string, startedBy: undefined as any, startedAt: undefined as any, completedAt: row.completed_at as string | undefined, status: row.status as SOPChecklistRun['status'], createdAt: row.created_at as string | undefined } as SOPChecklistRun, error: null };
    } catch (err) {
      console.error('sopService.completeChecklistRun error:', err);
      return { data: null, error: err as Error | string | null };
    }
  },

  async abandonChecklistRun(runId: string): Promise<ApiResponse<SOPChecklistRun>> {
    try {
      const res = await serverApi.patch<any>(`/api/sop/runs/${runId}`, { status: 'abandoned' });
      if (res.error) throw new Error(res.error.message || 'Unknown error');

      const row = res.data?.run as Record<string, unknown>;
      return { data: { id: row.id as string, sopId: row.template_id as string, propertyId: row.property_id as string, startedBy: undefined as any, startedAt: undefined as any, completedAt: row.completed_at as string | undefined, status: row.status as SOPChecklistRun['status'], createdAt: row.created_at as string | undefined } as SOPChecklistRun, error: null };
    } catch (err) {
      console.error('sopService.abandonChecklistRun error:', err);
      return { data: null, error: err as Error | string | null };
    }
  },

  async getChecklistRunHistory(templateId: string): Promise<ApiResponse<SOPChecklistRun[]>> {
    try {
      const res = await serverApi.get<any>(`/api/sop/${templateId}/runs`);
      if (res.error) throw new Error(res.error.message || 'Unknown error');

      const runs: SOPChecklistRun[] = (res.data?.runs ?? []).map((row: any) => ({
        id: row.id as string,
        sopId: row.template_id as string,
        propertyId: row.property_id as string,
        startedBy: undefined as any,
        startedAt: undefined as any,
        completedAt: row.completed_at as string | undefined,
        status: row.status as SOPChecklistRun['status'],
        createdAt: row.created_at as string | undefined,
      }));

      return { data: runs, error: null };
    } catch (err) {
      console.error('sopService.getChecklistRunHistory error:', err);
      return { data: [], error: err as Error | string | null };
    }
  },
};
