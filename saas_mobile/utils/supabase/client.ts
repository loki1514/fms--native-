import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// ─── Environment detection ─────────────────────────────────────────────────

// Browser: has window + localStorage
const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// React Native: lazy check to avoid Node.js / SSR crashes.
// We must NOT import @react-native-async-storage/async-storage at module level
// because its CommonJS build accesses `window` during initialization.
function isReactNative() {
  try {
    if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') return true;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require('react-native');
    return Platform && Platform.OS && Platform.OS !== 'web';
  } catch {
    return false;
  }
}

// Lazy-loaded AsyncStorage — only imported when running in React Native.
let _asyncStorage: any = null;
async function getAsyncStorage() {
  if (!_asyncStorage && isReactNative()) {
    try {
      const mod = await import('@react-native-async-storage/async-storage');
      _asyncStorage = mod.default;
    } catch {
      // AsyncStorage not available
    }
  }
  return _asyncStorage;
}

// ─── Storage adapter (browser → localStorage, native → AsyncStorage, SSR → no-op)

const customStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (isBrowser) return window.localStorage.getItem(key);
    const storage = await getAsyncStorage();
    if (storage) return storage.getItem(key);
    return null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (isBrowser) {
      window.localStorage.setItem(key, value);
      return;
    }
    const storage = await getAsyncStorage();
    if (storage) await storage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (isBrowser) {
      window.localStorage.removeItem(key);
      return;
    }
    const storage = await getAsyncStorage();
    if (storage) await storage.removeItem(key);
  },
};

// ─── Lazy-initialized singleton ────────────────────────────────────────────
// Module-level initialization is deferred so Metro/SSR don't crash.

let _supabase: ReturnType<typeof createSupabaseClient<Database>> | null = null;

function getSupabaseClient() {
  if (!_supabase) {
    _supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: customStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return _supabase;
}

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient<Database>>, {
  get(_target, prop) {
    return getSupabaseClient()[prop as keyof ReturnType<typeof createSupabaseClient>];
  },
});

export function createClient() {
  return getSupabaseClient();
}
