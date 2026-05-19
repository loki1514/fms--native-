/**
 * Mobile API utility — calls web API routes with Bearer token auth.
 * Copy of the exact pattern from saas_development/frontend/utils/supabase/mobile-auth.ts
 *
 * Web API base: https://fms-dev-saas-one.vercel.app
 */
import { createClient } from '@/utils/supabase/client';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------
// Supabase client-with-token (used for server-side API calls)
// ---------------------------------------------------------------------
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createClientFromToken(accessToken: string) {
  return createSupabaseClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Get the current Supabase access token for Bearer auth.
 * Returns null if not authenticated.
 *
 * Strategy: use getSession() (synchronous, cached from storage) first to avoid
 * a network round-trip on mobile. On Expo Go, AsyncStorage may not be fully
 * synchronised when the app starts, so we fall back to getUser() which validates
 * the token with the Supabase Auth server — slower but authoritative.
 */
export async function getSupabaseToken(): Promise<string | null> {
  try {
    const supabase = createClient();
    // getSession() reads from cached storage — works immediately, no network call.
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.access_token) return sessionData.session.access_token;

    // Fallback: validate token with server (handles expired/refresh scenarios)
    const { data: userData } = await supabase.auth.getUser();
    return userData.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the current user's ID, with the same session-first strategy as getSupabaseToken.
 * Safe to call from non-React service files (unlike useAuth() which requires a hook).
 * Returns null if no authenticated session is found.
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user?.id) return sessionData.session.user.id;

    const { data: userData } = await supabase.auth.getUser();
    return userData.user?.id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// Web API base URL
// ---------------------------------------------------------------------
export const WEB_API_BASE = process.env.EXPO_PUBLIC_WEB_API_URL ?? 'https://fms-dev-saas-one.vercel.app';

// ---------------------------------------------------------------------
// Typed API Response shapes
// ---------------------------------------------------------------------
export interface TicketApiResponse {
  success?: boolean;
  ticket?: {
    id: string;
    ticket_number: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    created_at: string;
    raised_by: string;
    assigned_to?: string;
    skill_group_code?: string;
    issue_code?: string;
    confidence?: string;
    classification_source?: string;
    risk_flag?: string | null;
    llm_reasoning?: string | null;
  };
  error?: string;
  classification?: {
    issue_code: string;
    skill_group: string;
    confidence: string;
    isAutoClassified: boolean;
    status: string;
    assigned_to?: string;
    priority?: string | null;
    risk_flag?: string | null;
    reasoning?: string | null;
    enhancedClassification?: boolean;
    zone?: string;
    decisionSource?: string;
  };
}

export interface TicketListResponse {
  tickets?: Ticket[];
  total?: number;
  error?: string;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  raised_by: string;
  assigned_to?: string;
  category?: { id: string; code: string; name: string };
  assignee?: { id: string; full_name: string; email: string; user_photo_url?: string };
  property?: { id: string; name: string; code: string };
  organization?: { id: string; name: string; code: string };
}

export interface SuperTenantProperty {
  id: string;
  property_id: string;
  organization_id: string;
  assigned_by: string;
  created_at: string;
  properties: {
    id: string;
    name: string;
    code: string;
    status: string;
  };
}

export interface SuperTenantResponse {
  properties?: SuperTenantProperty[];
  error?: string;
}

// ---------------------------------------------------------------------
// Internal fetch helper with Bearer token
// ---------------------------------------------------------------------
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getSupabaseToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${WEB_API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`API ${response.status}: ${body || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------
// Ticket API — mirrors POST /api/tickets from web app
// ---------------------------------------------------------------------
export interface CreateTicketInput {
  title?: string;
  description: string;
  propertyId: string;
  organizationId: string;
  priority?: 'low' | 'medium' | 'high' | 'critical' | 'urgent';
  isInternal?: boolean;
  assignedTo?: string;
}

export async function createTicket(input: CreateTicketInput): Promise<TicketApiResponse> {
  const body: Record<string, unknown> = {
    description: input.description,
    title: input.title,
    property_id: input.propertyId,
    organization_id: input.organizationId,
    is_internal: input.isInternal ?? false,
    priority: input.priority,
    assignedTo: input.assignedTo,
  };

  return apiFetch<TicketApiResponse>('/api/tickets', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------
// Ticket list API — mirrors GET /api/tickets from web app
// ---------------------------------------------------------------------
export interface ListTicketsInput {
  propertyId?: string;
  organizationId?: string;
  status?: string;
  isInternal?: boolean;
  raisedBy?: string;
  raisedByRole?: string;
  limit?: number;
  offset?: number;
}

export async function listTickets(input: ListTicketsInput): Promise<TicketListResponse> {
  const params = new URLSearchParams();
  if (input.propertyId) params.set('property_id', input.propertyId);
  if (input.organizationId) params.set('organization_id', input.organizationId);
  if (input.status) params.set('status', input.status);
  if (input.isInternal !== undefined) params.set('isInternal', String(input.isInternal));
  if (input.raisedBy) params.set('raised_by', input.raisedBy);
  if (input.raisedByRole) params.set('raisedByRole', input.raisedByRole);
  if (input.limit !== undefined) params.set('limit', String(input.limit));
  if (input.offset !== undefined) params.set('offset', String(input.offset));

  const qs = params.toString();
  return apiFetch<TicketListResponse>(`/api/tickets${qs ? `?${qs}` : ''}`);
}

// ---------------------------------------------------------------------
// Super Tenant Properties API — mirrors GET /api/super-tenant from web app
// ---------------------------------------------------------------------
export async function getSuperTenantProperties(userId?: string): Promise<SuperTenantResponse> {
  const params = userId ? `?user_id=${userId}` : '';
  return apiFetch<SuperTenantResponse>(`/api/super-tenant${params}`);
}

// ---------------------------------------------------------------------
// Gamification / Leaderboard API — mirrors /api/mst/gamification/* from web app
// ---------------------------------------------------------------------
export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  name: string;
  photo_url: string | null;
  score: number;
  tickets_resolved: number;
  sla_met_count: number;
  first_time_fixes: number;
  streak_days: number;
  badges: Array<{
    code: string;
    name: string;
    icon: string;
    color: string;
    tier: string;
    earned_at: string;
  }>;
}

export interface LeaderboardResponse {
  period: 'daily' | 'weekly';
  score_date: string;
  leaderboard: LeaderboardEntry[];
  total: number;
  error?: string;
}

export interface GamificationBadge {
  code: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  tier: string;
  points_bonus: number;
  earned_at: string;
}

export interface MyStatsResponse {
  property_id: string;
  user_id: string;
  today: {
    total_points: number;
    tickets_resolved: number;
    sla_met_count: number;
    first_time_fixes: number;
    avg_resolution_minutes: number | null;
    rank: number | null;
    total_in_rank: number;
  };
  all_time: {
    total_points: number;
    tickets_resolved: number;
    sla_met_count: number;
  };
  streak: {
    current: number;
    longest: number;
  };
  badges: GamificationBadge[];
  next_achievements: Array<{
    id: string;
    code: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    tier: string;
    criteria: Record<string, unknown>;
    points_bonus: number;
  }>;
  error?: string;
}

export async function getLeaderboard(propertyId: string, period = 'daily'): Promise<LeaderboardResponse> {
  return apiFetch<LeaderboardResponse>(
    `/api/mst/gamification/leaderboard?property_id=${propertyId}&period=${period}`
  );
}

export async function getMyGamificationStats(propertyId: string): Promise<MyStatsResponse> {
  return apiFetch<MyStatsResponse>(
    `/api/mst/gamification/my-stats?property_id=${propertyId}`
  );
}

// ---------------------------------------------------------------------
// Property Access Check — mirrors GET /api/auth/property-access from web app
// ---------------------------------------------------------------------
export interface PropertyAccessResponse {
  authorized: boolean;
  role?: string;
}

/**
 * Check property access directly via Supabase (mobile-native).
 * Mirrors the exact logic from saas_development/app/api/auth/property-access/route.ts
 * but executes via the mobile Supabase client instead of an HTTP call.
 *
 * Logic (exact match to web):
 * 1. Master admin bypass
 * 2. Org-level access (org_admin / org_super_admin / owner)
 * 3. Property-level membership (staff, tenant, etc.)
 *
 * @param propertyId - The property ID to check access for
 * @param userOverride - (optional) Pre-fetched user object. When provided, this is used
 *   instead of calling getSession/getUser internally. This is the PREFERRED way to call
 *   this function on mobile/Expo Go because the supabase singleton in mobileApi.ts may
 *   not share session state with the AuthContext client (separate AsyncStorage hydration).
 */
export async function checkPropertyAccess(
  propertyId: string,
  userOverride?: { id: string; email?: string } | null
): Promise<PropertyAccessResponse> {
  try {
    const supabase = createClient();

    // Get current user — prefer passed-in user (from AuthContext) to avoid session
    // hydration issues between the mobileApi singleton and AuthContext's client.
    let user = userOverride ?? null;
    if (!user) {
      console.log('[checkPropertyAccess] No userOverride — attempting getSession');
      const { data: sessionData } = await supabase.auth.getSession();
      user = sessionData?.session?.user ?? null;
    }
    console.log('[checkPropertyAccess] Acting user:', user?.email, 'id:', user?.id);
    if (!user) {
      console.log('[checkPropertyAccess] No user — returning unauthorized');
      return { authorized: false };
    }

    // 1. Check if master admin
    console.log('[checkPropertyAccess] Checking users table for:', user.id);
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('is_master_admin')
      .eq('id', user.id)
      .maybeSingle() as { data: { is_master_admin: boolean } | null; error: unknown };
    if (userError) console.error('[checkPropertyAccess] users table error:', userError);
    if (userProfile?.is_master_admin) {
      console.log('[checkPropertyAccess] Master admin confirmed');
      return { authorized: true, role: 'master_admin' };
    }

    // 2. Get property's organization
    console.log('[checkPropertyAccess] Checking properties table for:', propertyId);
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('organization_id')
      .eq('id', propertyId)
      .maybeSingle() as { data: { organization_id: string } | null; error: unknown };
    if (propError) console.error('[checkPropertyAccess] properties table error:', propError);
    console.log('[checkPropertyAccess] Property org_id:', property?.organization_id);

    // 3. Org-level access check
    if (property?.organization_id) {
      console.log('[checkPropertyAccess] Checking org memberships for org:', property.organization_id, 'user:', user.id);
      const { data: orgMembership, error: orgError } = await supabase
        .from('organization_memberships')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', property.organization_id)
        .eq('is_active', true)
        .maybeSingle() as { data: { role: string } | null; error: unknown };
      if (orgError) console.error('[checkPropertyAccess] org_memberships error:', orgError);
      console.log('[checkPropertyAccess] Org membership:', orgMembership);

      if (orgMembership && ['org_admin', 'org_super_admin', 'owner', 'super_tenant'].includes(orgMembership.role)) {
        console.log('[checkPropertyAccess] Org-level access granted:', orgMembership.role);
        return { authorized: true, role: orgMembership.role };
      }
    }

    // 4. Property-level membership check
    console.log('[checkPropertyAccess] Checking property_memberships for:', user.id, 'property:', propertyId);
    const { data: propMembership, error: propMemError } = await supabase
      .from('property_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .maybeSingle() as { data: { role: string } | null; error: unknown };
    if (propMemError) console.error('[checkPropertyAccess] property_memberships error:', propMemError);
    console.log('[checkPropertyAccess] Property membership:', propMembership);

    if (propMembership) {
      console.log('[checkPropertyAccess] Property-level access granted:', propMembership.role);
      return { authorized: true, role: propMembership.role };
    }

    console.log('[checkPropertyAccess] No matching membership — returning unauthorized');
    return { authorized: false };
  } catch (err) {
    console.error('[checkPropertyAccess] Unexpected error:', err);
    return { authorized: false, role: 'unknown' };
  }
}

// ---------------------------------------------------------------------
// Role path helpers — mirrors getRoleAllowedPaths / getRoleDefaultPath from web
// ---------------------------------------------------------------------
import { CAPABILITY_MATRIX } from '@/constants/capabilities';

const PROPERTY_ADMIN_ROLES = [
  'property_admin',
  'org_admin',
  'org_super_admin',
  'master_admin',
  'owner',
];

/**
 * Build allowed paths from capability matrix so sidebar modules always match route access.
 * Every role gets /dashboard. Additional paths are added based on CAPABILITY_MATRIX domains.
 */
export function getRoleAllowedPaths(role: string, propertyId: string): string[] {
  const basePath = `/property/${propertyId}`;
  const capabilities = CAPABILITY_MATRIX[role as keyof typeof CAPABILITY_MATRIX] || {};
  const paths: string[] = [
    basePath,
    `${basePath}/dashboard`,
    `${basePath}/lovable-mst`,
    `${basePath}/lovable-admin`,
    `${basePath}/lovable-super-admin`,
    `${basePath}/tenant`,
  ];

  if (capabilities.tickets) {
    paths.push(`${basePath}/tickets`);
    paths.push(`${basePath}/flow-map`);
  }
  if (capabilities.users) paths.push(`${basePath}/users`);
  if (capabilities.visitors) paths.push(`${basePath}/visitors`);
  if (capabilities.properties) paths.push(`${basePath}/rooms`);
  if (capabilities.assets) {
    paths.push(`${basePath}/diesel`);
    paths.push(`${basePath}/electricity`);
  }
  if (capabilities.procurement || capabilities.stock) {
    paths.push(`${basePath}/stock`);
    paths.push(`${basePath}/stock/scan`);
  }
  if (capabilities.reports) paths.push(`${basePath}/reports`);
  if (capabilities.security) paths.push(`${basePath}/security`);
  if (capabilities.sop) paths.push(`${basePath}/checklist`);

  // Common pages every logged-in user can reach
  paths.push(`${basePath}/settings`, `${basePath}/profile`);

  // Admin-level roles get blanket access
  if (PROPERTY_ADMIN_ROLES.includes(role)) {
    return [`${basePath}`];
  }

  return paths;
}

export function getRoleDefaultPath(role: string, propertyId: string): string {
  const normalizedRole = (role ?? '').toLowerCase().trim();
  if (['mst', 'maintenance_staff', 'staff'].includes(normalizedRole)) {
    return `/property/${propertyId}/lovable-mst`;
  }
  if ([
    'property_admin', 'admin', 'manager', 'property manager',
    'property_manager', 'facility_manager', 'facility manager',
    'spoc', 'administrator'
  ].includes(normalizedRole)) {
    return `/property/${propertyId}/lovable-admin`;
  }
  if (['org_admin', 'org_super_admin', 'owner'].includes(normalizedRole)) {
    return `/property/${propertyId}/lovable-super-admin`;
  }
  if (['tenant', 'super_tenant'].includes(normalizedRole)) {
    return `/property/${propertyId}/tenant`;
  }
  return `/property/${propertyId}/lovable-mst`; // Fallback to Lovable MST
}

/**
 * Check if a role is an admin-level role (gets full sidebar dashboard access).
 */
export function isAdminRole(role: string): boolean {
  return PROPERTY_ADMIN_ROLES.includes(role);
}

// =============================================================================
// Reports API
// =============================================================================

export interface ReportKPIs {
  totalSnags: number;
  closedSnags: number;
  openSnags: number;
  pendingValidationCount: number;
  closureRate: number;
}

export interface ChartDataSet {
  labels: string[];
  data: number[];
  open?: number[];
  closed?: number[];
}

export interface ExecutiveReportResponse {
  property: { id: string; name: string; code: string };
  allTimeTotal: number;
  prevMonth: { label: string; total: number; closed: number; open: number; pendingValidation: number; closureRate: number };
  currMonth: { label: string; total: number; closed: number; open: number; pendingValidation: number; closureRate: number };
  topCategories: { name: string; count: number }[];
  trends: {
    prev: number[];
    curr: number[];
  };
  error?: string;
}

export interface RequestsReportResponse {
  success: boolean;
  month: { value: string; label: string };
  property: { id: string; name: string; code: string; address?: string };
  kpis: ReportKPIs;
  charts: {
    floor: ChartDataSet;
    department: ChartDataSet;
  };
  tickets: SnagTicket[];
  error?: string;
}

export interface SnagTicket {
  id: string;
  ticketNumber: string;
  ticketNumberDisplay: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  floor: string | null;
  floorLabel: string;
  location: string | null;
  reportedDate: string;
  closedDate: string | null;
  spocName: string;
  spocEmail: string;
  assigneeName: string;
  beforePhoto: string | null;
  afterPhoto: string | null;
  internal: boolean;
}

export interface SnagReportResponse {
  success: boolean;
  import: { id: string; filename: string; createdAt: string; completedAt: string | null; totalRows: number; validRows: number };
  property: { id: string; name: string; code: string; address?: string };
  kpis: ReportKPIs;
  charts: {
    floor: ChartDataSet;
    department: ChartDataSet;
  };
  tickets: SnagTicket[];
  error?: string;
}

export async function getExecutiveReport(propertyId: string): Promise<ExecutiveReportResponse> {
  // Fetch all tickets directly via Supabase (mirrors ExecutiveSummaryPanel logic)
  const supabase = createClient();

  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('id, category, status, created_at, resolved_at, issue_category:category_id(name)')
    .eq('property_id', propertyId)
    .eq('internal', false)
    .order('created_at', { ascending: false });

  if (ticketsError) return { error: ticketsError.message } as ExecutiveReportResponse;

  const { data: property } = await supabase
    .from('properties').select('id, name, code').eq('id', propertyId).single();

  const normalised = (tickets || []).map((t: any) => ({
    id: t.id,
    category: t.issue_category?.name || t.category || 'Other',
    status: t.status,
    created_at: t.created_at,
    resolved_at: t.resolved_at ?? null,
  }));

  const now = new Date();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const fmtMonth = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const getStats = (arr: typeof normalised) => {
    const total = arr.length;
    const closed = arr.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    const pendingValidation = arr.filter(t => t.status === 'pending_validation').length;
    const open = total - closed - pendingValidation;
    const rate = total > 0 ? Math.round((closed / total) * 100) : 0;
    return { total, closed, open, pendingValidation, closureRate: rate };
  };

  const prevTickets = normalised.filter(t => {
    const d = new Date(t.created_at);
    return d.getMonth() === prevMonthStart.getMonth() && d.getFullYear() === prevMonthStart.getFullYear();
  });
  const currTickets = normalised.filter(t => {
    const d = new Date(t.created_at);
    return d.getMonth() === currMonthStart.getMonth() && d.getFullYear() === currMonthStart.getFullYear();
  });

  const prevStats = getStats(prevTickets);
  const currStats = getStats(currTickets);

  // Top categories
  const cats: Record<string, number> = {};
  normalised.forEach(t => { const c = t.category || 'Other'; cats[c] = (cats[c] || 0) + 1; });
  const topCategories = Object.entries(cats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);

  // 30-day trends
  const getDailyTrend = (arr: typeof normalised, start: Date, days: number) => {
    const trend = new Array(days).fill(0);
    arr.forEach(t => {
      const d = new Date(t.created_at);
      const diff = Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff < days) trend[diff]++;
    });
    return trend;
  };

  return {
    property: property || { id: propertyId, name: 'Property', code: 'N/A' },
    allTimeTotal: normalised.length,
    prevMonth: { label: fmtMonth(prevMonthStart), ...prevStats },
    currMonth: { label: fmtMonth(currMonthStart), ...currStats },
    topCategories,
    trends: {
      prev: getDailyTrend(prevTickets, prevMonthStart, 30),
      curr: getDailyTrend(currTickets, currMonthStart, 30),
    },
  };
}

export async function getRequestsReport(propertyId: string, month?: string, startDate?: string, endDate?: string): Promise<RequestsReportResponse> {
  const params = new URLSearchParams({ propertyId });
  if (month) params.set('month', month);
  if (startDate && endDate) {
    params.set('startDate', startDate);
    params.set('endDate', endDate);
  }

  return apiFetch<RequestsReportResponse>(`/api/reports/requests-report?${params.toString()}`);
}

export async function getSnagReport(importId: string): Promise<SnagReportResponse> {
  return apiFetch<SnagReportResponse>(`/api/reports/snag-report/${importId}`);
}

// =============================================================================
// Procurement / Material Request APIs — mirrors saas_one web app
// =============================================================================

export interface MaterialRequestItem {
  id?: string;
  name: string;
  quantity: number;
  unit_price?: number | null;
  total_price?: number | null;
  photo_url?: string | null;
  description?: string | null;
}

export interface MaterialRequest {
  id: string;
  ticket_id: string;
  property_id: string;
  organization_id: string;
  requested_by: string;
  assignee_uid?: string | null;
  items: MaterialRequestItem[];
  status: string;
  priority?: string;
  total_amount?: number | null;
  total_estimated_cost?: number;
  notes?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  escalated_by?: string | null;
  escalated_at?: string | null;
  approval_level?: number;
  target_approver_id?: string | null;
  target_approver_ids?: string[];
  target_approver_names?: string[];
  has_custom_items?: boolean;
  budget_type?: string;
  created_at: string;
  updated_at: string;
  ticket?: {
    ticket_number: string;
    title: string;
    floor_number?: string | null;
  };
  requester?: { full_name: string } | null;
  approver?: { full_name: string } | null;
  rejecter?: { full_name: string } | null;
  target_approver?: { full_name: string } | null;
  assignee?: { full_name: string } | null;
}

export interface MaterialRequestListResponse {
  requests?: MaterialRequest[];
  error?: string;
}

/**
 * List material requests pending approval for a specific approver.
 * Mirrors GET /api/procurement/requests?approverId=<id>&propertyId=<id>
 */
export async function listPendingApprovals(
  approverId: string,
  propertyId?: string,
  organizationId?: string
): Promise<MaterialRequest[]> {
  const params = new URLSearchParams();
  params.set('approverId', approverId);
  if (propertyId) params.set('propertyId', propertyId);
  if (organizationId) params.set('organizationId', organizationId);

  const data = await apiFetch<MaterialRequest[] | { error: string }>(
    `/api/procurement/requests?${params.toString()}`
  );

  if ('error' in data && data.error) {
    throw new Error(data.error);
  }

  return (data as MaterialRequest[]) || [];
}

/**
 * Approve, reject, or escalate a material request.
 * Mirrors PATCH /api/procurement/requests/<id>
 */
export async function updateMaterialRequestStatus(
  requestId: string,
  status: 'approved' | 'rejected' | 'escalated',
  notes?: string
): Promise<MaterialRequest> {
  return apiFetch<MaterialRequest>(`/api/procurement/requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  });
}

