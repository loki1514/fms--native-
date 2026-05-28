import { useMutation, useQueryClient } from '@tanstack/react-query';
import { serverApi } from '@/lib/serverApi';

interface ServerMutationContext {
  previousData?: unknown;
  queryKey?: string[];
}

// ── Generic serverApi mutation wrapper ───────────────────────────────────────

export function useServerMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (vars: TVariables) => Promise<TData>,
  options?: {
    invalidateKeys?: string[][];
    optimisticUpdate?: {
      queryKey: string[];
      updater: (old: any, vars: TVariables) => any;
    };
  } & Record<string, unknown>
) {
  const queryClient = useQueryClient();
  const { invalidateKeys, optimisticUpdate, ...mutationOptions } = options ?? {};

  return useMutation({
    mutationFn,

    // Optimistic update: update UI instantly before server responds
    onMutate: async (variables: TVariables) => {
      if (!optimisticUpdate) return {};

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: optimisticUpdate.queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(optimisticUpdate.queryKey);

      // Optimistically update
      queryClient.setQueryData(optimisticUpdate.queryKey, (old: any) => {
        return optimisticUpdate.updater(old, variables);
      });

      return { previousData, queryKey: optimisticUpdate.queryKey };
    },

    // Rollback on error
    onError: (_err: any, _variables: TVariables, context: any) => {
      if (context?.queryKey && context?.previousData !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
    },

    // Invalidate related queries on success
    onSuccess: () => {
      invalidateKeys?.forEach((key: string[]) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },

    ...mutationOptions,
  });
}

// ── Convenience: serverApi generic query mutation ────────────────────────────

export function useServerTableMutation<TVariables extends Record<string, any>>(
  table: string,
  action: 'insert' | 'update' | 'delete' | 'upsert',
  options?: {
    invalidateKeys?: string[][];
    optimisticUpdate?: {
      queryKey: string[];
      updater: (old: any, vars: TVariables) => any;
    };
  } & Record<string, unknown>
) {
  return useServerMutation(
    async (vars: TVariables) => {
      const res = await serverApi.query({
        table,
        action,
        ...vars,
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    options
  );
}

// ── Convenience: serverApi custom endpoint mutation ───────────────────────────

export function useServerPost<TVariables = unknown, TData = unknown>(
  endpoint: string,
  options?: {
    invalidateKeys?: string[][];
  } & Record<string, unknown>
) {
  return useServerMutation<TData, TVariables>(
    async (body: TVariables) => {
      const res = await serverApi.post<TData>(endpoint, body);
      if (res.error) throw new Error(res.error.message);
      return res.data as TData;
    },
    options
  );
}
