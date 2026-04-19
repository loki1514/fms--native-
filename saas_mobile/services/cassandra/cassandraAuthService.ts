/**
 * Cassandra Auth Service — Two-layer authentication
 *
 * Layer 1 — Token Exchange (REST):
 *   POST /auth/session { user_jwt: Supabase_JWT, api_key: string }
 *   Response: { cassandra_token: string, expires_at: number }
 *   Token cached in SecureStore (mobile) / localStorage (web)
 *
 * Layer 2 — Session Auth (WebSocket):
 *   The cassandra_token is sent INSIDE the session_start JSON frame —
 *   NOT as a query parameter on the WebSocket URL.
 *   ws.send(JSON.stringify({ type: 'session_start', cassandra_token, room_id }))
 *
 * Token refresh: when 401 is received, clear cache and re-exchange once.
 * Auto-refresh: if expires_at is within 5 minutes of now, re-exchange.
 *
 * The api_key field is optional — pass empty string if the backend
 * doesn't require an org-level API key for token exchange.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'cassandra_token';
const EXPIRES_KEY = 'cassandra_expires_at';
const REFRESH_BUFFER_SECONDS = 300; // 5 minutes

const API_URL = (process.env.EXPO_PUBLIC_CASSANDRA_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');
const WS_URL = (process.env.EXPO_PUBLIC_CASSANDRA_WS_URL ?? 'ws://localhost:8000').replace(/\/$/, '');

// ─── Storage helpers ──────────────────────────────────────────────────────────

async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function removeSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

// ─── Token accessors ──────────────────────────────────────────────────────────

export async function getCassandraToken(): Promise<string | null> {
  return getSecureItem(TOKEN_KEY);
}

async function getExpiresAt(): Promise<number | null> {
  const raw = await getSecureItem(EXPIRES_KEY);
  return raw ? parseInt(raw, 10) : null;
}

// ─── Token validation ─────────────────────────────────────────────────────────

export async function isTokenValid(): Promise<boolean> {
  const token = await getCassandraToken();
  if (!token) return false;
  const expires = await getExpiresAt();
  if (!expires) return false;
  const nowSeconds = Date.now() / 1000;
  return nowSeconds < expires - REFRESH_BUFFER_SECONDS;
}

// ─── Token exchange ─────────────────────────────────────────────────────────

export interface SessionResponse {
  cassandra_token: string;
  expires_at: number;
}

export async function exchangeToken(
  supabaseToken: string,
  apiKey: string = ''
): Promise<SessionResponse> {
  const res = await fetch(`${API_URL}/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_jwt: supabaseToken, api_key: apiKey }),
  });

  if (!res.ok) {
    const detail = res.status === 401 ? 'Unauthorized — check Supabase session' : `HTTP ${res.status}`;
    throw new Error(`Cassandra token exchange failed: ${detail}`);
  }

  const data = (await res.json()) as SessionResponse;
  return data;
}

// ─── Cached token getter ────────────────────────────────────────────────────

/**
 * Returns a valid Cassandra token, exchanging if needed.
 * Uses cached token if still valid; exchanges fresh token otherwise.
 */
export async function getValidToken(): Promise<string> {
  if (await isTokenValid()) {
    const token = await getCassandraToken();
    if (token) return token;
  }

  // Get Supabase JWT for the exchange
  let supabaseToken: string | null = null;

  if (Platform.OS === 'web') {
    supabaseToken = localStorage.getItem('jwt');
  } else {
    supabaseToken = await SecureStore.getItemAsync('jwt');
  }

  if (!supabaseToken) {
    throw new Error('No Supabase session. Please sign in again.');
  }

  const { cassandra_token, expires_at } = await exchangeToken(supabaseToken, '');

  await setSecureItem(TOKEN_KEY, cassandra_token);
  await setSecureItem(EXPIRES_KEY, String(expires_at));

  return cassandra_token;
}

// ─── Clear session ──────────────────────────────────────────────────────────

export async function clearToken(): Promise<void> {
  await removeSecureItem(TOKEN_KEY);
  await removeSecureItem(EXPIRES_KEY);
}

// ─── WebSocket URL helper ───────────────────────────────────────────────────

export function getWebSocketUrl(orgId: string): string {
  return `${WS_URL}/ws/audio/${encodeURIComponent(orgId)}`;
}

// ─── Re-exchange after 401 ─────────────────────────────────────────────────

/**
 * Attempts to re-exchange the token and retry a function once.
 * Used by fetchWithAuth on 401 responses.
 */
export async function withTokenRetry<T>(fn: (token: string) => Promise<T>): Promise<T> {
  await clearToken();
  const token = await getValidToken();
  return fn(token);
}
