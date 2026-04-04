import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Detect if we are in a browser, node, or native environment
const isBrowser = typeof window !== 'undefined';
const hasLocalStorage = isBrowser && !!window.localStorage;

// AsyncStorage wrapper that handles Web, Node, and Native environments safely.
const customStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (hasLocalStorage) {
      return window.localStorage.getItem(key);
    }
    // Only use AsyncStorage if we are NOT in a browser and it's available
    if (!isBrowser && AsyncStorage && typeof AsyncStorage.getItem === 'function') {
      try {
        return await AsyncStorage.getItem(key);
      } catch (e) {
        return null;
      }
    }
    return null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (hasLocalStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    if (!isBrowser && AsyncStorage && typeof AsyncStorage.setItem === 'function') {
      try {
        await AsyncStorage.setItem(key, value);
      } catch (e) {}
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (hasLocalStorage) {
      window.localStorage.removeItem(key);
      return;
    }
    if (!isBrowser && AsyncStorage && typeof AsyncStorage.removeItem === 'function') {
      try {
        await AsyncStorage.removeItem(key);
      } catch (e) {}
    }
  },
};

// Lazy-initialized singleton so createSupabaseClient() is NOT called at
// module-load time. Calling it at module evaluation causes a crash because
// Metro's module resolver may access `window` (via AsyncStorage's lib/module
// build) before the JS runtime is fully initialized during Expo server start.
let _supabase: ReturnType<typeof createSupabaseClient> | null = null;

function getSupabaseClient() {
  if (!_supabase) {
    _supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
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

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_target, prop) {
    return getSupabaseClient()[prop as keyof ReturnType<typeof createSupabaseClient>];
  },
});

export function createClient() {
  return getSupabaseClient();
}
