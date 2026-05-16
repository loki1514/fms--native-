/**
 * /api/properties/[propertyId]/generators
 *
 * Handles generator CRUD for the mobile app.
 * Mirrors web app logic: add/edit/delete generators with initial setup values.
 */

import { createClientFromToken, extractBearerToken } from '@/utils/supabase/mobile-auth';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// GET: Fetch all generators for property
export async function GET(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> }
): Promise<Response> {
  try {
    const { propertyId } = await params;

    const authHeader = request.headers.get('Authorization');
    const accessToken = extractBearerToken(authHeader);
    if (!accessToken) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const userClient = createClientFromToken(accessToken);
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await userClient
      .from('generators')
      .select('*')
      .eq('property_id', propertyId)
      .order('name');

    if (error) {
      console.error('[generators] Fetch error:', error);
      return jsonResponse({ error: error.message }, { status: 500 });
    }

    return jsonResponse(data || []);

  } catch (err) {
    console.error('[generators] Unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new generator
export async function POST(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> }
): Promise<Response> {
  try {
    const { propertyId } = await params;

    const authHeader = request.headers.get('Authorization');
    const accessToken = extractBearerToken(authHeader);
    if (!accessToken) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const userClient = createClientFromToken(accessToken);
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      name,
      make,
      capacity_kva,
      tank_capacity_litres,
      status,
      initial_kwh_reading,
      initial_run_hours,
      initial_diesel_level,
      effective_from_date,
    } = body as Record<string, unknown>;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return jsonResponse({ error: 'Generator name is required' }, { status: 400 });
    }

    const { data, error } = await userClient
      .from('generators')
      .insert({
        property_id: propertyId,
        name: (name as string).trim(),
        make: (make as string) || null,
        capacity_kva: typeof capacity_kva === 'number' ? capacity_kva : 500,
        tank_capacity_litres: typeof tank_capacity_litres === 'number' ? tank_capacity_litres : 1000,
        status: (status as string) || 'active',
        initial_kwh_reading: typeof initial_kwh_reading === 'number' ? initial_kwh_reading : 0,
        initial_run_hours: typeof initial_run_hours === 'number' ? initial_run_hours : 0,
        initial_diesel_level: typeof initial_diesel_level === 'number' ? initial_diesel_level : 0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[generators] Insert error:', error);
      return jsonResponse({ error: error.message }, { status: 500 });
    }

    return jsonResponse(data, { status: 201 });

  } catch (err) {
    console.error('[generators] POST unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update an existing generator
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> }
): Promise<Response> {
  try {
    const { propertyId } = await params;

    const authHeader = request.headers.get('Authorization');
    const accessToken = extractBearerToken(authHeader);
    if (!accessToken) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const userClient = createClientFromToken(accessToken);
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const generatorId = searchParams.get('id');
    if (!generatorId) {
      return jsonResponse({ error: 'Generator ID is required' }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { name, make, capacity_kva, tank_capacity_litres, status } = body;

    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updatePayload.name = (name as string).trim();
    if (make !== undefined) updatePayload.make = (make as string) || null;
    if (capacity_kva !== undefined) updatePayload.capacity_kva = typeof capacity_kva === 'number' ? capacity_kva : null;
    if (tank_capacity_litres !== undefined) updatePayload.tank_capacity_litres = typeof tank_capacity_litres === 'number' ? tank_capacity_litres : null;
    if (status !== undefined) updatePayload.status = status;

    const { data, error } = await userClient
      .from('generators')
      .update(updatePayload)
      .eq('id', generatorId)
      .eq('property_id', propertyId)
      .select()
      .single();

    if (error) {
      console.error('[generators] Patch error:', error);
      return jsonResponse({ error: error.message }, { status: 500 });
    }

    return jsonResponse(data);

  } catch (err) {
    console.error('[generators] PATCH unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove a generator
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> }
): Promise<Response> {
  try {
    const { propertyId } = await params;

    const authHeader = request.headers.get('Authorization');
    const accessToken = extractBearerToken(authHeader);
    if (!accessToken) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const userClient = createClientFromToken(accessToken);
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const generatorId = searchParams.get('id');
    if (!generatorId) {
      return jsonResponse({ error: 'Generator ID is required' }, { status: 400 });
    }

    const { error: deleteError } = await userClient
      .from('generators')
      .delete()
      .eq('id', generatorId)
      .eq('property_id', propertyId);

    if (deleteError) {
      console.error('[generators] Delete error:', deleteError);
      return jsonResponse({ error: deleteError.message }, { status: 500 });
    }

    return jsonResponse({ success: true });

  } catch (err) {
    console.error('[generators] DELETE unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}
