import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Safe MMKV mock for Expo Go compatibility
let mmkvStorage: any;
try {
  const { MMKV } = require('react-native-mmkv');
  mmkvStorage = new MMKV();
} catch (e) {
  console.warn('MMKV not available, using in-memory mock');
  const store = new Map<string, string>();
  mmkvStorage = {
    set: (key: string, value: string) => store.set(key, value),
    getString: (key: string) => store.get(key),
    delete: (key: string) => store.delete(key),
  };
}

const clientStorage = {
  setItem: (key: string, value: string) => {
    mmkvStorage.set(key, value);
  },
  getItem: (key: string) => {
    const value = mmkvStorage.getString(key);
    return value === undefined ? null : value;
  },
  removeItem: (key: string) => {
    mmkvStorage.delete(key);
  },
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Data is fresh for 5 mins
      gcTime: 1000 * 60 * 60 * 24, // Cache is kept for 24 hours
      retry: 2, // Retry failed requests twice
      refetchOnWindowFocus: true, // Native equivalent is AppState 'active'
    },
  },
});

export const mmkvPersister = createSyncStoragePersister({
  storage: clientStorage,
});
