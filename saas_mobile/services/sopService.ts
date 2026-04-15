import { supabase } from '@/utils/supabase';
import { ApiResponse } from './api/client';
import { getCurrentUserId } from '@/utils/api/mobileApi';
import type { SOP, SOPStep, SOPChecklistRun, StepResult } from '@/types';

export const sopService = {
  // ---------------------------------------------------------------------------
  // SOP Templates
  // ---------------------------------------------------------------------------

  async getSOPs(filters?: {
    propertyId?: string;
    search?: string;
    category?: string;
  }): Promise<ApiResponse<SOP[]>> {
    try {
      let query = (supabase
        .from('sop_templates')
        .select('*')
        .eq('is_active', true) as any);

      if (filters?.propertyId) {
        query = query.eq('property_id', filters.propertyId);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false }) as { data: unknown; error: unknown };

      if (error) throw error;

      const rows = (data ?? []) as Record<string, unknown>[];
      const sops: SOP[] = rows.map((row) => ({
        id: row['id'] as string,
        propertyId: row['property_id'] as string,
        organizationId: row['organization_id'] as string,
        title: row['title'] as string,
        description: row['description'] as string | undefined,
        category: row['category'] as string,
        frequency: row['frequency'] as SOP['frequency'],
        assignedRoles: (row['assigned_roles'] ?? []) as string[],
        qrCode: row['qr_code'] as string | undefined,
        isActive: row['is_active'] as boolean,
        createdAt: row['created_at'] as string,
        updatedAt: row['updated_at'] as string,
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
      const { data: template, error: templateError } = (await (supabase
        .from('sop_templates')
        .select('*')
        .eq('id', id)
        .single() as any)) as { data: unknown; error: unknown };

      if (templateError) throw templateError;

      const { data: stepsData, error: stepsError } = (await (supabase
        .from('sop_checklist_items')
        .select('*')
        .eq('template_id', id)
        .order('order', { ascending: true }) as any)) as { data: unknown; error: unknown };

      if (stepsError) throw stepsError;

      const templateRow = template as Record<string, unknown>;
      const stepsRows = (stepsData ?? []) as Record<string, unknown>[];
      const steps: SOPStep[] = stepsRows.map((row) => ({
        id: row['id'] as string,
        sopId: row['template_id'] as string,
        order: row['order'] as number,
        title: row['title'] as string,
        description: row['description'] as string | undefined,
        requiresPhoto: row['requires_photo'] as boolean,
        requiresSignature: row['requires_signature'] as boolean,
        requiresNote: row['requires_note'] as boolean,
        section: row['section'] as string | undefined,
      }));

      const sop: SOP = {
        id: templateRow['id'] as string,
        propertyId: templateRow['property_id'] as string,
        organizationId: templateRow['organization_id'] as string,
        title: templateRow['title'] as string,
        description: templateRow['description'] as string | undefined,
        category: templateRow['category'] as string,
        frequency: templateRow['frequency'] as SOP['frequency'],
        assignedRoles: (templateRow['assigned_roles'] ?? []) as string[],
        qrCode: templateRow['qr_code'] as string | undefined,
        isActive: templateRow['is_active'] as boolean,
        createdAt: templateRow['created_at'] as string,
        updatedAt: templateRow['updated_at'] as string,
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
      const payload = {
        property_id: data.propertyId,
        organization_id: data.organizationId,
        title: data.title,
        description: data.description,
        category: data.category,
        frequency: data.frequency,
        assigned_roles: data.assignedRoles ?? [],
        qr_code: data.qrCode,
        is_active: data.isActive ?? true,
      };

      const { data: created, error }: any = await (supabase as any)
        .from('sop_templates')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      const row = created as Record<string, unknown>;
      const sop: SOP = {
        id: row['id'] as string,
        propertyId: row['property_id'] as string,
        organizationId: row['organization_id'] as string,
        title: row['title'] as string,
        description: row['description'] as string | undefined,
        category: row['category'] as string,
        frequency: row['frequency'] as SOP['frequency'],
        assignedRoles: (row['assigned_roles'] ?? []) as string[],
        qrCode: row['qr_code'] as string | undefined,
        isActive: row['is_active'] as boolean,
        createdAt: row['created_at'] as string,
        updatedAt: row['updated_at'] as string,
        steps: [],
      };

      return { data: sop, error: null };
    } catch (err) {
      console.error('sopService.createSOP error:', err);
      return { data: null, error: err as Error | string | null };
    }
  },

  async updateSOP(id: string, data: Partial<SOP>): Promise<ApiResponse<SOP>> {
    try {
      const payload: Record<string, unknown> = {};
      if (data.title !== undefined) payload.title = data.title;
      if (data.description !== undefined) payload.description = data.description;
      if (data.category !== undefined) payload.category = data.category;
      if (data.frequency !== undefined) payload.frequency = data.frequency;
      if (data.assignedRoles !== undefined) payload.assigned_roles = data.assignedRoles;
      if (data.qrCode !== undefined) payload.qr_code = data.qrCode;
      if (data.isActive !== undefined) payload.is_active = data.isActive;

      const { data: updated, error }: any = await (supabase as any)
        .from('sop_templates')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const row = updated as Record<string, unknown>;
      const sop: SOP = {
        id: row['id'] as string,
        propertyId: row['property_id'] as string,
        organizationId: row['organization_id'] as string,
        title: row['title'] as string,
        description: row['description'] as string | undefined,
        category: row['category'] as string,
        frequency: row['frequency'] as SOP['frequency'],
        assignedRoles: (row['assigned_roles'] ?? []) as string[],
        qrCode: row['qr_code'] as string | undefined,
        isActive: row['is_active'] as boolean,
        createdAt: row['created_at'] as string,
        updatedAt: row['updated_at'] as string,
        steps: [],
      };

      return { data: sop, error: null };
    } catch (err) {
      console.error('sopService.updateSOP error:', err);
      return { data: null, error: err as Error | string | null };
    }
  },

  async deleteSOP(id: string): Promise<ApiResponse<void>> {
    try {
      const { error }: any = await (supabase as any)
        .from('sop_templates')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      return { data: undefined, error: null };
    } catch (err) {
      console.error('sopService.deleteSOP error:', err);
      return { data: null, error: err as Error | string | null };
    }
  },

  // ---------------------------------------------------------------------------
  // Checklist Runs
  // ---------------------------------------------------------------------------

  async startChecklistRun(
    templateId: string,
    propertyId: string,
  ): Promise<ApiResponse<SOPChecklistRun>> {
    try {
      // Use session-first helper to avoid null returns on Expo Go.
      const startedBy = await getCurrentUserId();

      const { data: run, error }: any = await (supabase as any)
        .from('sop_completions')
        .insert({
          template_id: templateId,
          property_id: propertyId,
          started_by: startedBy,
          started_at: new Date().toISOString(),
          status: 'in_progress',
        })
        .select()
        .single();

      if (error) throw error;

      const row = run as Record<string, unknown>;
      const checklistRun: SOPChecklistRun = {
        id: row['id'] as string,
        sopId: row['template_id'] as string,
        propertyId: row['property_id'] as string,
        startedBy: row['started_by'] as string,
        startedAt: row['started_at'] as string,
        completedAt: row['completed_at'] as string | undefined,
        status: row['status'] as SOPChecklistRun['status'],
        notes: row['notes'] as string | undefined,
        createdAt: row['created_at'] as string | undefined,
      };

      return { data: checklistRun, error: null };
    } catch (err) {
      console.error('sopService.startChecklistRun error:', err);
      return { data: null, error: err as Error | string | null };
    }
  },

  async completeStep(
    runId: string,
    stepId: string,
    result: StepResult,
  ): Promise<ApiResponse<StepResult>> {
    try {
      const payload = {
        completion_id: runId,
        step_id: stepId,
        completed: result.completed,
        photo_url: result.photoUrl ?? null,
        signature_data: result.signatureData ?? null,
        note: result.note ?? null,
        timestamp: new Date().toISOString(),
      };

      const { data: existing } = (await (supabase
        .from('sop_step_results')
        .select('id')
        .eq('completion_id', runId)
        .eq('step_id', stepId)
        .maybeSingle() as any)) as { data: unknown; error: unknown };

      let upserted: Record<string, unknown>;
      if (existing) {
        const { data, error }: any = await (supabase as any)
          .from('sop_step_results')
          .update(payload)
          .eq('id', (existing as Record<string, unknown>)['id'] as string)
          .select()
          .single();
        if (error) throw error;
        upserted = data as Record<string, unknown>;
      } else {
        const { data, error }: any = await (supabase as any)
          .from('sop_step_results')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        upserted = data as Record<string, unknown>;
      }

      const stepResult: StepResult = {
        id: upserted['id'] as string,
        completionId: upserted['completion_id'] as string,
        stepId: upserted['step_id'] as string,
        completed: upserted['completed'] as boolean,
        photoUrl: upserted['photo_url'] as string | undefined,
        signatureData: upserted['signature_data'] as string | undefined,
        note: upserted['note'] as string | undefined,
        timestamp: upserted['timestamp'] as string,
      };

      return { data: stepResult, error: null };
    } catch (err) {
      console.error('sopService.completeStep error:', err);
      return { data: null, error: err as Error | string | null };
    }
  },

  async completeChecklistRun(
    runId: string,
    rating?: number,
  ): Promise<ApiResponse<SOPChecklistRun>> {
    try {
      const { data: run, error }: any = await (supabase as any)
        .from('sop_completions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          rating: rating ?? null,
        })
        .eq('id', runId)
        .select()
        .single();

      if (error) throw error;

      const row = run as Record<string, unknown>;
      const checklistRun: SOPChecklistRun = {
        id: row['id'] as string,
        sopId: row['template_id'] as string,
        propertyId: row['property_id'] as string,
        startedBy: row['started_by'] as string,
        startedAt: row['started_at'] as string,
        completedAt: row['completed_at'] as string | undefined,
        status: row['status'] as SOPChecklistRun['status'],
        notes: row['notes'] as string | undefined,
        createdAt: row['created_at'] as string | undefined,
      };

      return { data: checklistRun, error: null };
    } catch (err) {
      console.error('sopService.completeChecklistRun error:', err);
      return { data: null, error: err as Error | string | null };
    }
  },

  async abandonChecklistRun(runId: string): Promise<ApiResponse<SOPChecklistRun>> {
    try {
      const { data: run, error }: any = await (supabase as any)
        .from('sop_completions')
        .update({
          status: 'abandoned',
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId)
        .select()
        .single();

      if (error) throw error;

      const row = run as Record<string, unknown>;
      const checklistRun: SOPChecklistRun = {
        id: row['id'] as string,
        sopId: row['template_id'] as string,
        propertyId: row['property_id'] as string,
        startedBy: row['started_by'] as string,
        startedAt: row['started_at'] as string,
        completedAt: row['completed_at'] as string | undefined,
        status: row['status'] as SOPChecklistRun['status'],
        notes: row['notes'] as string | undefined,
        createdAt: row['created_at'] as string | undefined,
      };

      return { data: checklistRun, error: null };
    } catch (err) {
      console.error('sopService.abandonChecklistRun error:', err);
      return { data: null, error: err as Error | string | null };
    }
  },

  async getChecklistRunHistory(
    templateId: string,
  ): Promise<ApiResponse<SOPChecklistRun[]>> {
    try {
      const { data: runs, error } = (await (supabase
        .from('sop_completions')
        .select(`
          *,
          sop_step_results (*)
        `)
        .eq('template_id', templateId)
        .order('started_at', { ascending: false }) as any)) as { data: unknown; error: unknown };

      if (error) throw error;

      const runRows = (runs ?? []) as Record<string, unknown>[];
      const checklistRuns: SOPChecklistRun[] = runRows.map((run) => {
        return {
          id: run['id'] as string,
          sopId: run['template_id'] as string,
          propertyId: run['property_id'] as string,
          startedBy: run['started_by'] as string,
          startedAt: run['started_at'] as string,
          completedAt: run['completed_at'] as string | undefined,
          status: run['status'] as SOPChecklistRun['status'],
          notes: run['notes'] as string | undefined,
          createdAt: run['created_at'] as string | undefined,
        };
      });

      return { data: checklistRuns, error: null };
    } catch (err) {
      console.error('sopService.getChecklistRunHistory error:', err);
      return { data: [], error: err as Error | string | null };
    }
  },
};
