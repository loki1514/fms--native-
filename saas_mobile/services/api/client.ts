// ============================================
// API Client - Centralized HTTP Client
// ============================================

import { supabase } from '@/utils/supabase';

// Base API response type
export interface ApiResponse<T> {
  data: T | null;
  error?: Error | string | null;
  status?: number;
  success?: boolean;
}

// API Error class
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Generic API client using Supabase
export const apiClient = {
  // GET request
  async get<T>(
    table: string,
    options?: {
      select?: string;
      filters?: Record<string, any>;
      order?: { column: string; ascending?: boolean };
      limit?: number;
      single?: boolean;
    }
  ): Promise<ApiResponse<T>> {
    try {
      let query: any = supabase.from(table).select(options?.select || '*');

      if (options?.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });
      }

      if (options?.order) {
        query = query.order(options.order.column, {
          ascending: options.order.ascending ?? true,
        });
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = options?.single
        ? await query.single()
        : await query;

      return { data: data as T, error: error as Error | string | null, status: error ? 400 : 200 };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 500,
      };
    }
  },

  // POST request (insert)
  async post<T>(
    table: string,
    body: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      const { data, error }: any = await (supabase as any)
        .from(table)
        .insert(body)
        .select()
        .single();

      return { data: data as T, error: error as Error | string | null, status: error ? 400 : 201 };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 500,
      };
    }
  },

  // PUT request (update)
  async put<T>(
    table: string,
    id: string,
    body: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      const { data, error }: any = await (supabase as any)
        .from(table)
        .update(body)
        .eq('id', id)
        .select()
        .single();

      return { data: data as T, error: error as Error | string | null, status: error ? 400 : 200 };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 500,
      };
    }
  },

  // PATCH request (partial update)
  async patch<T>(
    table: string,
    id: string,
    body: Record<string, any>
  ): Promise<ApiResponse<T>> {
    return this.put<T>(table, id, body);
  },

  // DELETE request
  async delete<T>(table: string, id: string): Promise<ApiResponse<T>> {
    try {
      const { data, error }: any = await (supabase
        .from(table)
        .delete() as any)
        .eq('id', id)
        .select()
        .single();

      return { data: data as T, error: error as Error | string | null, status: error ? 400 : 200 };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 500,
      };
    }
  },

  // RPC call for stored procedures
  async rpc<T>(
    functionName: string,
    params?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      const { data, error }: any = await supabase.rpc(functionName, params as any);
      return { data: data as T, error: error as Error | string | null, status: error ? 400 : 200 };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 500,
      };
    }
  },
};

// Export for convenience
export default apiClient;
