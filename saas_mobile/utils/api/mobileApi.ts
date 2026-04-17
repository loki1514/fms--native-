/**
 * Mobile API utility — calls web API routes with Bearer token auth.
 * Copy of the exact pattern from saas_development/frontend/utils/supabase/mobile-auth.ts
 *
 * Web API base: https://fms-dev-saas-one.vercel.app
 */
import { createClient } from '@/utils/supabase/client';

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
const PROPERTY_ADMIN_ROLES = [
  'property_admin',
  'org_admin',
  'org_super_admin',
  'master_admin',
  'owner',
];

/**
 * Get allowed Expo Router paths based on user role.
 * Mirrors getRoleAllowedPaths() from saas_development/app/property/[propertyId]/layout.tsx
 */
export function getRoleAllowedPaths(role: string, propertyId: string): string[] {
  const basePath = `/property/${propertyId}`;

  switch (role) {
    case 'property_admin':
    case 'org_admin':
    case 'org_super_admin':
    case 'master_admin':
    case 'owner':
      return [`${basePath}`]; // Full access
    case 'tenant':
      return [`${basePath}/tenant`];
    case 'security':
      return [`${basePath}/security`, `${basePath}/dashboard`, `${basePath}/tickets`, `${basePath}/profile`];
    case 'staff':
    case 'soft_service_staff':
    case 'soft_service_supervisor':
    case 'soft_service_manager':
      return [
        `${basePath}/staff`,
        `${basePath}/soft-service-manager`,
        `${basePath}/stock`,
        `${basePath}/stock/scan`,
        `${basePath}/checklist`,
        `${basePath}/dashboard`,
        `${basePath}/tickets`,
        `${basePath}/visitors`,
        `${basePath}/diesel`,
        `${basePath}/electricity`,
        `${basePath}/flow-map`,
        `${basePath}/settings`,
        `${basePath}/profile`,
      ];
    case 'mst':
      return [
        `${basePath}/mst`,
        `${basePath}/dashboard`,
        `${basePath}/tickets`,
        `${basePath}/diesel`,
        `${basePath}/electricity`,
        `${basePath}/visitors`,
        `${basePath}/flow-map`,
        `${basePath}/checklist`,
        `${basePath}/stock`,
        `${basePath}/reports`,
        `${basePath}/settings`,
        `${basePath}/profile`,
        `${basePath}/users`,
        `${basePath}/rooms`,
      ];
    case 'vendor':
      return [`${basePath}/vendor`, `${basePath}/dashboard`, `${basePath}/tickets`];
    case 'super_tenant':
      return [`${basePath}/tenant`];
    default:
      return [`${basePath}/dashboard`];
  }
}

/**
 * Get the default redirect path for a given role.
 * Mirrors getRoleDefaultPath() from saas_development/app/property/[propertyId]/layout.tsx
 */
export function getRoleDefaultPath(role: string, propertyId: string): string {
  const basePath = `/property/${propertyId}`;

  switch (role) {
    case 'property_admin':
    case 'org_admin':
    case 'org_super_admin':
    case 'master_admin':
    case 'owner':
      return `${basePath}/dashboard`;
    case 'tenant':
    case 'super_tenant':
      return `${basePath}/tenant`;
    case 'security':
      return `${basePath}/security`;
    case 'staff':
      return `${basePath}/staff`;
    case 'soft_service_staff':
    case 'soft_service_supervisor':
    case 'soft_service_manager':
      return `${basePath}/soft-service-manager`;
    case 'mst':
      return `${basePath}/mst`;
    case 'vendor':
      return `${basePath}/vendor`;
    default:
      return `${basePath}/dashboard`;
  }
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
