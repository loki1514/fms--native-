/**
 * POST /api/tickets/reassign
 *
 * Reassigns a ticket to a new resolver or unassigns it.
 * Mirrors the web app's reassign endpoint logic.
 *
 * Payload: { ticketId, newAssigneeId, forceAssign }
 */

import { createAdminClient } from '@/utils/supabase/admin';
import { createClientFromToken, extractBearerToken } from '@/utils/supabase/mobile-auth';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body: object, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

interface ReassignRequest {
  ticketId: string;
  newAssigneeId?: string | null;
  forceAssign?: boolean;
}

async function POST(request: Request): Promise<Response> {
  try {
    // Authenticate
    const authHeader = request.headers.get('Authorization');
    const accessToken = extractBearerToken(authHeader);
    if (!accessToken) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const userClient = createClientFromToken(accessToken);
    const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !authUser) {
      return jsonResponse({ error: 'Unauthorized: invalid or expired token' }, { status: 401 });
    }
    const userId = authUser.id;

    // Parse body
    let body: ReassignRequest;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { ticketId, newAssigneeId } = body;

    if (!ticketId || typeof ticketId !== 'string') {
      return jsonResponse({ error: 'Missing required field: ticketId' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Fetch current ticket state
    const { data: ticket, error: fetchError } = await adminClient
      .from('tickets')
      .select('id, assigned_to, status, property_id, organization_id, skill_group_id')
      .eq('id', ticketId)
      .single();

    if (fetchError || !ticket) {
      return jsonResponse({ error: 'Ticket not found' }, { status: 404 });
    }

    const oldAssigneeId = ticket.assigned_to;

    // Build update payload
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (newAssigneeId && newAssigneeId !== oldAssigneeId) {
      // Assigning to a specific person
      updateData.assigned_to = newAssigneeId;
      updateData.assigned_at = new Date().toISOString();
      updateData.status = 'assigned';
    } else if (!newAssigneeId) {
      // Unassigning — go to 'open'
      updateData.assigned_to = null;
      updateData.assigned_at = null;
      updateData.status = 'open';
    }

    // Perform update
    const { error: updateError } = await adminClient
      .from('tickets')
      .update(updateData)
      .eq('id', ticketId);

    if (updateError) {
      console.error('[reassign] Update error:', updateError);
      return jsonResponse({ error: 'Failed to reassign ticket', details: updateError.message }, { status: 500 });
    }

    // Log activity
    const isAssigning = !!newAssigneeId;
    const activityAction = isAssigning
      ? (oldAssigneeId ? 'reassigned' : 'assigned')
      : 'unassigned';

    await adminClient.from('ticket_activity_log').insert({
      ticket_id: ticketId,
      user_id: userId,
      action: activityAction,
      old_value: oldAssigneeId ?? null,
      new_value: newAssigneeId ?? null,
    });

    return jsonResponse({
      success: true,
      ticketId,
      assigned_to: updateData.assigned_to,
      status: updateData.status,
      activityAction,
    });
  } catch (err) {
    console.error('[reassign] Unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export default function handler(req: Request) {
  if (req.method === 'OPTIONS') return OPTIONS();
  if (req.method === 'POST') return POST(req);
  return jsonResponse({ error: 'Method Not Allowed' }, { status: 405 });
}
