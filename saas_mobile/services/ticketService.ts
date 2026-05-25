// ============================================
// Ticket Service — routes through saas_mobile_server
// ============================================

import { serverApi } from '@/lib/serverApi';
import { apiClient, ApiResponse } from './api/client';
import { supabase } from '@/utils/supabase/client';
import { Ticket, TicketStatus, TicketPriority, TicketComment } from '@/types';

export interface CreateTicketData {
  title: string;
  description?: string;
  category: string;
  subcategory?: string;
  priority: TicketPriority;
  propertyId: string;
  organizationId: string;
  assignedTo?: string;
}

export interface UpdateTicketData {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedTo?: string;
  category?: string;
  subcategory?: string;
}

export interface TicketFilters {
  status?: TicketStatus | TicketStatus[];
  priority?: TicketPriority | TicketPriority[];
  assignedTo?: string;
  createdBy?: string;
  propertyId?: string;
  organizationId?: string;
  category?: string;
}

export const ticketService = {
  // Get all tickets with filters (uses dedicated /api/tickets)
  async getTickets(
    filters?: TicketFilters,
    options?: {
      orderBy?: string;
      ascending?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<ApiResponse<Ticket[]>> {
    try {
      const params = new URLSearchParams();
      if (filters?.propertyId) params.append('propertyId', filters.propertyId);
      if (filters?.organizationId) params.append('organizationId', filters.organizationId);
      if (filters?.assignedTo) params.append('assignedTo', filters.assignedTo);
      if (filters?.createdBy) params.append('raisedBy', filters.createdBy);
      if (filters?.status) {
        const statusValue = Array.isArray(filters.status) ? filters.status.join(',') : filters.status;
        params.append('status', statusValue);
      }
      if (options?.limit) params.append('limit', String(options.limit));
      if (options?.offset) params.append('offset', String(options.offset));

      const res = await serverApi.get<any>(`/api/tickets?${params.toString()}`);
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch tickets');
      return { data: res.data?.tickets ?? [], error: null, status: 200 };
    } catch (error) {
      return { data: null, error: error as Error, status: 500 };
    }
  },

  // Get single ticket
  async getTicket(id: string): Promise<ApiResponse<Ticket>> {
    return apiClient.get<Ticket>('tickets', {
      select: '*, raised_by_user:raised_by(full_name), assigned_to_user:assigned_to(full_name), comments:ticket_comments(*)',
      filters: { id },
      single: true,
    });
  },

  // Create ticket (uses dedicated /api/tickets with AI classification)
  async createTicket(data: CreateTicketData): Promise<ApiResponse<Ticket>> {
    try {
      const res = await serverApi.post<any>('/api/tickets', {
        title: data.title,
        description: data.description,
        category_id: data.category,
        subcategory: data.subcategory,
        priority: data.priority,
        property_id: data.propertyId,
        organization_id: data.organizationId,
        assigned_to: data.assignedTo,
      });
      if (res.error) throw new Error(typeof res.error === 'string' ? res.error : res.error?.message ?? 'Failed to create ticket');
      return { data: res.data?.ticket ?? null, error: null, status: 201 };
    } catch (error) {
      return { data: null, error: error as Error, status: 500 };
    }
  },

  // Update ticket
  async updateTicket(id: string, data: UpdateTicketData): Promise<ApiResponse<Ticket>> {
    const updateData: Record<string, any> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.assignedTo !== undefined) updateData.assigned_to = data.assignedTo;
    if (data.category !== undefined) updateData.category_id = data.category;
    if (data.subcategory !== undefined) updateData.subcategory = data.subcategory;
    updateData.updated_at = new Date().toISOString();
    if (data.status === 'resolved') updateData.resolved_at = new Date().toISOString();

    return apiClient.put<Ticket>('tickets', id, updateData);
  },

  // Delete ticket
  async deleteTicket(id: string): Promise<ApiResponse<Ticket>> {
    return apiClient.delete<Ticket>('tickets', id);
  },

  // Assign ticket
  async assignTicket(id: string, assignedTo: string): Promise<ApiResponse<Ticket>> {
    return this.updateTicket(id, { assignedTo });
  },

  // Update ticket status
  async updateStatus(id: string, status: TicketStatus): Promise<ApiResponse<Ticket>> {
    return this.updateTicket(id, { status });
  },

  // Bulk assign tickets
  async bulkAssign(ticketIds: string[], assignedTo: string): Promise<ApiResponse<void>> {
    try {
      const res = await serverApi.query({
        table: 'tickets',
        action: 'update',
        values: { assigned_to: assignedTo, updated_at: new Date().toISOString() },
        filters: [{ op: 'in', column: 'id', values: ticketIds }],
      });
      if (res.error) throw new Error(res.error?.message ?? 'Bulk assign failed');
      return { data: null, error: null, status: 200 };
    } catch (error) {
      return { data: null, error: error as Error, status: 500 };
    }
  },

  // Get ticket comments
  async getComments(ticketId: string): Promise<ApiResponse<TicketComment[]>> {
    try {
      const res = await serverApi.query<TicketComment[]>({
        table: 'ticket_comments',
        action: 'select',
        select: '*, user:users(full_name, user_photo_url)',
        filters: [{ op: 'eq', column: 'ticket_id', value: ticketId }],
        orders: [{ column: 'created_at', ascending: true }],
      });
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch comments');
      return { data: res.data ?? [], error: null, status: 200 };
    } catch (error) {
      return { data: null, error: error as Error, status: 500 };
    }
  },

  // Add comment
  async addComment(ticketId: string, content: string, isInternal: boolean = false): Promise<ApiResponse<TicketComment>> {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
    return apiClient.post<TicketComment>('ticket_comments', {
      ticket_id: ticketId,
      user_id: userId,
      comment: content,
      is_internal: isInternal,
    });
  },

  // Get tickets by status (for Kanban)
  async getTicketsByStatus(status: TicketStatus, propertyId?: string): Promise<ApiResponse<Ticket[]>> {
    return this.getTickets({ status, propertyId });
  },

  // Get ticket statistics
  async getTicketStats(organizationId?: string, propertyId?: string): Promise<ApiResponse<any>> {
    try {
      const res = await serverApi.rpc('get_ticket_stats', {
        org_id: organizationId ?? null,
        prop_id: propertyId ?? null,
      });
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch stats');
      return { data: res.data, error: null, status: 200 };
    } catch (error) {
      return { data: null, error: error as Error, status: 500 };
    }
  },

  // Subscribe to ticket changes (realtime — kept on direct Supabase)
  subscribeToTicketChanges(ticketId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`ticket-${ticketId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `id=eq.${ticketId}` }, callback)
      .subscribe();
  },

  // Subscribe to all tickets (realtime — kept on direct Supabase)
  subscribeToAllTickets(callback: (payload: any) => void) {
    return supabase
      .channel('tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, callback)
      .subscribe();
  },
};

export default ticketService;
