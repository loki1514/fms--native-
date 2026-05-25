// ============================================
// API Client — routes through saas_mobile_server
// ============================================
//
// This file provides a Supabase-like interface that routes ALL queries
// through the mobile server API layer instead of calling Supabase directly.
//
// Usage:
//   import { apiClient } from './api/client';
//   const { data, error } = await apiClient.get('tickets', { filters: { status: 'open' } });
//
// Under the hood it uses /api/mobile-client/query for generic CRUD and
// /api/mobile-client/rpc for stored procedures.
// ============================================

import { serverApi, ServerApiResponse } from '@/lib/serverApi';

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

// Base API response type (kept for backward compat)
export interface ApiResponse<T> {
  data: T | null;
  error?: Error | string | null;
  status?: number;
  success?: boolean;
}

function mapServerError(err: unknown): Error | string {
  if (err instanceof Error) return err;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

function mapServerResponse<T>(res: ServerApiResponse<T>): ApiResponse<T> {
  if (res.error) {
    return {
      data: null,
      error: res.error.message,
      status: 400,
      success: false,
    };
  }
  return {
    data: res.data as T,
    error: null,
    status: 200,
    success: true,
  };
}

// Convert simple filters to server filter format
function buildFilters(filters?: Record<string, any>) {
  if (!filters) return undefined;
  return Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([column, value]) => ({
      op: Array.isArray(value) ? ('in' as const) : ('eq' as const),
      column,
      value: Array.isArray(value) ? undefined : value,
      values: Array.isArray(value) ? value : undefined,
    }));
}

export const apiClient = {
  // GET request (select)
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
      const res = await serverApi.query<T>({
        table,
        action: 'select',
        select: options?.select || '*',
        filters: buildFilters(options?.filters),
        orders: options?.order ? [options.order] : undefined,
        limit: options?.limit,
        single: options?.single,
      });
      return mapServerResponse(res);
    } catch (error) {
      return {
        data: null,
        error: mapServerError(error),
        status: 500,
      };
    }
  },

  // POST request (insert)
  async post<T>(table: string, body: Record<string, any>): Promise<ApiResponse<T>> {
    try {
      const res = await serverApi.query<T>({
        table,
        action: 'insert',
        values: body,
      });
      return mapServerResponse(res);
    } catch (error) {
      return {
        data: null,
        error: mapServerError(error),
        status: 500,
      };
    }
  },

  // PUT request (update)
  async put<T>(table: string, id: string, body: Record<string, any>): Promise<ApiResponse<T>> {
    try {
      const res = await serverApi.query<T>({
        table,
        action: 'update',
        values: body,
        filters: [{ op: 'eq', column: 'id', value: id }],
      });
      return mapServerResponse(res);
    } catch (error) {
      return {
        data: null,
        error: mapServerError(error),
        status: 500,
      };
    }
  },

  // PATCH request (partial update)
  async patch<T>(table: string, id: string, body: Record<string, any>): Promise<ApiResponse<T>> {
    return this.put<T>(table, id, body);
  },

  // DELETE request
  async delete<T>(table: string, id: string): Promise<ApiResponse<T>> {
    try {
      const res = await serverApi.query<T>({
        table,
        action: 'delete',
        filters: [{ op: 'eq', column: 'id', value: id }],
      });
      return mapServerResponse(res);
    } catch (error) {
      return {
        data: null,
        error: mapServerError(error),
        status: 500,
      };
    }
  },

  // RPC call for stored procedures
  async rpc<T>(functionName: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    try {
      const res = await serverApi.rpc<T>(functionName, params);
      return mapServerResponse(res);
    } catch (error) {
      return {
        data: null,
        error: mapServerError(error),
        status: 500,
      };
    }
  },
};

export default apiClient;
