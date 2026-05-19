/**
 * Cassandra Auth Service — Pass-through Supabase JWT
 *
 * No token exchange needed. The voice server accepts the raw Supabase JWT
 * via Authorization header (REST) and session_start frame (WebSocket).
 * Supabase auto-refreshes the token internally when near expiry.
 */

import { supabase } from '@/utils/supabase/client';

const WS_URL = (process.env.EXPO_PUBLIC_CASSANDRA_WS_URL ?? 'ws://localhost:8000').replace(/\/$/, '');

/**
 * Returns the current Supabase JWT access token.
 * Supabase refreshes this automatically when it nears expiry.
 */
export async function getValidToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? null;

  if (!token) {
    throw new Error('No Supabase session. Please sign in again.');
  }

  return token;
}

/**
 * Clears any stale cached tokens.
 */
export async function clearToken(): Promise<void> {
  // No-op — we no longer cache exchanged tokens.
}

/**
 * WebSocket URL helper.
 */
export function getWebSocketUrl(orgId: string): string {
  return `${WS_URL}/ws/audio/${encodeURIComponent(orgId)}`;
}

/**
 * Retry helper — just fetches a fresh token and retries.
 */
export async function withTokenRetry<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await getValidToken();
  return fn(token);
}
