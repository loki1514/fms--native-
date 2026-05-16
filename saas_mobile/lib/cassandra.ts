/**
 * Cassandra API Client
 *
 * Thin fetch-based client with:
 *   • Cassandra token injection via cassandraAuthService (auto-refresh + 401 retry)
 *   • Global error toasts
 *   • Base URL from EXPO_PUBLIC_CASSANDRA_API_URL env
 *
 * Auth flow:
 *   1. getValidToken() — returns cached cassandra_token if valid, else exchanges
 *   2. POST /auth/session { user_jwt: Supabase_JWT, api_key }
 *   3. Response: { cassandra_token, expires_at } — stored in SecureStore
 *   4. On 401: clear cache + re-exchange once, then retry
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { toast } from './toast';
import {
  getValidToken,
  withTokenRetry,
  clearToken,
} from '@/services/cassandra/cassandraAuthService';

const DEFAULT_URL = 'https://fms-dev-saas-one.vercel.app';
const API_URL = (process.env.EXPO_PUBLIC_VOICE_API_URL ?? process.env.EXPO_PUBLIC_CASSANDRA_API_URL ?? DEFAULT_URL).replace(/\/$/, '');

// ─── Offline queue ────────────────────────────────────────────────────────────

const OFFLINE_QUEUE_KEY = '@cassandra_offline_queue';
const MAX_QUEUE_SIZE = 50;

interface QueuedRequest {
  id: string;
  path: string;
  options: RequestInit;
  queuedAt: number;
}

let isOnline = true;
let isReplaying = false;

// Subscribe to network state changes once at module load
NetInfo.addEventListener((state) => {
  const wasOffline = !isOnline;
  isOnline = state.isConnected ?? false;

  if (wasOffline && isOnline) {
    replayOfflineQueue().catch(() => {});
  }
});

async function loadOfflineQueue(): Promise<QueuedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveOfflineQueue(queue: QueuedRequest[]): Promise<void> {
  try {
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch { /* non-fatal */ }
}

async function replayOfflineQueue(): Promise<void> {
  if (isReplaying) return;
  isReplaying = true;
  const queue = await loadOfflineQueue();
  if (queue.length === 0) {
    isReplaying = false;
    return;
  }
  toast.info(`Replaying ${queue.length} queued request(s)…`);
  // Replay in order, removing successfully replayed items
  const remaining: QueuedRequest[] = [];
  for (const item of queue) {
    try {
      const res = await fetch(`${API_URL}${item.path}`, {
        ...item.options,
        headers: {
          'Content-Type': 'application/json',
          ...((item.options.headers as Record<string, string>) || {}),
        },
      });
      if (!res.ok) {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }
  await saveOfflineQueue(remaining);
  if (remaining.length === 0) {
    toast.success('Offline requests synced');
  } else {
    toast.error(`${remaining.length} request(s) still pending`);
  }
  isReplaying = false;
}

async function queueOfflineRequest(path: string, options: RequestInit): Promise<void> {
  const queue = await loadOfflineQueue();
  const newItem: QueuedRequest = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    path,
    options,
    queuedAt: Date.now(),
  };
  queue.push(newItem);
  // Cap queue size
  if (queue.length > MAX_QUEUE_SIZE) {
    queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  }
  await saveOfflineQueue(queue);
  toast.info('Request queued — will send when back online');
}

async function fetchWithAuth(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  // Check online status — queue if offline (skip health check)
  const isHealthCheck = path === '/health';
  if (!isOnline && !isHealthCheck) {
    await queueOfflineRequest(path, options);
    throw new Error('queued_offline');
  }

  let token: string;
  try {
    token = await getValidToken();
  } catch {
    // Fall back to Supabase JWT for unauthenticated endpoints (e.g., /health)
    if (Platform.OS === 'web') {
      token = localStorage.getItem('jwt') || '';
    } else {
      token = ''; // No Supabase token available — unauthenticated request
    }
  }

  const url = `${API_URL}${path.startsWith('/') ? path : '/' + path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    // Token expired — re-exchange once and retry
    try {
      const retryToken = await withTokenRetry(async () => {
        // Refetch the token after clearing cache
        return getValidToken();
      });
      headers['Authorization'] = `Bearer ${retryToken}`;
      const retryRes = await fetch(url, { ...options, headers });
      if (!retryRes.ok) {
        const detail = await parseError(retryRes);
        toast.error(detail);
        throw new Error(detail);
      }
      return retryRes;
    } catch (err) {
      if (err instanceof Error && err.message.includes('exchange failed')) {
        clearToken();
      }
      throw err;
    }
  }

  if (!res.ok) {
    const detail = await parseError(res);
    toast.error(detail);
    throw new Error(detail);
  }

  return res;
}

async function parseError(res: Response): Promise<string> {
  let detail = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    detail = body.detail || body.message || detail;
  } catch {
    /* ignore parse error */
  }
  return detail;
}

// ─── Health ────────────────────────────────────────────────────────────────
export async function healthCheck() {
  const res = await fetch(`${API_URL}/health`, { method: 'GET' });
  return res.ok;
}

export async function healthDashboard() {
  const res = await fetchWithAuth('/health/dashboard');
  return res.json();
}

// ─── Analytics ─────────────────────────────────────────────────────────────
export async function getDashboard(orgId: string, period: string = '7d') {
  const res = await fetchWithAuth(`/analytics/dashboard?org_id=${encodeURIComponent(orgId)}&period=${period}`);
  return res.json();
}

// ─── Voice Features ────────────────────────────────────────────────────────
export async function smartQuery(query: string, orgId: string) {
  const res = await fetchWithAuth('/api/v1/features/voice/smart-query', {
    method: 'POST',
    body: JSON.stringify({ query_text: query, org_id: orgId }),
  });
  return res.json();
}

export async function createTicketNL(audioText: string, orgId: string) {
  const res = await fetchWithAuth('/api/v1/features/voice/ticket', {
    method: 'POST',
    body: JSON.stringify({ audio_text: audioText, org_id: orgId }),
  });
  return res.json();
}

export async function escalateTicketNL(audioText: string, orgId: string) {
  const res = await fetchWithAuth('/api/v1/features/voice/escalate', {
    method: 'POST',
    body: JSON.stringify({ audio_text: audioText, org_id: orgId }),
  });
  return res.json();
}

export async function snoozeTicketNL(audioText: string, orgId: string) {
  const res = await fetchWithAuth('/api/v1/features/voice/snooze', {
    method: 'POST',
    body: JSON.stringify({ audio_text: audioText, org_id: orgId }),
  });
  return res.json();
}

// ─── Chat / Research ───────────────────────────────────────────────────────
export async function researchQuery(query: string, orgId: string) {
  const res = await fetchWithAuth('/api/v1/features/chat/research', {
    method: 'POST',
    body: JSON.stringify({ query, org_id: orgId }),
  });
  return res.json();
}

// ─── Reports ───────────────────────────────────────────────────────────────
export async function generateReport(reportType: string, propertyId: string, period: string, orgId: string) {
  const res = await fetchWithAuth('/api/v1/features/reports/generate', {
    method: 'POST',
    body: JSON.stringify({ report_type: reportType, property_id: propertyId, period, org_id: orgId }),
  });
  return res.json();
}

// ─── Onboarding / Users ────────────────────────────────────────────────────
export async function getOnboardingState(orgId: string) {
  const res = await fetchWithAuth(`/onboarding/state/${encodeURIComponent(orgId)}`);
  return res.json();
}

export async function inviteUsers(orgId: string, emails: string[], role: string, message?: string) {
  const res = await fetchWithAuth(`/onboarding/${encodeURIComponent(orgId)}/invite`, {
    method: 'POST',
    body: JSON.stringify({ emails, role, message: message || `You've been invited to join Cassandra.` }),
  });
  return res.json();
}

