// ============================================
// Ticket Service - Ticket CRUD Operations
// ============================================

import { apiClient, ApiResponse } from './api/client';
import { supabase } from '@/utils/supabase';
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
  // Get all tickets with filters
  async getTickets(
    filters?: TicketFilters,
    options?: {
      orderBy?: string;
      ascending?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<ApiResponse<Ticket[]>> {
    let query = (supabase
      .from('tickets')
      .select('*, created_by_user:created_by(full_name), assigned_to_user:assigned_to(full_name)') as any);

    // Apply filters
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    if (filters?.priority) {
      if (Array.isArray(filters.priority)) {
        query = query.in('priority', filters.priority);
      } else {
        query = query.eq('priority', filters.priority);
      }
    }

    if (filters?.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo);
    }

    if (filters?.createdBy) {
      query = query.eq('created_by', filters.createdBy);
    }

    if (filters?.propertyId) {
      query = query.eq('property_id', filters.propertyId);
    }

    if (filters?.organizationId) {
      query = query.eq('organization_id', filters.organizationId);
    }

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    // Apply ordering
    if (options?.orderBy) {
      query = query.order(options.orderBy, {
        ascending: options.ascending ?? false,
      });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    return {
      data: data as Ticket[] | null,
      error,
      status: error ? 400 : 200,
    };
  },

  // Get single ticket
  async getTicket(id: string): Promise<ApiResponse<Ticket>> {
    return apiClient.get<Ticket>('tickets', {
      select: '*, created_by_user:created_by(full_name), assigned_to_user:assigned_to(full_name), comments:ticket_comments(*)',
      filters: { id },
      single: true,
    });
  },

  // Create ticket
  async createTicket(data: CreateTicketData): Promise<ApiResponse<Ticket>> {
    return apiClient.post<Ticket>('tickets', {
      title: data.title,
      description: data.description,
      category: data.category,
      subcategory: data.subcategory,
      priority: data.priority,
      status: data.assignedTo ? 'assigned' : 'open',
      property_id: data.propertyId,
      organization_id: data.organizationId,
      assigned_to: data.assignedTo,
    });
  },

  // Update ticket
  async updateTicket(id: string, data: UpdateTicketData): Promise<ApiResponse<Ticket>> {
    const updateData: Record<string, any> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.assignedTo !== undefined) updateData.assigned_to = data.assignedTo;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.subcategory !== undefined) updateData.subcategory = data.subcategory;

    updateData.updated_at = new Date().toISOString();

    if (data.status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }

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
      const { error }: any = await (supabase as any)
        .from('tickets')
        .update({ assigned_to: assignedTo, updated_at: new Date().toISOString() })
        .in('id', ticketIds);

      return {
        data: null,
        error: error as Error | string | null,
        status: error ? 400 : 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 500,
      };
    }
  },

  // Get ticket comments
  async getComments(ticketId: string): Promise<ApiResponse<TicketComment[]>> {
    const { data, error } = (await (supabase
      .from('ticket_comments')
      .select('*, user:users(full_name, avatar_url)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true }) as any)) as { data: unknown; error: unknown };

    return {
      data: data as TicketComment[] | null,
      error: (error as Error | string | null),
      status: error ? 400 : 200,
    };
  },

  // Add comment
  async addComment(
    ticketId: string,
    content: string,
    isInternal: boolean = false
  ): Promise<ApiResponse<TicketComment>> {
    // Use getSession() first (cached) for reliability on mobile/Expo Go.
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id;

    return apiClient.post<TicketComment>('ticket_comments', {
      ticket_id: ticketId,
      user_id: userId,
      content,
      is_internal: isInternal,
    });
  },

  // Get tickets by status (for Kanban)
  async getTicketsByStatus(
    status: TicketStatus,
    propertyId?: string
  ): Promise<ApiResponse<Ticket[]>> {
    const filters: Record<string, any> = { status };
    if (propertyId) filters.property_id = propertyId;

    return this.getTickets(filters);
  },

  // Get ticket statistics
  async getTicketStats(
    organizationId?: string,
    propertyId?: string
  ): Promise<ApiResponse<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    onHold: number;
    avgResolutionTime: number;
  }>> {
    try {
      const { data, error } = await (supabase.rpc('get_ticket_stats', {
        org_id: organizationId ?? null,
        prop_id: propertyId ?? null,
      } as any)) as { data: unknown; error: unknown };

      return {
        data: null,
        error: error as Error | string | null,
        status: error ? 400 : 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 500,
      };
    }
  },

  // Subscribe to ticket changes
  subscribeToTicketChanges(
    ticketId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`ticket-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${ticketId}`,
        },
        callback
      )
      .subscribe();
  },

  // Subscribe to all tickets
  subscribeToAllTickets(callback: (payload: any) => void) {
    return supabase
      .channel('tickets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        callback
      )
      .subscribe();
  },
};

export default ticketService;
