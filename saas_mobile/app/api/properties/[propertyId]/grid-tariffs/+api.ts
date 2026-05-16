/**
 * /api/properties/[propertyId]/grid-tariffs
 *
 * Handles grid tariff CRUD for the mobile app.
 * GET with date param returns active tariff for that date.
 * GET without date returns all tariffs (history).
 * POST creates a new tariff (closes previous active one).
 * DELETE removes a tariff.
 */

import { createAdminClient } from '@/utils/supabase/admin';

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

// GET: Fetch active tariff for date OR all tariffs
export async function GET(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> }
): Promise<Response> {
  try {
    const { propertyId } = await params;
    const supabase = createAdminClient();

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    console.log('[grid-tariffs] GET propertyId:', propertyId, 'date:', date);

    if (date) {
      // Return active tariff for the specific date using direct query
      const { data, error } = await supabase
        .from('grid_tariffs')
        .select('*')
        .eq('property_id', propertyId)
        .lte('effective_from', date)
        .or(`effective_to.is.null, effective_to.gte.${date}`)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('[grid-tariffs] Active tariff result:', data, 'error:', error?.message);

      if (error) {
        console.error('[grid-tariffs] Error fetching active tariff:', error.message);
        return jsonResponse({ error: error.message }, { status: 500 });
      }

      return jsonResponse(data || null);
    }

    // Return all tariffs (history) ordered by effective_from desc
    const { data, error } = await supabase
      .from('grid_tariffs')
      .select('*')
      .eq('property_id', propertyId)
      .order('effective_from', { ascending: false });

    console.log('[grid-tariffs] All tariffs result:', data?.length, 'error:', error?.message);

    if (error) {
      console.error('[grid-tariffs] Error fetching tariffs:', error.message);
      return jsonResponse({ error: error.message }, { status: 500 });
    }

    return jsonResponse(data || []);

  } catch (err) {
    console.error('[grid-tariffs] Unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new tariff
export async function POST(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> }
): Promise<Response> {
  try {
    const { propertyId } = await params;
    const supabase = createAdminClient();

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { rate_per_unit, utility_provider, effective_from, effective_to } = body as Record<string, unknown>;

    if (!rate_per_unit || !effective_from) {
      return jsonResponse({ error: 'rate_per_unit and effective_from are required' }, { status: 400 });
    }

    console.log('[grid-tariffs] POST propertyId:', propertyId, 'rate:', rate_per_unit, 'effective_from:', effective_from);

    // Close any existing active tariff (set effective_to to day before new effective_from)
    const effectiveFromDate = new Date(effective_from as string);
    const dayBefore = new Date(effectiveFromDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayBeforeStr = dayBefore.toISOString().split('T')[0];

    await supabase
      .from('grid_tariffs')
      .update({ effective_to: dayBeforeStr })
      .eq('property_id', propertyId)
      .is('effective_to', null)
      .lt('effective_from', effective_from as string);

    // Create new tariff
    const { data, error } = await supabase
      .from('grid_tariffs')
      .insert({
        property_id: propertyId,
        utility_provider: utility_provider || null,
        rate_per_unit: parseFloat(rate_per_unit as string),
        unit_type: 'kVAh',
        effective_from: effective_from as string,
        effective_to: effective_to || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[grid-tariffs] Error creating tariff:', error.message);
      return jsonResponse({ error: error.message }, { status: 500 });
    }

    console.log('[grid-tariffs] Created tariff:', data.id);
    return jsonResponse(data, { status: 201 });

  } catch (err) {
    console.error('[grid-tariffs] POST unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove a tariff
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> }
): Promise<Response> {
  try {
    const { propertyId } = await params;
    const supabase = createAdminClient();

    const { searchParams } = new URL(request.url);
    const tariffId = searchParams.get('id');
    if (!tariffId) {
      return jsonResponse({ error: 'Tariff ID is required' }, { status: 400 });
    }

    // Reset readings associated with this tariff
    const { error: readingsError } = await supabase
      .from('electricity_readings')
      .update({
        tariff_id: null,
        tariff_rate_used: null,
        computed_cost: 0,
      })
      .eq('tariff_id', tariffId);

    if (readingsError) {
      console.error('[grid-tariffs] Error resetting readings:', readingsError.message);
      return jsonResponse({ error: 'Failed to clean up associated readings' }, { status: 500 });
    }

    // Delete the tariff
    const { error: deleteError } = await supabase
      .from('grid_tariffs')
      .delete()
      .eq('id', tariffId)
      .eq('property_id', propertyId);

    if (deleteError) {
      console.error('[grid-tariffs] Error deleting tariff:', deleteError.message);
      return jsonResponse({ error: deleteError.message }, { status: 500 });
    }

    return jsonResponse({ success: true });

  } catch (err) {
    console.error('[grid-tariffs] DELETE unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}

// Placeholder default export — HTTP method exports handle routing
export default function ApiRoute() { return null; }
