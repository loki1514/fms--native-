// ============================================================================
// Server API Client — routes ALL data through saas_mobile_server
// ============================================================================
// Replaces direct Supabase calls from the mobile app with authenticated
// HTTP requests to the mobile server API layer.
//
// Auth operations (OAuth, session refresh, password reset) still use the
// direct Supabase client because they require browser/Deep Link redirects
// and AsyncStorage session persistence.
//
// Usage:
//   import { serverApi } from '@/lib/serverApi';
//   const { data, error } = await serverApi.query({
//     table: 'tickets', action: 'select', filters: [{ op: 'eq', column: 'status', value: 'open' }]
//   });
// ============================================================================

import { createClient } from '@/utils/supabase/client';

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

const BASE_URL = (process.env.EXPO_PUBLIC_MOBILE_SERVER_URL ?? '').replace(/\/$/, '');

function getUrl(endpoint: string): string {
  if (!BASE_URL) {
    throw new Error(
      'EXPO_PUBLIC_MOBILE_SERVER_URL is not set. ' +
        'Add it to your .env file (e.g., EXPO_PUBLIC_MOBILE_SERVER_URL=https://your-mobile-server.vercel.app)'
    );
  }
  return `${BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
}

// ---------------------------------------------------------------------------
// Auth token helper
// ---------------------------------------------------------------------------

async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Generic fetch wrapper
// ---------------------------------------------------------------------------

export interface ServerApiResponse<T = unknown> {
  data: T | null;
  error: { message: string; code?: string; details?: string; hint?: string } | null;
  count?: number | null;
}

export class ServerApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ServerApiError';
  }
}

async function serverFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ServerApiResponse<T>> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = getUrl(endpoint);
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle empty responses (e.g., 204 No Content)
  if (response.status === 204) {
    return { data: null as unknown as T, error: null };
  }

  const json = (await response.json().catch(() => ({}))) as ServerApiResponse<T> & {
    error?: string | { message: string; code?: string } | null;
  };

  if (!response.ok) {
    const errMsg =
      typeof json.error === 'string'
        ? json.error
        : json.error?.message ?? `HTTP ${response.status}`;
    const errCode =
      typeof json.error === 'object' && json.error?.code ? json.error.code : undefined;
    throw new ServerApiError(errMsg, response.status, errCode);
  }

  return {
    data: (json.data !== undefined ? json.data : json) as T | null,
    error: (json.error ?? null) as ServerApiResponse<T>['error'],
    count: typeof json.count === 'number' ? json.count : null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const serverApi = {
  // Generic GET
  get: <T>(endpoint: string) => serverFetch<T>(endpoint, { method: 'GET' }),

  // Generic POST
  post: <T>(endpoint: string, body: unknown) =>
    serverFetch<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),

  // Generic PATCH
  patch: <T>(endpoint: string, body: unknown) =>
    serverFetch<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),

  // Generic PUT
  put: <T>(endpoint: string, body: unknown) =>
    serverFetch<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),

  // Generic DELETE
  delete: <T>(endpoint: string) => serverFetch<T>(endpoint, { method: 'DELETE' }),

  // --- Mobile-client generic proxy -----------------------------------------

  /**
   * Proxy a Supabase query through /api/mobile-client/query.
   * Supports select, insert, update, delete, upsert with filters, ordering,
   * limits, and single/maybeSingle modes.
   */
  query: <T = unknown>(body: {
    table: string;
    action: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
    select?: string;
    selectOptions?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean };
    filters?: Array<{
      op: 'eq' | 'neq' | 'in' | 'gte' | 'lte' | 'lt' | 'gt' | 'ilike' | 'not' | 'is' | 'or';
      column?: string;
      value?: unknown;
      values?: unknown[];
      operator?: string;
      expression?: string;
      foreignTable?: string;
    }>;
    orders?: Array<{ column: string; ascending?: boolean }>;
    limit?: number;
    offset?: number;
    single?: boolean;
    maybeSingle?: boolean;
    values?: unknown;
    mutationOptions?: { onConflict?: string; ignoreDuplicates?: boolean; defaultToNull?: boolean };
  }): Promise<ServerApiResponse<T>> =>
    serverFetch<T>('/api/mobile-client/query', { method: 'POST', body: JSON.stringify(body) }),

  /**
   * Proxy a Supabase RPC through /api/mobile-client/rpc.
   */
  rpc: <T = unknown>(functionName: string, params?: Record<string, unknown>): Promise<ServerApiResponse<T>> =>
    serverFetch<T>('/api/mobile-client/rpc', {
      method: 'POST',
      body: JSON.stringify({ functionName, params: params ?? {} }),
    }),

  /**
   * Upload a file through /api/mobile-client/storage/upload.
   */
  upload: (bucket: string, path: string, file: File | Blob | ArrayBuffer | { uri: string; name?: string; type?: string }, contentType?: string) => {
    const formData = new FormData();
    formData.append('bucket', bucket);
    formData.append('path', path);
    formData.append('contentType', contentType ?? 'application/octet-stream');
    formData.append('upsert', 'true');
    // Support React Native file objects { uri, name, type }
    if (typeof file === 'object' && 'uri' in file) {
      formData.append('file', file as any);
    } else {
      formData.append('file', file as any);
    }
    return serverFetch<{ path: string }>('/api/mobile-client/storage/upload', {
      method: 'POST',
      body: formData as any,
    });
  },

  /**
   * Get a public URL for a stored file.
   */
  getPublicUrl: (bucket: string, path: string) =>
    serverFetch<{ publicUrl: string }>('/api/mobile-client/storage/public-url', {
      method: 'POST',
      body: JSON.stringify({ bucket, path }),
    }),

  /**
   * Remove a stored file.
   */
  removeFile: (bucket: string, path: string) =>
    serverFetch<unknown>('/api/mobile-client/storage/remove', {
      method: 'POST',
      body: JSON.stringify({ bucket, path }),
    }),
};

export default serverApi;
