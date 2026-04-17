/**
 * Cassandra API Client
 *
 * Thin fetch-based client with:
 *   • JWT injection from SecureStore
 *   • Global error toasts
 *   • Base URL from env
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { toast } from './toast';

const API_URL = (process.env.EXPO_PUBLIC_CASSANDRA_API_URL || 'http://localhost:8000').replace(/\/$/, '');

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem('jwt') || null;
  }
  return SecureStore.getItemAsync('jwt');
}

async function fetchWithAuth(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getToken();
  const url = `${API_URL}${path.startsWith('/') ? path : '/' + path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || body.message || detail;
    } catch {
      /* ignore parse error */
    }
    toast.error(detail);
    throw new Error(detail);
  }

  return res;
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
export { API_URL, fetchWithAuth, getToken };
