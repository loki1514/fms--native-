/**
 * /api/properties/[propertyId]/dg-tariffs
 *
 * Handles DG (Diesel Generator) tariff CRUD for the mobile app.
 * Mirrors web app logic: time-versioned diesel cost rates per generator.
 */

import { createClientFromToken, extractBearerToken } from '@/utils/supabase/mobile-auth';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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

// GET: Fetch DG tariffs
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

    const { searchParams } = new URL(request.url);
    const generatorId = searchParams.get('generatorId');
    const date = searchParams.get('date');
    const includeHistory = searchParams.get('includeHistory') === 'true';

    if (generatorId) {
      if (date && !includeHistory) {
        // Get active tariff for specific date
        const { data, error } = await userClient.rpc('get_active_dg_tariff', {
          p_generator_id: generatorId,
          p_date: date,
        });

        if (error) {
          console.error('[dg-tariffs] Error fetching active tariff:', error);
          return jsonResponse({ error: error.message }, { status: 500 });
        }

        return jsonResponse(data?.[0] || null);
      }

      // Get all tariffs for this generator (with history)
      const { data, error } = await userClient
        .from('dg_tariffs')
        .select('*')
        .eq('generator_id', generatorId)
        .order('effective_from', { ascending: false });

      if (error) {
        console.error('[dg-tariffs] Error fetching tariffs:', error);
        return jsonResponse({ error: error.message }, { status: 500 });
      }

      return jsonResponse(data || []);
    }

    // Get all tariffs for all generators in this property
    const { data: generators } = await userClient
      .from('generators')
      .select('id')
      .eq('property_id', propertyId);

    if (!generators || generators.length === 0) {
      return jsonResponse([]);
    }

    const generatorIds = generators.map((g) => g.id);

    const { data, error } = await userClient
      .from('dg_tariffs')
      .select(`
        *,
        generator:generators(id, name, make, capacity_kva)
      `)
      .in('generator_id', generatorIds)
      .order('effective_from', { ascending: false });

    if (error) {
      console.error('[dg-tariffs] Error fetching all tariffs:', error);
      return jsonResponse({ error: error.message }, { status: 500 });
    }

    return jsonResponse(data || []);

  } catch (err) {
    console.error('[dg-tariffs] Unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new DG tariff version
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

    const { generator_id, cost_per_litre, effective_from, effective_to } = body;

    if (!generator_id || typeof generator_id !== 'string') {
      return jsonResponse({ error: 'generator_id is required' }, { status: 400 });
    }
    if (typeof cost_per_litre !== 'number' || cost_per_litre <= 0) {
      return jsonResponse({ error: 'cost_per_litre must be a positive number' }, { status: 400 });
    }
    if (!effective_from || typeof effective_from !== 'string') {
      return jsonResponse({ error: 'effective_from date is required' }, { status: 400 });
    }

    // Verify generator belongs to this property
    const { data: generator } = await userClient
      .from('generators')
      .select('id, property_id')
      .eq('id', generator_id)
      .eq('property_id', propertyId)
      .single();

    if (!generator) {
      return jsonResponse({ error: 'Generator not found in this property' }, { status: 404 });
    }

    // Close any existing active tariff (set effective_to to day before new effective_from)
    const effectiveFromDate = new Date(effective_from as string);
    const dayBefore = new Date(effectiveFromDate);
    dayBefore.setDate(dayBefore.getDate() - 1);

    await userClient
      .from('dg_tariffs')
      .update({ effective_to: dayBefore.toISOString().split('T')[0] })
      .eq('generator_id', generator_id)
      .is('effective_to', null)
      .lt('effective_from', effective_from as string);

    // Create new tariff version
    const { data, error } = await userClient
      .from('dg_tariffs')
      .insert({
        generator_id,
        cost_per_litre,
        effective_from,
        effective_to: effective_to || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('[dg-tariffs] Insert error:', error);
      return jsonResponse({ error: error.message }, { status: 500 });
    }

    return jsonResponse(data, { status: 201 });

  } catch (err) {
    console.error('[dg-tariffs] POST unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove a DG tariff version
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
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tariffId = searchParams.get('id');
    if (!tariffId) {
      return jsonResponse({ error: 'Tariff ID is required' }, { status: 400 });
    }

    // Get tariff details before deletion
    const { data: tariffToDelete, error: fetchError } = await userClient
      .from('dg_tariffs')
      .select('generator_id, effective_from')
      .eq('id', tariffId)
      .single();

    if (fetchError || !tariffToDelete) {
      return jsonResponse({ error: 'Tariff not found' }, { status: 404 });
    }

    // Delete the tariff
    const { error: deleteError } = await userClient
      .from('dg_tariffs')
      .delete()
      .eq('id', tariffId);

    if (deleteError) {
      console.error('[dg-tariffs] Delete error:', deleteError);
      return jsonResponse({ error: deleteError.message }, { status: 500 });
    }

    // Recalibrate: re-open the previous tariff that was closed because of this one
    const effectiveFromDate = new Date(tariffToDelete.effective_from);
    const dayBefore = new Date(effectiveFromDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayBeforeStr = dayBefore.toISOString().split('T')[0];

    await userClient
      .from('dg_tariffs')
      .update({ effective_to: null })
      .eq('generator_id', tariffToDelete.generator_id)
      .eq('effective_to', dayBeforeStr);

    return jsonResponse({ success: true });

  } catch (err) {
    console.error('[dg-tariffs] DELETE unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}