// ─── Export ────────────────────────────────────────────────────────────────
export async function requestExport(userId: string, orgId: string, format: string = 'json') {
  const res = await fetchWithAuth('/export/request', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, org_id: orgId, include_attachments: true, format }),
  });
  return res.json();
}

export async function getExportStatus(exportId: string) {
  const res = await fetchWithAuth(`/export/${encodeURIComponent(exportId)}/status`);
  return res.json();
}

// ─── AI Features ───────────────────────────────────────────────────────────
export async function predictiveTickets(orgId: string) {
  const res = await fetchWithAuth('/api/v1/features/ai/predictive-tickets', {
    method: 'POST',
    body: JSON.stringify({ org_id: orgId }),
  });
  return res.json();
}

export async function feasibilityReport(propertyId: string, orgId: string) {
  const res = await fetchWithAuth('/api/v1/features/bd/feasibility-report', {
    method: 'POST',
    body: JSON.stringify({ property_id: propertyId, org_id: orgId }),
  });
  return res.json();
}

export async function opexEstimate(propertyId: string, orgId: string) {
  const res = await fetchWithAuth('/api/v1/features/facility/opex-estimate', {
    method: 'POST',
    body: JSON.stringify({ property_id: propertyId, org_id: orgId }),
  });
  return res.json();
}

// ─── Export the raw fetch helper for extensibility ─────────────────────────
// ─── Memory ───────────────────────────────────────────────────────────────────

export type MemoryType = 'annotation' | 'correction' | 'summary' | 'insight';

export interface WriteMemoryBody {
  org_id: string;
  content: string;
  memory_type: MemoryType;
  context?: {
    room_id?: string;
    transcript_id?: string;
    action_item_id?: string;
  };
}

/**
 * Write a memory entry to Cassandra's memory layer.
 * Falls back gracefully when the backend endpoint is not yet implemented.
 */
export async function writeMemory(body: WriteMemoryBody): Promise<any> {
  try {
    const res = await fetchWithAuth('/api/v1/memory/write', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return res.json();
  } catch (err) {
    // Backend not ready — memory write not yet implemented
    console.warn('[Cassandra] Memory write not yet available:', err);
    return { status: 'pending', _stub: true, body };
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────
export { API_URL, fetchWithAuth };
