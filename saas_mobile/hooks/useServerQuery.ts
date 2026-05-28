import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { serverApi } from '@/lib/serverApi';

// ── Types ────────────────────────────────────────────────────────────────────

interface ServerQueryFilters {
  op: 'eq' | 'neq' | 'in' | 'gte' | 'lte' | 'lt' | 'gt' | 'ilike' | 'not' | 'is' | 'or';
  column?: string;
  value?: unknown;
  values?: unknown[];
  operator?: string;
  expression?: string;
  foreignTable?: string;
}

interface ServerQueryOrder {
  column: string;
  ascending?: boolean;
}

interface GenericQueryBody {
  table: string;
  action: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  select?: string;
  selectOptions?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean };
  filters?: ServerQueryFilters[];
  orders?: ServerQueryOrder[];
  limit?: number;
  offset?: number;
  single?: boolean;
  maybeSingle?: boolean;
  values?: unknown;
  mutationOptions?: { onConflict?: string; ignoreDuplicates?: boolean; defaultToNull?: boolean };
}

// ── Generic: wrap ANY async function ─────────────────────────────────────────

export function useAsyncQuery<T>(
  queryKey: string[],
  fetcher: () => Promise<T>,
  options?: Record<string, unknown>
) {
  return useQuery({
    queryKey,
    queryFn: fetcher,
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

// ── ServerApi Generic Query Wrapper ──────────────────────────────────────────

export function useServerTableQuery<T = unknown>(
  table: string,
  body: Omit<GenericQueryBody, 'table' | 'action'>,
  options?: Record<string, unknown>
) {
  const queryKey = [table, body];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await serverApi.query<T>({
        table,
        action: 'select',
        ...body,
      });
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? []) as T;
    },
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

// ── ServerApi Custom Endpoint Wrapper ────────────────────────────────────────

export function useServerGet<T = unknown>(
  endpoint: string,
  queryKey: string[],
  options?: Record<string, unknown>
) {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await serverApi.get<T>(endpoint);
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? []) as T;
    },
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

// ── Infinite Query (Pagination) ──────────────────────────────────────────────

export function useServerInfiniteQuery<T = unknown>(
  table: string,
  baseBody: Omit<GenericQueryBody, 'table' | 'action' | 'offset' | 'limit'>,
  pageSize: number = 20,
  options?: Record<string, unknown>
) {
  const queryKey = [table, 'infinite', baseBody];

  return useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 0 }) => {
      const res = await serverApi.query<T[]>({
        table,
        action: 'select',
        ...baseBody,
        limit: pageSize,
        offset: pageParam * pageSize,
      });
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? []) as T[];
    },
    getNextPageParam: (lastPage: T[], allPages: T[][]) => {
      return lastPage.length === pageSize ? allPages.length : undefined;
    },
    initialPageParam: 0,
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

// ── Prefetch Helpers ─────────────────────────────────────────────────────────

export async function prefetchServerQuery<T>(
  queryKey: string[],
  fetcher: () => Promise<T>
) {
  const { queryClient } = await import('@/utils/queryClient');
  await queryClient.prefetchQuery({
    queryKey,
    queryFn: fetcher,
    staleTime: 1000 * 60 * 5,
  });
}