/**
 * Upload a photo for a ticket.
 * Mirrors POST /api/tickets/[id]/photos from web app
 */
export async function uploadTicketPhoto(
  ticketId: string,
  photoUri: string,
  type: 'before' | 'after' = 'before'
): Promise<{ success: boolean; url?: string; error?: string }> {
  const token = await getSupabaseToken();
  const formData = new FormData();

  // On mobile, we need to create a file-like object from the URI
  // Ensure the URI is properly formatted for fetch/FormData
  const cleanUri = Platform.OS === 'android' ? photoUri : photoUri.replace('file://', '');
  
  const filename = photoUri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const fileType = match ? `image/${match[1]}` : `image/jpeg`;

  formData.append('file', {
    uri: photoUri, // Keep original URI for React Native FormData
    name: filename,
    type: fileType,
  } as any);
  formData.append('type', type);

  console.log(`[uploadTicketPhoto] Uploading to ${WEB_API_BASE}/api/tickets/${ticketId}/photos`);
  
  try {
    const response = await fetch(`${WEB_API_BASE}/api/tickets/${ticketId}/photos`, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[uploadTicketPhoto] Server error:', response.status, body);
      return { success: false, error: body || response.statusText };
    }

    const json = await response.json();
    console.log('[uploadTicketPhoto] Success:', json);
    return json;
  } catch (err) {
    console.error('[uploadTicketPhoto] Network error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

// ---------------------------------------------------------------------
// User Management & Add Member APIs (Unified with saas_one web)
// ---------------------------------------------------------------------

export interface UserListResponse {
  users: Array<{
    id: string;
    full_name: string;
    email: string;
    user_photo_url?: string;
    propertyRole?: string;
    orgRole?: string;
    propertyName?: string;
    propertyId?: string;
    is_active: boolean;
    joined_at: string;
    phone?: string;
  }>;
}

export interface CreateUserRequest {
  email: string;
  password?: string;
  full_name: string;
  phone?: string;
  organization_id: string;
  role?: string;
  property_id?: string;
  specialization?: string;
  skills?: string[];
}

export interface CreateUserResponse {
  success?: boolean;
  message?: string;
  user?: {
    id: string;
    email: string;
    full_name: string;
    role: string;
  };
  error?: string;
}

/**
 * Fetch all users for an organization or property using NextJS service API.
 * Mirrors GET /api/users/list
 */
export async function fetchUsersList(orgId?: string, propertyId?: string): Promise<UserListResponse> {
  const params = new URLSearchParams();
  if (orgId) params.set('orgId', orgId);
  if (propertyId) params.set('propertyId', propertyId);
  return apiFetch<UserListResponse>(`/api/users/list?${params.toString()}`);
}

/**
 * Directly create a user account and add them to an organization/property.
 * Mirrors POST /api/users/create
 */
export async function createMemberUser(data: CreateUserRequest): Promise<CreateUserResponse> {
  return apiFetch<CreateUserResponse>('/api/users/create', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

